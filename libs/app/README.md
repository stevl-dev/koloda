# @koloda/app

Framework-agnostic app foundation: shared error codes, the app-shell settings schemas (interface / learning / hotkeys),
conversation DTOs, locale helpers, and generic utilities.
No React, no DB drivers, no domain scheduling.

## Where it sits

Consumed by nearly every lib and app.
Depends on nothing; the settings registry that composes these schemas with ai's lives in `@koloda/settings`.
Desktop mirrors live in `crates/koloda/src/domain/` (settings, hotkeys, conversations, errors).

## Architectural Map

- Errors: `error.ts` — `AppError`, `throwKnownError`,
  and the Lingui error-code catalog (`db.*`, `validation.*`, `ai.*`, `not-found.*`, `sync.*`).
  The AIError→AppError bridge lives in `@koloda/ai`'s `./app-error` subpath.
- Settings slices: `settings-interface.ts`, `settings-learning.ts`,
  `settings-hotkeys.ts` — defaults, labels, zod validation.
- Conversations: `conversations.ts` — `Conversation` / `ConversationListItem` types
  and active-conversation `localStorage` helpers.
- Environment: `environment.ts` — `getAppPlatform()`.
  `LOCALES` and `getLanguageCode()` live with the interface slice in `settings-interface.ts`.
- Titles: `titles.ts` — entity title, AI profile title, and notes schemas, with the length limits the Rust twins
  check.
- Seed ids: `seed-ids.ts` — the fixed ids of the seeded algorithms, templates, and template fields.
- Timestamps: `timestamp-format.ts` — date and time formatting by the interface settings' formats and locale.
- Shared shapes: `db.ts` (`Timestamps`), `utility.ts` (`DeepPartial`, `deepMerge`, form helpers, id helpers).
- Sync: `sync.ts` — `SyncStatus` as the desktop sync engine reports it; only the desktop syncs.

Subpath exports `@koloda/app/titles` and `@koloda/app/db` skip the root barrel.
The barrel pulls in Lingui macros through `error.ts`, and Electron main loads modules without the macro transform.

### Does NOT own (prevent scope creep)

- React UI or TanStack Query — `@koloda/app-react`, `@koloda/core-react`
- SRS domain / FSRS — `@koloda/srs`
- Persistence schema or repos — `@koloda/db-sqlite`, `koloda`
- Provider HTTP or error bridging — `@koloda/ai`
- The settings registry — `@koloda/settings`

## Read next

- `agents/ADD-HOTKEY.md` — hotkey schema changes (TS + Rust)
- `agents/DB.md` — settings and conversation tables
- `docs/specs/HOTKEYS.md` — hotkey behavior
- `agents/ADD-AI-PROVIDER.md` — AI settings slice when adding a provider
