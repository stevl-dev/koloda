import type { KolodaFacade } from "../host/facade";

// A façade whose every call rejects unless the test stubs it.
export function fakeFacade(overrides: Partial<KolodaFacade> = {}): KolodaFacade {
  const unexpected = () => Promise.reject(new Error("not stubbed"));
  return {
    addCard: unexpected,
    addDeck: unexpected,
    attachmentFile: unexpected,
    deleteCard: unexpected,
    deleteCards: unexpected,
    getCards: unexpected,
    getAlgorithms: unexpected,
    getDbStatus: unexpected,
    getDecks: unexpected,
    getLessonData: unexpected,
    getLessons: unexpected,
    getReviews: unexpected,
    getSettings: unexpected,
    getTemplate: unexpected,
    getTemplates: unexpected,
    getTodaysReviewTotals: unexpected,
    patchSettings: unexpected,
    resetCardProgress: unexpected,
    seedDb: unexpected,
    setSettings: unexpected,
    submitLessonResult: unexpected,
    syncAcceptRestore: unexpected,
    syncDetach: unexpected,
    syncDevices: unexpected,
    syncEvents: () => new Promise(() => {}),
    syncImport: unexpected,
    syncIssuePairing: unexpected,
    syncJoin: unexpected,
    syncNudge: () => {},
    syncPreview: unexpected,
    syncRevokeDevice: unexpected,
    syncStart: unexpected,
    syncStatus: unexpected,
    syncTick: unexpected,
    updateCard: unexpected,
    ...overrides,
  };
}
