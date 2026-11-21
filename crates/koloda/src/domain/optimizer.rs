//! FSRS weight optimization, and the card memory replay that applying its weights runs — Rust-only and desktop-only,
//! with no TS twin.
//!
//! Fitting lives here; scheduling stays in `@koloda/srs` (ts-fsrs). What the two must agree on, the model, the weight
//! count, and how days between reviews are counted, is `docs/decisions/FSRS-OPTIMIZER.md`.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex, PoisonError};

use fsrs::{
    compute_parameters, CombinedProgressState, ComputeParametersInput, ComputeParametersVersion, FSRSError, FSRSItem,
    FSRSReview, DEFAULT_PARAMETERS, FSRS,
};
use serde::{Deserialize, Serialize};

use crate::app::error::{error_codes, AppError};
use crate::domain::algorithms_fsrs::{AlgorithmFSRS, FSRS7_WEIGHT_COUNT};
use crate::domain::cards::CardState;

/// One review as the optimizer reads it.
///
/// `state` is the card's state before the grade (the ts-fsrs review log's), so a complete history starts at New.
#[derive(Debug, Clone, PartialEq)]
pub struct ReviewRecord {
    pub id: String,
    pub card_id: String,
    pub rating: i32,
    pub state: i32,
    pub reviewed_at: i64,
}

/// Applies an optimization's weights (TS twin: `ApplyAlgorithmOptimizationData` in `@koloda/srs`).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyAlgorithmOptimizationData {
    pub id: String,
    pub based_on: AlgorithmFSRS,
    pub weights: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct OptimizationInput {
    pub content: AlgorithmFSRS,
    pub reviews: Vec<ReviewRecord>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct TrainingSet {
    pub items: Vec<FSRSItem>,
    /// Dense card index per item, aligned with `items` (`ComputeParametersInput.card_ids`).
    pub card_indices: Vec<i64>,
    pub review_count: usize,
}

struct DatedItem<'a> {
    reviewed_at: i64,
    review_id: &'a str,
    card_index: i64,
    item: FSRSItem,
}

/// Each card's reviews, oldest first, keyed by card id.
fn card_histories(reviews: &[ReviewRecord]) -> BTreeMap<&str, Vec<&ReviewRecord>> {
    let mut by_card: BTreeMap<&str, Vec<&ReviewRecord>> = BTreeMap::new();
    for review in reviews {
        by_card.entry(review.card_id.as_str()).or_default().push(review);
    }
    for history in by_card.values_mut() {
        history.sort_by(|a, b| a.reviewed_at.cmp(&b.reviewed_at).then_with(|| a.id.cmp(&b.id)));
    }
    by_card
}

pub fn build_training_set(reviews: &[ReviewRecord]) -> TrainingSet {
    let mut dated = Vec::new();
    let mut review_count = 0;
    let mut next_card_index: i64 = 0;
    for history in card_histories(reviews).into_values() {
        let Some(card_items) = card_items(&history, next_card_index) else {
            continue;
        };
        if let Some(last) = card_items.last() {
            review_count += last.item.reviews.len();
            next_card_index += 1;
        }
        dated.extend(card_items);
    }

    // WHY: the crate weights later items more (recency weighting), so items must be in review order across cards.
    dated.sort_by(|a, b| {
        a.reviewed_at
            .cmp(&b.reviewed_at)
            .then_with(|| a.review_id.cmp(b.review_id))
    });

    let mut set = TrainingSet {
        review_count,
        ..TrainingSet::default()
    };
    for entry in dated {
        set.items.push(entry.item);
        set.card_indices.push(entry.card_index);
    }
    set
}

/// One item per prefix of the history that ends at a review some time after the previous one.
fn card_items<'a>(history: &[&'a ReviewRecord], card_index: i64) -> Option<Vec<DatedItem<'a>>> {
    let reviews = card_reviews(history)?;

    let mut items = Vec::new();
    let mut prefix = Vec::with_capacity(reviews.len());
    for (review, fsrs_review) in history.iter().zip(reviews) {
        let days = fsrs_review.delta_t;
        prefix.push(fsrs_review);
        // WHY: FSRS-7 learns from same-day reviews too; only a review at the same instant has nothing to predict.
        if days > 0.0 {
            items.push(DatedItem {
                reviewed_at: review.reviewed_at,
                review_id: &review.id,
                card_index,
                item: FSRSItem {
                    reviews: prefix.clone(),
                },
            });
        }
    }
    Some(items)
}

