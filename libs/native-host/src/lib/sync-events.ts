import type { SyncStatus } from "@koloda/app";

/** Wire name of a synced kind (mirrors `Kind::as_wire` in `koloda-sync-proto`). */
export type SyncKind =
  | "cards"
  | "reviews"
  | "decks"
  | "templates"
  | "algorithms"
  | "algorithm_revisions"
  | "settings.learning";

/**
 * Events the sync engine sends its host (mirrors Rust `EventWire`), less `error`, which each host handles itself.
 * Desktop main logs `error` and forwards the rest to every window on `SYNC_EVENT_CHANNEL`.
 */
export type SyncEvent =
  | { type: "changed"; kinds: SyncKind[] }
  | { type: "status"; status: SyncStatus }
  | { type: "attachmentsFetched"; ids: string[] };
