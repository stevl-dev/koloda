import { hashKey } from "@tanstack/react-query";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { queryKeys } from "./query-keys";

/**
 * A kind of stored row that a local write or a sync changes.
 *
 * The strings are the sync wire names (`SyncKind` in `@koloda/native-ipc`, which this package must not import),
 * so the desktop app passes a sync event's kinds straight to `refreshKinds`.
 */
export type DataKind =
  | "cards"
  | "reviews"
  | "decks"
  | "templates"
  | "algorithms"
  | "algorithm_revisions"
  | "settings.learning";

const LESSONS: readonly QueryKey[] = [
  queryKeys.lessons.all(),
  queryKeys.lessons.dataAll(),
  queryKeys.lessons.todayReviewTotals(),
];

// INVARIANT: every kind a write or the sync engine can change has an entry; those rows change nowhere else.
// Each entry lists the query prefixes whose screens read that kind's rows.
export const DATA_KIND_QUERY_KEYS: Record<DataKind, readonly QueryKey[]> = {
  cards: [queryKeys.cards.all(), queryKeys.templates.all(), ...LESSONS],
  reviews: [queryKeys.reviews.all(), ...LESSONS],
  decks: [queryKeys.decks.all(), queryKeys.algorithms.decksAll(), queryKeys.templates.decksAll(), ...LESSONS],
  templates: [
    queryKeys.templates.all(),
    queryKeys.templates.decksAll(),
    queryKeys.cards.all(),
    queryKeys.lessons.dataAll(),
  ],
  algorithms: [queryKeys.algorithms.all(), queryKeys.algorithms.decksAll(), ...LESSONS],
  algorithm_revisions: [queryKeys.algorithms.all()],
  "settings.learning": [queryKeys.settings.detail("learning"), ...LESSONS],
};

export function refreshKinds(queryClient: QueryClient, kinds: readonly DataKind[]): void {
  const keys = new Map<string, QueryKey>();
  for (const kind of kinds) {
    for (const queryKey of DATA_KIND_QUERY_KEYS[kind]) keys.set(hashKey(queryKey), queryKey);
  }
  for (const queryKey of keys.values()) void queryClient.invalidateQueries({ queryKey });
}
