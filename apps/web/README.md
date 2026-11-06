# @koloda/web

Browser host of the app: the full UI running on in-browser SQLite (`wa-sqlite`) with no server.
Data, settings, and AI profiles all live in the browser profile through IndexedDB.
Role: demo, published as the live demo (see `docs/decisions/APP-ROLES.md`).

## Where it sits

Assembles the `@koloda/app-react` screens on a SQLite-backed data layer.
It is the deployable web build; `apps/web-e2e` drives it with Playwright.
Persistence uses the same product SQL as the desktop SQLite core through `@koloda/db-sqlite`.
See `docs/decisions/TS-RUST-DOMAIN-MIRRORING.md` (§Persistence owners).

## How to run

- `nx run @koloda/web:serve` — dev server at `localhost:3000`
- `nx run @koloda/web:build` — production build to `dist/apps/web`; `VITE_BASE` sets the base path
  (`/` is appended if missing)
- `nx run @koloda/web:preview` — serve the production build
- `nx run @koloda/web:test-unit` — unit tests
- `nx run @koloda/web:test` — Playwright e2e (config lives in `apps/web-e2e`)
- `nx run @koloda/web:lingui-extract` / `@koloda/web:lingui-compile` — locale catalogs
- `nx run @koloda/web:linge` — shorthand for `lingui-extract --clean`

## Architectural Map

- Entry: `src/main.tsx` — mounts `AppProviders` from `@koloda/app-react` with the store and i18n,
  or the startup error screen when `src/app/boot.ts` reports an unsupported browser or a failed store load.
- Store wiring: `src/app/store.ts` — jotai store, UI preferences,
  locale detection (stored lang, then navigator), web AI runtime.
- Database: `src/app/db.ts` — opens `wa-sqlite` + `IDBBatchAtomicVFS` at IndexedDB `koloda`; migrations run from setup.
- Queries: `src/app/queries.ts` — the `Queries` contract implemented in-process via `@koloda/db-sqlite`.
- Setup: `src/app/setup.ts` — status check, migrations (`crates/koloda/src/migrations`), and the one-transaction
  first setup with seed content; a set-up status requests persistent storage.
- Persistent storage: `src/app/persistent-storage.ts` — asks the browser to keep the data; a refusal retries on the
  first gesture.
- i18n: `src/app/i18n.ts` — device language detection and catalog loading from `src/app/locales/`.
- Seed content: `src/app/seed/<locale>/` — starter algorithms, templates, and decks per language.
- AI: `src/app/ai.ts` — profiles persisted in the ai settings slice, secrets redacted on read.
- AI runtime: `src/app/ai-runtime.ts` — browser AI runtime with an in-process tool executor over the same database.
- Browser support: `src/app/browser-support.ts` — IndexedDB and WASM required; Chromium-based recommended.
- Chrome: `src/components/` — app entry with the blank-database setup gate, first-setup overlay, incompatible-data
  screen, startup error screen, titlebar.

### Does NOT own (prevent scope creep)

- Screens, routes — `@koloda/app-react`; settings screens and setup pickers — `@koloda/settings-react`
- Domain and scheduling — `@koloda/srs`; persistence schema — `crates/koloda` (run here through `@koloda/db-sqlite`)
- The desktop Electron host — `apps/electron` and `apps/electron-react`
- E2E harness — `apps/web-e2e`

## Read next

- `docs/decisions/TS-RUST-DOMAIN-MIRRORING.md` — why two persistence owners exist
- `docs/specs/` — behavior specs
- `agents/I18N.md` — locale workflow
