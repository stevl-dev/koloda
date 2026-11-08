# e2e

Shared Playwright support code for the two e2e suites, `apps/web-e2e` (web) and
`apps/electron-e2e` (desktop). The suites drive the same app UI, so the
page flows and the AI-mock wire format are defined once here; only the platform
differences live in the suites themselves.

## Where it sits

Tagged `type:e2e`: only the e2e apps import it, nothing runtime depends on it,
and it must never gain runtime dependencies.

## Architectural Map

- UI flows: `src/ui-flows.ts` — the shared CRUD, lesson, settings, hotkey, AI profile, and
  assistant flows every spec composes. The one deliberate parameter point:
  `applyPageDefaults(page, when)` (`before-load` init script vs `after-load`
  evaluate + reload). First setup differs per host, so each suite's `helpers.ts`
  owns its own flow.
- AI mock protocol: `src/ai-mock.ts` — the `Mock*Options`/`Handle` contracts and
  the OpenAI-compatible SSE/JSON builders, transport-independent.
- Barrel: `src/index.ts` — the only public door.

### Does NOT own (prevent scope creep)

- Suite launch (`playwright.config.ts`, web server, Electron shell) — each suite
- The AI-mock transport — each suite; only the wire format lives here
- First setup — each suite's `helpers.ts`

The reasons are under (§What stays per-suite).

## What stays per-suite (on purpose)

- `playwright.config.ts` and the launch layer: web boots a vite `webServer`;
  Electron launches the real shell via `_electron.launch` with an isolated
  `KOLODA_USER_DATA`.
- The AI-mock transport around `src/ai-mock.ts`: web uses `page.route` plus a
  page-side SSE re-streamer; Electron uses a real Node HTTP server because
  main-process AI fetch is invisible to route interception.
- The suites' `helpers.ts` facades re-export the shared flows and wrap the
  parameter points, so spec files import platform-local names.

## Read next

- `apps/web-e2e/README.md` and `apps/electron-e2e/README.md` — the consumers
