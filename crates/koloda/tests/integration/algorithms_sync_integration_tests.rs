use koloda::domain::algorithms::{
    CloneAlgorithmData, DeleteAlgorithmData, InsertAlgorithmData, UpdateAlgorithmData, UpdateAlgorithmValues,
};
use koloda::domain::optimizer::{replay_card_memories, ApplyAlgorithmOptimizationData};
use koloda::repo::optimizer::get_optimization_input;
use koloda::repo::{algorithms, cards};
use koloda_sync_proto::payload::{CardScheduling, DeckAlgorithm, Delete, Payload};
use koloda_sync_proto::registry::{Group, Kind};

use crate::common::fixtures::{add_algorithm, add_deck, add_graded_card, add_template};
use crate::common::sync::{enroll, outbox};
use crate::common::{fsrs_algorithm_content, test_db};

#[test]
fn adding_or_cloning_an_algorithm_records_its_create_and_first_revision_in_one_commit() {
    let db = test_db();
    enroll(&db);

    let algorithm = algorithms::add_algorithm(
        &db,
        InsertAlgorithmData {
            title: "FSRS".to_string(),
            content: fsrs_algorithm_content(),
        },
    )
    .unwrap();
    algorithms::clone_algorithm(
        &db,
        CloneAlgorithmData {
            title: "Copy".to_string(),
            source_id: algorithm.id.clone(),
        },
    )
    .unwrap();

    let entries = outbox(&db);
    assert_eq!(entries.len(), 4);
    for pair in entries.chunks(2) {
        let [create, revision] = pair else {
            panic!("entries come in create and revision pairs");
        };
        assert!(matches!(create.payload, Payload::AlgorithmCreate(_)));
        let Payload::AlgorithmRevision(row) = &revision.payload else {
            panic!("expected a revision, got {:?}", revision.payload);
        };
        assert_eq!(row.algorithm_id, create.envelope.header.id);
        assert_eq!(row.actor, r#"{"kind":"user"}"#);
        assert_eq!(create.envelope.header.commit_id, revision.envelope.header.commit_id);
    }
}

#[test]
fn editing_an_algorithm_records_changed_groups_and_a_revision_only_for_parameters() {
    type Edit = fn(&mut UpdateAlgorithmValues);
    type Target = (Kind, Option<Group>);
    let cases: [(Edit, Vec<Target>); 4] = [
        (|_| {}, vec![]),
        (
            |values| values.title = "Gentle".to_string(),
            vec![(Kind::Algorithms, Some(Group::Title))],
        ),
        (
            |values| values.notes = Some("for vocabulary".to_string()),
            vec![(Kind::Algorithms, Some(Group::Notes))],
        ),
        (
            |values| values.content.retention = 85.0,
            vec![
                (Kind::Algorithms, Some(Group::Content)),
                (Kind::AlgorithmRevisions, Some(Group::Row)),
            ],
        ),
    ];

    for (edit, expected) in cases {
        let db = test_db();
        let algorithm = add_algorithm(&db, "FSRS");
        enroll(&db);

        let mut values = UpdateAlgorithmValues {
            title: "FSRS".to_string(),
            content: fsrs_algorithm_content(),
            notes: None,
        };
        edit(&mut values);
        algorithms::update_algorithm(&db, UpdateAlgorithmData { id: algorithm, values }).unwrap();

        let targets: Vec<_> = outbox(&db)
            .iter()
            .map(|entry| (entry.envelope.header.kind, entry.envelope.header.group))
            .collect();
        assert_eq!(targets, expected);
    }
}

#[test]
fn deleting_an_algorithm_reassigns_its_decks_then_tombstones_it_with_the_successor() {
    let db = test_db();
    let doomed = add_algorithm(&db, "Old");
    let successor = add_algorithm(&db, "New");
    let template = add_template(&db, "Basic");
    let decks = [
        add_deck(&db, &doomed, &template, "One"),
        add_deck(&db, &doomed, &template, "Two"),
    ];
    enroll(&db);

    algorithms::delete_algorithm(
        &db,
        DeleteAlgorithmData {
            id: doomed.clone(),
            successor_id: Some(successor.clone()),
        },
    )
    .unwrap();

    let entries = outbox(&db);
    assert_eq!(entries.len(), 3);
    for (entry, deck) in entries.iter().zip(&decks) {
        assert_eq!(entry.envelope.header.id, *deck);
        assert_eq!(
            entry.payload,
            Payload::DeckAlgorithm(DeckAlgorithm {
                algorithm_id: successor.clone(),
                updated_at: None,
            })
        );
    }
    assert_eq!(entries[2].envelope.header.id, doomed);
    assert_eq!(
        entries[2].payload,
        Payload::Delete {
            kind: Kind::Algorithms,
            delete: Delete {
                successor: Some(successor.clone()),
            },
        }
    );
    assert!(entries
        .iter()
        .all(|entry| entry.envelope.header.commit_id == entries[0].envelope.header.commit_id));
}

#[test]
fn applying_an_optimization_records_the_new_content_a_revision_and_each_recomputed_card_in_one_commit() {
    const DAY_MS: i64 = 86_400_000;
    let graded_at = [1_767_261_600_000, 1_767_261_600_000 + 3 * DAY_MS];
    let weights = "0.1104, 2.2395, 3.9221, 11.7841, 6.1686, 0.6457, 3.6807, 1.9795, 0, 1.3826, 0.7024, 0.5999, \
                   0.8146, 0.6398, 1, 1.3207, 0.6707, 3.8668, 0.4416, 0.0934, 1.8631, 0.6162, 1.0869, 0.1567, \
                   0.0801, 0.2421, 0.9464, 0.1433, 0.7145, 0, 0.5667, 0.3734, 0.5333, 0.3048";
    let db = test_db();
    let algorithm = add_algorithm(&db, "FSRS");
    let template = add_template(&db, "Basic");
    let deck = add_deck(&db, &algorithm, &template, "Deck");
    let graded = add_graded_card(&db, &deck, &template, &graded_at, true);
    add_graded_card(&db, &deck, &template, &graded_at, false);
    // A card whose stored memory already equals the replay changes nothing, so it captures nothing.
    let settled = add_graded_card(&db, &deck, &template, &graded_at, true);
    let history = get_optimization_input(&db, &algorithm).unwrap().reviews;
    let replayed = replay_card_memories(weights, &history).unwrap()[&settled];
    db.with_conn(|conn| {
        conn.execute(
            "UPDATE cards SET stability = ?1, stability_fast = ?2, difficulty = ?3 WHERE id = ?4",
            rusqlite::params![
                replayed.stability,
                replayed.stability_fast,
                replayed.difficulty,
                settled
            ],
        )?;
        Ok(())
    })
    .unwrap();
    enroll(&db);
    let data = ApplyAlgorithmOptimizationData {
        id: algorithm,
        based_on: fsrs_algorithm_content(),
        weights: weights.to_string(),
    };

    let mut stale = data.clone();
    stale.based_on.retention = 85.0;
    algorithms::apply_algorithm_optimization(&db, stale).expect_err("stale weights are refused");
    assert!(outbox(&db).is_empty(), "a refused apply captures nothing");

    algorithms::apply_algorithm_optimization(&db, data).unwrap();

    let entries = outbox(&db);
    let targets: Vec<_> = entries
        .iter()
        .map(|entry| (entry.envelope.header.kind, entry.envelope.header.group))
        .collect();
    assert_eq!(
        targets,
        vec![
            (Kind::Algorithms, Some(Group::Content)),
            (Kind::AlgorithmRevisions, Some(Group::Row)),
            (Kind::Cards, Some(Group::Scheduling)),
        ]
    );
    let Payload::AlgorithmRevision(row) = &entries[1].payload else {
        panic!("expected a revision, got {:?}", entries[1].payload);
    };
    assert_eq!(row.actor, r#"{"kind":"optimizer"}"#);
    assert_eq!(entries[2].envelope.header.id, graded);
    let card = cards::get_card(&db, &graded).unwrap().unwrap();
    assert_eq!(
        entries[2].payload,
        Payload::CardScheduling(CardScheduling {
            state: i64::from(card.state),
            due_at: card.due_at,
            stability: card.stability,
            stability_fast: card.stability_fast,
            difficulty: card.difficulty,
            scheduled_days: card.scheduled_days,
            learning_steps: i64::from(card.learning_steps),
            reps: i64::from(card.reps),
            lapses: i64::from(card.lapses),
            last_reviewed_at: card.last_reviewed_at,
        })
    );
    assert!(entries
        .iter()
        .all(|entry| entry.envelope.header.commit_id == entries[0].envelope.header.commit_id));
}
