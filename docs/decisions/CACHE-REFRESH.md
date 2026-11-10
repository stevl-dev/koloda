# Cache refresh after a change

## Ruling

- `libs/core-react` holds one table from a changed kind of row to the query prefixes that read it
  (`DATA_KIND_QUERY_KEYS` in `libs/core-react/src/lib/cache-refresh.ts`).
  The kinds are cards, reviews, decks, templates, algorithms, algorithm revisions, and the learning settings.
- A local write names the kinds it changes and refreshes through that table.
  A write made with a mutation uses `useWriteMutation`, which refreshes when the write succeeds,
  whether or not its component is still mounted.
- Desktop sync refreshes through the same table, with the kinds the engine reports.
- A component does not list query keys for a write.
  It may put the row it wrote into the cache or remove it: the row's detail entry,
  or its place in a list when the row has no detail entry, as a card has none.
- A lesson refreshes once, when it closes, not per grade.

## Why

Queries stay fresh for a minute, so a missed key shows old data for that long.
Local writes and sync change the same rows.
When each write kept its own key list, the local list was the narrower copy four times,
and a refresh attached to a `mutate` call was dropped when its component unmounted first.

## Applies when

- A change adds a write, a query key, or a query that reads another kind's rows.
- A change adds a synced kind: the table needs its entry.
- Not needed for queries that no synced kind feeds: AI profiles, conversations, sync status, hotkeys,
  and the interface settings.

## Rejected designs

- No per-component key lists — four audits each found one that missed a key the sync table had.
- No refresh inside the hosts' mutation factories — every host would restate it.
