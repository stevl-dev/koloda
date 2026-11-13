import type { KolodaFacade } from "../host/facade";

// A façade whose every call rejects unless the test stubs it.
export function fakeFacade(overrides: Partial<KolodaFacade> = {}): KolodaFacade {
  const unexpected = () => Promise.reject(new Error("not stubbed"));
  return {
    addAttachment: unexpected,
    addCards: unexpected,
    addDeck: unexpected,
    attachmentFile: unexpected,
    getDbStatus: unexpected,
    getDecks: unexpected,
    getLessonData: unexpected,
    getLessons: unexpected,
    getSettings: unexpected,
    getTodaysReviewTotals: unexpected,
    seedDb: unexpected,
    submitLessonResult: unexpected,
    ...overrides,
  };
}