/// A sorted history as the crate reads it.
/// `None` drops the whole card: its history does not start at New, or a review cannot be read.
fn card_reviews(history: &[&ReviewRecord]) -> Option<Vec<FSRSReview>> {
    if history.first()?.state != CardState::New.as_i32() {
        return None;
    }

    let mut reviews = Vec::with_capacity(history.len());
    let mut previous: Option<i64> = None;
    for review in history {
        let rating = u32::try_from(review.rating)
            .ok()
            .filter(|rating| (1..=4).contains(rating))?;
        let days = previous.map_or(0.0, |previous| elapsed_days(previous, review.reviewed_at));
        previous = Some(review.reviewed_at);
        reviews.push(FSRSReview { rating, delta_t: days });
    }
    Some(reviews)
}

/// A card's FSRS-7 memory after its last review: the card columns a grade writes besides its schedule.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CardMemory {
    pub stability: f64,
    pub stability_fast: f64,
    pub difficulty: f64,
}

/// Each card's memory after replaying its reviews with `weights`, keyed by card id.
///
/// A card the optimizer would not train on, whose history does not start at New, is left out and keeps its memory.
/// INVARIANT: equals what grading the same history with ts-fsrs stores (docs/decisions/FSRS-OPTIMIZER.md);
/// the crate clips the weights to the FSRS-7 bounds as the scheduler does.
pub fn replay_card_memories(weights: &str, reviews: &[ReviewRecord]) -> Result<BTreeMap<String, CardMemory>, AppError> {
    let fsrs = FSRS::new(&parse_weights(weights)?).map_err(|err| optimizer_failed(&err))?;
    let mut memories = BTreeMap::new();
    for (card_id, history) in card_histories(reviews) {
        let Some(reviews) = card_reviews(&history) else {
            continue;
        };
        let state = fsrs
            .memory_state(FSRSItem { reviews }, None)
            .map_err(|err| optimizer_failed(&err))?;
        memories.insert(
            card_id.to_string(),
            CardMemory {
                stability: f64::from(state.stability),
                stability_fast: f64::from(state.stability_fast),
                difficulty: f64::from(state.difficulty),
            },
        );
    }
    Ok(memories)
}

/// INVARIANT: twin of ts-fsrs `dateChrono` with `fractionalDays` — elapsed time in fixed 24-hour days, not calendar
/// dates or the learning day (`dayStartsAt`), so the fitted model matches the scheduler that uses it.
fn elapsed_days(from: i64, to: i64) -> f32 {
    ((to - from).max(0) as f64 / DAY_MS) as f32
}

const DAY_MS: f64 = 86_400_000.0;

/// How well weights predict the reviews they were scored on; lower is better.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FitScores {
    pub log_loss: f64,
    pub rmse: f64,
}

/// Result of one optimization run (TS twin: `AlgorithmOptimization` in `@koloda/srs`).
///
/// `based_on` is the saved content the run read; applying is refused once the stored content differs from it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum OptimizationOutcome {
    NotEnoughData {
        based_on: AlgorithmFSRS,
    },
    NoImprovement {
        review_count: usize,
        based_on: AlgorithmFSRS,
        current: FitScores,
        optimized: FitScores,
    },
    Improved {
        review_count: usize,
        based_on: AlgorithmFSRS,
        current: FitScores,
        optimized: FitScores,
        weights: String,
    },
    Cancelled,
}

/// Shared with a running `optimize`, so another thread can read its progress or cancel it.
/// Keeps the `fsrs` crate an implementation detail of this module.
pub type OptimizationProgress = Arc<Mutex<CombinedProgressState>>;

pub fn new_progress() -> OptimizationProgress {
    CombinedProgressState::new_shared()
}

pub fn request_abort(progress: &OptimizationProgress) {
    progress.lock().unwrap_or_else(PoisonError::into_inner).want_abort = true;
}

/// Training steps done and planned; `(0, 0)` before training starts.
pub fn progress_counts(progress: &OptimizationProgress) -> (usize, usize) {
    let state = progress.lock().unwrap_or_else(PoisonError::into_inner);
    (state.current(), state.total())
}

