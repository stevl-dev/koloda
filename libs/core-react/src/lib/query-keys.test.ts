import { describe, expect, it } from "vitest";
import { queryKeys } from "./query-keys";

describe("queryKeys", () => {
  // WHY: invalidations fire without filters while queries may be created without
  // arguments; all missing-filter shapes must collapse to one cache key or
  // staleTime keeps serving lists invalidations never reach.
  it("normalizes missing lesson filters so invalidations match no-arg queries", () => {
    expect(queryKeys.lessons.all()).toStrictEqual(["lessons", { filters: {} }]);
    expect(queryKeys.lessons.all({})).toStrictEqual(["lessons", { filters: {} }]);
    expect(queryKeys.lessons.all(undefined)).toStrictEqual(["lessons", { filters: {} }]);
    expect(queryKeys.lessons.all({ deckIds: ["01900000-0000-7000-8000-000000000001"] })).toEqual([
      "lessons",
      { filters: { deckIds: ["01900000-0000-7000-8000-000000000001"] } },
    ]);
  });

  // WHY: deck mutations and sync invalidate every per-item entry via a prefix builder;
  // each prefix must stay a strict prefix of its per-item key, or the invalidation misses it.
  const id = "01900000-0000-7000-8000-000000000002";
  it.each([
    { name: "algorithms.decks", prefix: queryKeys.algorithms.decksAll(), key: queryKeys.algorithms.decks(id) },
    { name: "templates.decks", prefix: queryKeys.templates.decksAll(), key: queryKeys.templates.decks(id) },
    {
      name: "lessons.data",
      prefix: queryKeys.lessons.dataAll(),
      key: queryKeys.lessons.data({ filters: {}, amounts: { untouched: 1, learn: 1, review: 1, total: 3 } }),
    },
    { name: "reviews.card", prefix: queryKeys.reviews.all(), key: queryKeys.reviews.card({ cardId: id }) },
  ])("$name keys start with their prefix", ({ prefix, key }) => {
    expect(key.length).toBeGreaterThan(prefix.length);
    expect(key.slice(0, prefix.length)).toEqual(prefix);
  });
});
