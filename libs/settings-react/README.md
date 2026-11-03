# @koloda/settings-react

Global settings screens: interface, learning, hotkeys, AI profiles, and the setup pickers that edit those rows.

## Where it sits

Consumed by `@koloda/app-react` routes and by `apps/web` / `apps/electron-react` setup screens.
Depends on `@koloda/settings`, `@koloda/app`, `@koloda/ai`, `@koloda/ai-react`,
`@koloda/core-react`, `@koloda/srs-react`, and `@koloda/ui`.
The Zod registry stays in `@koloda/settings`; this package owns the forms that edit those rows.

## Architectural Map

- Interface: `settings-interface.tsx`, `interface-controls/` — language, scheme, theme, motion, and date and time
  format controls; `use-interface-setting-write.ts` is the one write path for the interface row.
- UI preferences: `wire-ui-preferences.ts` — `wireUiPreferences` puts scheme, both themes, and motion into atoms and
  `<html>`; `ui-preferences-cache.ts` keeps them in `localStorage`. Each app calls it once from its store.
  `public/theme-boot.js` applies that cache before CSS loads, so the last theme paints first;
  the `theme-boot` Vite plugin (`tools/vite-plugin-theme-boot.ts`) serves it to each app.
- Learning: `settings-learning.tsx` — defaults, limits, and day-boundary form.
- Hotkeys: `settings-hotkeys.tsx`, `settings-hotkeys-hotkey.tsx` — scoped hotkey editor.
- AI profiles: `settings-ai.tsx` plus add/edit/delete/models dialogs;
  `ai-providers/` per-provider forms; `ai-profile-models-allowlist.ts`.
- Sync (desktop only): `sync/` — over the host's `syncQueriesAtom`: Settings → Sync (create, join with Add or Replace,
  invite, devices, status, and why sync stopped), the first-run join `SyncFirstRunJoin`, and the title bar's
  `SyncIndicator`.

### Does NOT own (prevent scope creep)

- Zod registry / DTOs — `@koloda/settings`
- Domain schemas — `@koloda/app`, `@koloda/ai`
- Persistence — `@koloda/db-sqlite`, `koloda`
- Routes, `useGlobalSync`, global hotkey wiring — `@koloda/app-react`
- Conversation-level assistant settings (prompt/temperature) — `@koloda/assistant-react`
- Layout primitives — `@koloda/ui`

## Read next

- `agents/ADD-AI-PROVIDER.md` — provider form files in this package
- `agents/ADD-HOTKEY.md` — hotkey schema changes (TS + Rust)
- `agents/ADD-COLOR-THEME.md` — theme CSS; the pickers and `theme-boot.js` live here
- `docs/specs/INTERFACE-SETTINGS.md`
- `docs/specs/LEARNING-SETTINGS.md`
- `docs/specs/HOTKEYS.md`
- `agents/I18N.md` — strings in feature UI
