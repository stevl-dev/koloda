import { msg } from "@lingui/core/macro";
import {
  dateChrono,
  defineScheduler,
  schedulerDesiredRetentionMiddleware,
  schedulerFuzzingMiddleware,
  schedulerLearningStepsMiddleware,
  schedulerMaximumIntervalMiddleware,
  schedulerMonotonicIntervalMiddleware,
  schedulerScheduledDaysMiddleware,
  schedulerStatsMiddleware,
} from "ts-fsrs";
import type { StepUnit } from "ts-fsrs";
import { clipFSRS7Parameters, FSRS7Model } from "ts-fsrs/models/fsrs-7";
import { z } from "zod";

export const LEARNING_STEPS_UNITS = [
  { id: "s", short: msg`fsrs.learning-steps.units.seconds.short`, long: msg`fsrs.learning-steps.units.seconds.long` },
  { id: "m", short: msg`fsrs.learning-steps.units.minutes.short`, long: msg`fsrs.learning-steps.units.minutes.long` },
  { id: "h", short: msg`fsrs.learning-steps.units.hours.short`, long: msg`fsrs.learning-steps.units.hours.long` },
  { id: "d", short: msg`fsrs.learning-steps.units.days.short`, long: msg`fsrs.learning-steps.units.days.long` },
] as const;

export const FSRS_GRADES = [
  msg`fsrs.grades.again`,
  msg`fsrs.grades.hard`,
  msg`fsrs.grades.good`,
  msg`fsrs.grades.easy`,
];

const LEARNING_STEP_UNITS = LEARNING_STEPS_UNITS.map(({ id }) => id);
const FSRS7_WEIGHT_COUNT = 34;

// Decimal float grammar mirroring Rust `str::parse::<f64>()` (finite values):
// optional sign, digits with optional fraction or leading-dot fraction,
// optional scientific exponent. Rejects hex/binary/octal and `inf`/`NaN`
// spellings that `Number()` would otherwise accept or that fail `is_finite`.
const WEIGHT_DECIMAL_PATTERN = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

// WHY: the whole-number check lives in the refinement below, so a fraction reports its list's code.
// The Rust twin stores step amounts as i64, so on desktop a fraction fails serde before `validate()`;
// the 2^53 gap is an accepted divergence (docs/decisions/TS-RUST-DOMAIN-MIRRORING.md).
// The type check carries the list's code too: a cleared NumberField commits `NaN`, which fails here, and the
// refinement never runs after a type failure.
const learningStepValidation = z.tuple([
  z.number({ message: "validation.algorithm.fsrs.learning-steps.amount" }),
  z.string(),
]);
const relearningStepValidation = z.tuple([
  z.number({ message: "validation.algorithm.fsrs.relearning-steps.amount" }),
  z.string(),
]);

const algorithmFSRSBaseValidation = z.object({
  type: z.literal("fsrs"),
  retention: z.number(),
  weights: z.string(),
  isFuzzEnabled: z.boolean(),
  learningSteps: z.array(learningStepValidation),
  relearningSteps: z.array(relearningStepValidation),
  // WHY: whole numbers are checked in the refinement, so a fraction reports the field's code. Rust
  // `maximum_interval: i64` fails serde on a fraction before validation runs.
  // The type check carries the code for a cleared field's `NaN`, as the step amounts do.
  maximumInterval: z.number({ message: "validation.algorithm.fsrs.maximum-interval" }),
});

