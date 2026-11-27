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
    patchSettings: unexpected,
    seedDb: unexpected,
    setSettings: unexpected,
    submitLessonResult: unexpected,
    syncCanJoin: unexpected,
    syncDetach: unexpected,
    syncDevices: unexpected,
    syncEvents: () => new Promise(() => {}),
    syncIssuePairing: unexpected,
    syncJoin: unexpected,
    syncNudge: () => {},
    syncPreview: unexpected,
    syncRevokeDevice: unexpected,
    syncStart: unexpected,
    syncStatus: unexpected,
    syncTick: unexpected,
    ...overrides,
  };
}
