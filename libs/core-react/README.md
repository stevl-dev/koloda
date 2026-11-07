# @koloda/core-react

Shared React infrastructure: the `Queries` contract, TanStack Query key factory,
global Jotai atoms, and hotkey registration hooks.
No feature screens and no concrete DB backends.

## Where it sits

Consumed by `@koloda/app-react`, `@koloda/srs-react`, `@koloda/assistant-react`, `@koloda/settings-react`,
`@koloda/ai-react`, `@koloda/ui` (form/overlay/titlebar hotkeys), and the apps.
Each app sets `queriesAtom` and `aiRuntimeAtom` with its own implementations before the first render.
Depends on `@koloda/app`, `@koloda/srs`, `@koloda/ai`, and `@koloda/settings`, mostly for types.
It also takes the hotkey defaults and validation and the timestamp and number formatting from `@koloda/app`.
Web implements `Queries` with `@koloda/db-sqlite`; desktop implements it via Electron `invoke` → `koloda`.

## Architectural Map

- Query contract: `queries.ts` — `Queries` (settings, conversations, algorithms, templates, decks,
  cards, lessons, reviews, attachments, AI profiles) and `queriesAtom`.
- Query keys: `query-keys.ts` — centralized key builders, their invalidation prefixes, and `AppStatus`;
  `invalidate-deck-queries.ts` — the refresh after a deck is added, shared by the add dialog and the assistant.
- Atoms: `atoms.ts` — scheme, themes, date and time formats, language, default algorithm and template,
  `aiProvidersAtom`, `appEntryAtom`;
  `ai-runtime.ts` — `aiRuntimeAtom` (host-injected `AIRuntime`; the AIRuntime seam);
  `attachment-from-url.ts` — `addAttachmentFromUrlAtom` (set only by the desktop app);
  `sync.ts` — `syncQueriesAtom`, the sync engine's calls, and `fetchedAttachmentsAtom`, the images it downloaded
  (both set only by the desktop app);
  `optimizer.ts` — `optimizerQueriesAtom`, FSRS optimization runs and apply (set only by the desktop app).
- Hotkeys: `hooks/use-app-hotkey.ts` — registration via TanStack Hotkeys;
  `use-hotkeys-status.ts` — runtime scope holds; `use-hotkeys-settings.ts` — the user's bindings.
- Misc: `hooks/use-timestamp-formatter.ts` (dates and times in the user's formats),
  `hooks/use-number-formatter.ts` (numbers in the interface language),
  `utility.ts` (`dispatchReducerAction`).

### Does NOT own (prevent scope creep)

- Concrete query implementations — each app's `queries.ts`
- UI primitives / layout chrome — `@koloda/ui` (may call these hotkey hooks; that is intentional)
- SRS / assistant / settings feature UI — `@koloda/srs-react`, `@koloda/assistant-react`, `@koloda/settings-react`
- DB repos or schema — `@koloda/db-sqlite`, `koloda`

## Read next

- `docs/decisions/TS-RUST-DOMAIN-MIRRORING.md` (§Persistence owners)
  — why each app injects a different `Queries` backend
- `agents/ADD-HOTKEY.md` — `useAppHotkey` patterns
- `docs/specs/HOTKEYS.md` — hotkey behavior
- `agents/LAYOUT.md` — interface settings synced through atoms
