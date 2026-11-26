import type { KolodaFacade } from "../host/facade";

// A façade whose every call rejects unless the test stubs it.
export function fakeFacade(overrides: Partial<KolodaFacade> = {}): KolodaFacade {
  const unexpected = () => Promise.reject(new Error("not stubbed"));
  return {
    attachmentFile: unexpected,
    getDbStatus: unexpected,
    getDecks: unexpected,
    getLessonData: unexpected,
    getLessons: unexpected,
    getSettings: unexpected,
    getTodaysReviewTotals: unexpected,
    seedDb: unexpected,
    submitLessonResult: unexpected,
    syncCanJoin: unexpected,
    syncEvents: () => new Promise(() => {}),
    syncJoin: unexpected,
    syncNudge: () => {},
    syncPreview: unexpected,
    syncStart: unexpected,
    syncStatus: unexpected,
    ...overrides,
  };
}
