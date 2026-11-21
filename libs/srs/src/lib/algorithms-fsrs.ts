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
import { clipFSRS6Parameters, FSRS6Model } from "ts-fsrs/models/fsrs-6";
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
const FSRS6_WEIGHT_COUNT = 21;

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
  if (weightParts.length !== FSRS6_WEIGHT_COUNT) {
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
  weights: [
    0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483,
    0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
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
const FSRS_SCHEDULER = defineScheduler({ model: FSRS6Model, chrono: dateChrono }).use(
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
  const relearningSteps = algorithm.relearningSteps.map(toStepUnit);
  return FSRS_SCHEDULER.create({
    config: {
      // WHY: `create` builds the model with `bypass: true`, so it never clips; the bounds would go unenforced.
      weights: clipFSRS6Parameters(algorithm.weights.split(",").map(Number), relearningSteps.length),
      desiredRetention: algorithm.retention / 100,
      enableFuzz: algorithm.isFuzzEnabled,
      maximumInterval: algorithm.maximumInterval,
      enableShortTerm: true,
      learningSteps: algorithm.learningSteps.map(toStepUnit),
      relearningSteps,
      numRelearningSteps: relearningSteps.length,
      allowModelOverride: false,
      fractionalDays: false,
      // WHY: progress reset is its own write and never calls `forget`; the v6 default would clear reps and lapses.
      clearStatsOnForget: false,
    },
  });
}

export type FSRSScheduler = ReturnType<typeof createFSRSScheduler>;

export type FSRSCard = ReturnType<FSRSScheduler["newCard"]>;

export type FSRSRevlog = ReturnType<FSRSScheduler["review"]>["revlog"];
