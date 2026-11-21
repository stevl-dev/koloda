import { SEED_TEMPLATE_TYPE_BACK_FIELD_ID, SEED_TEMPLATE_TYPE_FRONT_FIELD_ID } from "@koloda/app";
import { Rating, State } from "ts-fsrs";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_FSRS_ALGORITHM } from "./algorithms-fsrs";
import type { FSRSCard } from "./algorithms-fsrs";
import type { Algorithm } from "./algorithms";
import {
  createCardFromCardFSRS,
  createUpdateCardProgress,
  getCardContentValidation,
  getCardGrades,
  getInsertCardSchema,
} from "./cards";
import type { Card } from "./cards";
import { DEFAULT_TEMPLATE } from "./templates";
import type { Template, TemplateFields } from "./templates";
import { observeRuleOutcome, readRuleCases } from "../test/rule-cases";

const DEFAULT_DATE = new Date("2024-01-01T00:00:00.000Z");

const ID = "01900000-0000-7000-8000-000000000001";

function createCard(overrides: Partial<Card> = {}): Card {
  return {
    id: ID,
    deckId: ID,
    templateId: ID,
    content: {
      [SEED_TEMPLATE_TYPE_FRONT_FIELD_ID]: { text: "Question" },
      [SEED_TEMPLATE_TYPE_BACK_FIELD_ID]: { text: "Answer" },
    },
    state: 0,
    dueAt: null,
    stability: 0,
    stabilityFast: 0,
    difficulty: 0,
    scheduledDays: 0,
    learningSteps: 0,
    reps: 0,
    lapses: 0,
    lastReviewedAt: null,
    createdAt: DEFAULT_DATE,
    updatedAt: null,
    ...overrides,
  };
}

function createAlgorithm(overrides: Partial<Algorithm> = {}): Algorithm {
  return {
    id: ID,
    title: "FSRS",
    content: structuredClone(DEFAULT_FSRS_ALGORITHM),
    createdAt: DEFAULT_DATE,
    updatedAt: null,
    ...overrides,
  };
}

function createTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: ID,
    title: "Default",
    content: structuredClone(DEFAULT_TEMPLATE.content),
    isLocked: false,
    createdAt: DEFAULT_DATE,
    updatedAt: null,
    ...overrides,
  };
}

describe("getCardGrades", () => {
  it("returns 4 grades in [Again, Hard, Good, Easy] order", () => {
    vi.useFakeTimers();
    vi.setSystemTime(DEFAULT_DATE);

    const card = createCard();
    const algorithm = createAlgorithm();
    const grades = getCardGrades(card, algorithm);

    expect(grades).toHaveLength(4);
    expect(grades[0].revlog.rating).toBe(Rating.Again);
    expect(grades[1].revlog.rating).toBe(Rating.Hard);
    expect(grades[2].revlog.rating).toBe(Rating.Good);
    expect(grades[3].revlog.rating).toBe(Rating.Easy);

    vi.useRealTimers();
  });

  it("grades a review card from its own stability and last review", () => {
    vi.useFakeTimers();
    vi.setSystemTime(DEFAULT_DATE);

    const card = createCard({
      state: State.Review,
      dueAt: DEFAULT_DATE,
      stability: 10,
      difficulty: 5,
      scheduledDays: 10,
      reps: 3,
      lastReviewedAt: new Date("2023-12-22T00:00:00.000Z"),
    });
    const algorithm = createAlgorithm({ content: { ...DEFAULT_FSRS_ALGORITHM, isFuzzEnabled: false } });
    const [, , good] = getCardGrades(card, algorithm);

    // WHY: a new card's Good is a 10-minute learning step, and the same card without its last review gets 11 days.
    expect(good.card.state).toBe(State.Review);
    expect(good.card.scheduledDays).toBe(32);
    expect(good.card.dueAt).toEqual(new Date("2024-02-02T00:00:00.000Z"));

    vi.useRealTimers();
  });

  it("grades a learning card from its own learning step", () => {
    vi.useFakeTimers();
    vi.setSystemTime(DEFAULT_DATE);

    const card = createCard({
      state: State.Learning,
      dueAt: DEFAULT_DATE,
      stability: 2.3065,
      difficulty: 2.1,
      learningSteps: 1,
      reps: 2,
      lastReviewedAt: new Date("2023-12-31T23:50:00.000Z"),
    });
    const algorithm = createAlgorithm({
      content: {
        ...DEFAULT_FSRS_ALGORITHM,
        isFuzzEnabled: false,
        learningSteps: [
          [1, "m"],
          [10, "m"],
          [1, "h"],
        ],
      },
    });
    const [, , good] = getCardGrades(card, algorithm);

    // WHY: three steps, because with two a learning card graduates on Good from step 1.
    // From step 1, Good waits one hour at step 2; from step 0 it would wait ten minutes at step 1.
    expect(good.card.state).toBe(State.Learning);
    expect(good.card.learningStep).toBe(2);
    expect(good.card.dueAt).toEqual(new Date("2024-01-01T01:00:00.000Z"));

    vi.useRealTimers();
  });
});