/// Trains on the input and scores the current and the found weights on the same items.
/// `request_abort` on `progress` cancels the run.
pub fn optimize(input: &OptimizationInput, progress: &OptimizationProgress) -> Result<OptimizationOutcome, AppError> {
    // INVARIANT: a run cancelled before it starts resolves `Cancelled`, whatever its input (apps/electron/IPC.md).
    if is_aborted(progress) {
        return Ok(OptimizationOutcome::Cancelled);
    }
    let set = build_training_set(&input.reviews);
    let based_on = input.content.clone();
    if set.items.is_empty() {
        return Ok(OptimizationOutcome::NotEnoughData { based_on });
    }

    let trained = compute_parameters(ComputeParametersInput {
        train_set: set.items.clone(),
        card_ids: Some(set.card_indices.clone()),
        progress: Some(Arc::clone(progress)),
        enable_short_term: true,
        model_version: ComputeParametersVersion::Fsrs7,
        ..ComputeParametersInput::default()
    });
    let trained = match trained {
        Ok(trained) => trained,
        Err(FSRSError::Interrupted) => return Ok(OptimizationOutcome::Cancelled),
        Err(err) => return Err(optimizer_failed(&err)),
    };
    // INVARIANT: the scheduler takes exactly FSRS7_WEIGHT_COUNT weights (docs/decisions/FSRS-OPTIMIZER.md).
    if trained.len() != FSRS7_WEIGHT_COUNT || trained.iter().any(|weight| !weight.is_finite()) {
        return Err(AppError::new(
            error_codes::ALGORITHMS_OPTIMIZER_INVALID_OUTPUT,
            Some(format!("{} weights: {:?}", trained.len(), trained)),
        ));
    }
    // WHY: on a small set the pinned crate does not train (fsrs 7.0.0, `compute_parameters`).
    // Below 64 training items, or when no item has two reviews a day or more apart, it returns `DEFAULT_PARAMETERS`.
    // Training moves the weights off that constant, so equal weights mean nothing was learned.
    // A crate bump revisits this (docs/decisions/FSRS-OPTIMIZER.md).
    if trained.as_slice() == DEFAULT_PARAMETERS.as_slice() {
        if is_aborted(progress) {
            return Ok(OptimizationOutcome::Cancelled);
        }
        return Ok(OptimizationOutcome::NotEnoughData { based_on });
    }

    let weights = format_weights(&trained);
    let current = parse_weights(&input.content.weights)?;
    // WHY: score the weights as they will be stored, after rounding, not the raw training output.
    // The crate clips both to the FSRS-7 bounds as ts-fsrs does when it schedules, so the scores describe those.
    let found = parse_weights(&weights)?;
    let (current, optimized) = match (score(&current, &set, progress), score(&found, &set, progress)) {
        (Ok(current), Ok(optimized)) => (current, optimized),
        (Err(FSRSError::Interrupted), _) | (_, Err(FSRSError::Interrupted)) => {
            return Ok(OptimizationOutcome::Cancelled)
        }
        (Err(err), _) | (_, Err(err)) => return Err(optimizer_failed(&err)),
    };

    let review_count = set.review_count;
    if optimized.log_loss < current.log_loss {
        Ok(OptimizationOutcome::Improved {
            review_count,
            based_on,
            current,
            optimized,
            weights,
        })
    } else {
        Ok(OptimizationOutcome::NoImprovement {
            review_count,
            based_on,
            current,
            optimized,
        })
    }
}

// WHY: `evaluate_with_card_ids` walks each card's history once; `evaluate` replays every prefix item, and each run
// scores twice. The crate documents the same predictions and log loss for both.
fn score(weights: &[f32], set: &TrainingSet, progress: &OptimizationProgress) -> Result<FitScores, FSRSError> {
    let evaluation = FSRS::new(weights)?
        .evaluate_with_card_ids(set.items.clone(), set.card_indices.clone(), |_| !is_aborted(progress))?;
    Ok(FitScores {
        log_loss: f64::from(evaluation.log_loss),
        rmse: f64::from(evaluation.rmse_bins),
    })
}

// WHY: a poisoned lock means a panic mid-run; stopping is the only safe reading.
fn is_aborted(progress: &OptimizationProgress) -> bool {
    progress.lock().map_or(true, |state| state.want_abort)
}

fn optimizer_failed(err: &FSRSError) -> AppError {
    AppError::new(error_codes::ALGORITHMS_OPTIMIZER_FAILED, Some(format!("{err:?}")))
}

fn parse_weights(weights: &str) -> Result<Vec<f32>, AppError> {
    weights
        .split(',')
        .map(|weight| weight.trim().parse::<f32>())
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| AppError::new(error_codes::ALGORITHMS_OPTIMIZER_FAILED, Some(err.to_string())))
}

/// Four decimals without trailing zeros, joined like the built-in defaults (`0.212, 1.2931, …`).
fn format_weights(weights: &[f32]) -> String {
    weights
        .iter()
        .map(|weight| {
            let fixed = format!("{weight:.4}");
            let trimmed = fixed.trim_end_matches('0').trim_end_matches('.');
            match trimmed {
                "" | "-" | "-0" => "0".to_string(),
                value => value.to_string(),
            }
        })
        .collect::<Vec<_>>()
        .join(", ")
}