export const algorithmFSRSValidation = algorithmFSRSBaseValidation.superRefine((data, ctx) => {
  if (data.retention < 70 || data.retention > 99 || !Number.isInteger(data.retention)) {
    ctx.addIssue({
      code: "custom",
      message: "validation.algorithm.fsrs.retention",
      path: ["retention"],
    });
  }

  for (let i = 0; i < data.learningSteps.length; i++) {
    const [amount, unit] = data.learningSteps[i];
    if (amount <= 0 || !Number.isInteger(amount)) {
      ctx.addIssue({
        code: "custom",
        message: "validation.algorithm.fsrs.learning-steps.amount",
        path: ["learningSteps", i, 0],
      });
    }
    if (!LEARNING_STEP_UNITS.includes(unit as (typeof LEARNING_STEP_UNITS)[number])) {
      ctx.addIssue({
        code: "custom",
        message: "validation.algorithm.fsrs.learning-steps.unit",
        path: ["learningSteps", i, 1],
      });
    }
  }

  for (let i = 0; i < data.relearningSteps.length; i++) {
    const [amount, unit] = data.relearningSteps[i];
    if (amount <= 0 || !Number.isInteger(amount)) {
      ctx.addIssue({
        code: "custom",
        message: "validation.algorithm.fsrs.relearning-steps.amount",
        path: ["relearningSteps", i, 0],
      });
    }
    if (!LEARNING_STEP_UNITS.includes(unit as (typeof LEARNING_STEP_UNITS)[number])) {
      ctx.addIssue({
        code: "custom",
        message: "validation.algorithm.fsrs.relearning-steps.unit",
        path: ["relearningSteps", i, 1],
      });
    }
  }

  if (data.maximumInterval <= 0 || !Number.isInteger(data.maximumInterval)) {
    ctx.addIssue({
      code: "custom",
      message: "validation.algorithm.fsrs.maximum-interval",
      path: ["maximumInterval"],
    });
  }

  const weightParts = data.weights.split(",");
  if (weightParts.length !== FSRS7_WEIGHT_COUNT) {
    ctx.addIssue({
      code: "custom",
      message: "validation.algorithm.fsrs.weights",
      path: ["weights"],
    });
    return;
  }

  for (const part of weightParts) {
    const trimmed = part.trim();
    // WHY: `Number()` accepts hex/binary/octal (`0x1f`) which the Rust twin
    // `parse::<f64>()` rejects — restrict to the decimal grammar so a value
    // the web form saves cannot fail desktop validation.
    if (trimmed.length === 0 || !WEIGHT_DECIMAL_PATTERN.test(trimmed) || !Number.isFinite(Number(trimmed))) {
      ctx.addIssue({
        code: "custom",
        message: "validation.algorithm.fsrs.weights",
        path: ["weights"],
      });
      return;
    }
  }
});

export type AlgorithmFSRS = z.infer<typeof algorithmFSRSValidation>;

export const DEFAULT_FSRS_ALGORITHM: AlgorithmFSRS = {
  type: "fsrs",
  retention: 90,
  // INVARIANT: ts-fsrs 6.0.0 `FSRS7_DEFAULT_WEIGHTS`, written out so the stored default does not move with a bump.
  weights: [
    0.1104, 2.2395, 3.9221, 11.7841, 6.1686, 0.6457, 3.6807, 1.9795, 0, 1.3826, 0.7024, 0.5999, 0.8146, 0.6398, 1,
    1.3207, 0.6707, 3.8668, 0.4416, 0.0934, 1.8631, 0.6162, 1.0869, 0.1567, 0.0801, 0.2421, 0.9464, 0.1433, 0.7145, 0,
    0.5667, 0.3734, 0.5333, 0.3048,
  ].join(", "),
  isFuzzEnabled: true,
  learningSteps: [
    [1, "m"],
    [10, "m"],
  ],
  relearningSteps: [[10, "m"]],
  maximumInterval: 36500,
};

// INVARIANT: maximum-interval runs after learning-steps, so a step longer than the cap still holds as the chain unwinds.
const FSRS_SCHEDULER = defineScheduler({ model: FSRS7Model, chrono: dateChrono }).use(
  schedulerDesiredRetentionMiddleware,
  schedulerFuzzingMiddleware,
  schedulerStatsMiddleware,
  schedulerScheduledDaysMiddleware,
  schedulerLearningStepsMiddleware,
  schedulerMaximumIntervalMiddleware,
  schedulerMonotonicIntervalMiddleware,
);

// WORKAROUND: ts-fsrs step units are m, h, and d; a seconds step goes as fractional minutes, which it accepts.
function toStepUnit([amount, unit]: AlgorithmFSRS["learningSteps"][number]): StepUnit {
  return unit === "s" ? `${amount / 60}m` : (`${amount}${unit}` as StepUnit);
}

export function createFSRSScheduler(algorithm: AlgorithmFSRS) {
  return FSRS_SCHEDULER.create({
    config: {
      // WHY: `create` builds the model with `bypass: true`, so it never clips; the bounds would go unenforced.
      // The optimizer's crate clips to the same bounds (docs/decisions/FSRS-OPTIMIZER.md).
      weights: clipFSRS7Parameters(algorithm.weights.split(",").map(Number)),
      desiredRetention: algorithm.retention / 100,
      enableFuzz: algorithm.isFuzzEnabled,
      maximumInterval: algorithm.maximumInterval,
      // INVARIANT: steps are minimums. The model may lengthen one, or skip the rest when it predicts a day or more.
      enableShortTerm: true,
      learningSteps: algorithm.learningSteps.map(toStepUnit),
      relearningSteps: algorithm.relearningSteps.map(toStepUnit),
      graduatingInterval: 1,
      allowModelOverride: true,
      fractionalDays: true,
      // WHY: progress reset is its own write and never calls `forget`; the v6 default would clear reps and lapses.
      clearStatsOnForget: false,
    },
  });
}

export type FSRSScheduler = ReturnType<typeof createFSRSScheduler>;

export type FSRSCard = ReturnType<FSRSScheduler["newCard"]>;

export type FSRSRevlog = ReturnType<FSRSScheduler["review"]>["revlog"];