const GRADED_CARD: FSRSCard = {
  cardId: ID,
  state: State.Learning,
  scheduleStatus: "learning",
  dueAt: new Date("2024-01-03T00:00:00.000Z"),
  lastReviewAt: new Date("2024-01-01T00:00:00.000Z"),
  stability: 2.5,
  difficulty: 4.2,
  scheduledDays: 7,
  learningStep: 2,
  reps: 1,
  lapses: 0,
};

describe("createCardFromCardFSRS", () => {
  it("keeps the session card's identity and content and takes the graded progress", () => {
    const card = createCard();

    expect(createCardFromCardFSRS(card, GRADED_CARD)).toEqual({
      ...card,
      state: State.Learning,
      dueAt: new Date("2024-01-03T00:00:00.000Z"),
      lastReviewedAt: new Date("2024-01-01T00:00:00.000Z"),
      stability: 2.5,
      stabilityFast: 0,
      difficulty: 4.2,
      scheduledDays: 7,
      learningSteps: 2,
      reps: 1,
      lapses: 0,
    });
  });
});

describe("createUpdateCardProgress", () => {
  const CARD_ID = "01900000-0000-7000-8000-000000000009";

  // INVARIANT: Twin of koloda `cards_progress_tests.rs` UpdateCardProgress shape pins — the submit
  // payload must carry exactly the fields the Rust struct deserializes, nothing more.
  it("maps the graded FSRS card to exactly the submit progress fields", () => {
    expect(createUpdateCardProgress(CARD_ID, GRADED_CARD)).toEqual({
      id: CARD_ID,
      state: 1,
      dueAt: new Date("2024-01-03T00:00:00.000Z"),
      stability: 2.5,
      stabilityFast: 0,
      difficulty: 4.2,
      scheduledDays: 7,
      learningSteps: 2,
      reps: 1,
      lapses: 0,
      lastReviewedAt: new Date("2024-01-01T00:00:00.000Z"),
    });
  });
});

// WHY: CARDS.md (§Card Content) requires every template field to be present; a missing key reports field-empty
// because the UI catalog translates only that code.
describe("getCardContentValidation", () => {
  const contentCases = readRuleCases("cards.json", "content");

  it.each(contentCases)("$name", (ruleCase) => {
    const { template, content } = ruleCase.input as { template: TemplateFields; content: unknown };
    const result = getCardContentValidation(template).content.safeParse(content);
    expect(observeRuleOutcome(ruleCase, result, () => undefined)).toEqual(ruleCase.expect);
  });

  it("reports a missing key at that field's path", () => {
    const ruleCase = contentCases.find((candidate) => candidate.name === "required field key missing");
    const { template, content } = ruleCase!.input as { template: TemplateFields; content: unknown };
    const result = getCardContentValidation(template).content.safeParse(content);
    expect(result.error?.issues[0]?.path).toEqual([template[0]?.id]);
  });
});

describe("getInsertCardSchema", () => {
  it("keeps the card progress check after adding the template's content", () => {
    const result = getInsertCardSchema(createTemplate()).safeParse({
      deckId: ID,
      templateId: ID,
      content: {
        [SEED_TEMPLATE_TYPE_FRONT_FIELD_ID]: { text: "Front text" },
        [SEED_TEMPLATE_TYPE_BACK_FIELD_ID]: { text: "Back text" },
      },
      reps: -1,
    });
    expect(result.error?.issues.map((issue) => issue.message)).toEqual(["validation.cards-progress.reps"]);
  });
});
