// WHY: a cap that loaded as unlimited has no last number, and 0 is a hard cap (LEARNING-SETTINGS.md, Daily Limits).
// So turning Unlimited off fills in the first-setup number. Learn starts unlimited and has none; 200 matches Review
// and, since Learn does not count toward Total on first setup, does not block a save.
export const UNLIMITED_OFF_VALUES = { total: 200, untouched: 50, learn: 200, review: 200 } as const;

// INVARIANT: one path per edited learning sync group (crates/koloda/tests/cases/editor-sync-groups.json).
export const LEARNING_SYNC_GROUPS = [
  "defaults.algorithm",
  "defaults.template",
  "dailyLimits",
  "dayStartsAt",
  "learnAheadLimit",
] as const;
