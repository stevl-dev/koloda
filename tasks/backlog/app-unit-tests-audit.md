# Audit: unit tests of the apps (`apps/web`, `apps/electron`, `apps/electron-react`, `apps/mobile`)

Audited commit: `dc9c7bb7`.
Concern: test quality. Which tests protect behavior, which duplicate another test, which protect nothing,
and which behavior has no test at its own layer.

## Scope reviewed

- Included: every unit test file in the four apps, read in full:
  `apps/web/src` (6 files, 521 lines, 35 tests), `apps/electron/src` (11 files, 857 lines, 58 tests),
  `apps/electron-react/src` (8 files, 813 lines, 51 tests), and `apps/mobile/src` (8 files, 571 lines, 36 tests).
- Included: the source each test exercises (read in full where it holds a rule: `boot.ts`, `browser-support.ts`,
  `persistent-storage.ts`, `ai-runtime.ts` and `setup.ts` in web; `window-state.ts`, `app-sender.ts`,
  `ai-ipc.ts` in electron; `ai-runtime.ts`, `use-electron-zoom.ts` in electron-react), the three Vitest configs,
  `apps/mobile/jest.config.js`, and the apps' `project.json` test targets.
  Untested sources were listed and searched for `WHY` and `INVARIANT` comments.
- Included for second-door and coverage checks, by search only: `libs/core-react` tests, the Playwright specs in
  `apps/electron-e2e/src` and `apps/web-e2e/src`.
- Guides: `agents/AUDIT.md`, `agents/TESTING.md`, `agents/CODE-STYLE.md`, `agents/CODE-DOCUMENTATION.md` (headings),
  `agents/BACKWARDS-COMPATIBILITY.md`, `agents/REVIEW.md` (§Project-specific noise), `apps/mobile/README.md`
  (§Spike code, §Copies), and the `tasks/DEFERRED.md` entries under `apps/electron` and `apps/mobile`.
  `apps/electron/IPC.md` was not loaded; this report raises no IPC-drift finding.
- Specs: none loaded. This report raises no spec-violation finding.
- Out: the Playwright suites, the Rust addons (`src-rust`), non-test source quality, and the libraries.
- The target is one cross-cutting question over four packages: the TypeScript unit tests that live in apps.
  `apps/mobile` is spike code (`apps/mobile/README.md:3`, §Spike code), so findings against it are Later at most.
- Commands run:
  - `bunx vitest run --config apps/web/vitest.config.mjs --configLoader runner`: 6 files, 35 tests, all pass, 6.2 s.
  - `bunx vitest run --config apps/electron/vitest.config.mjs --configLoader runner`: 11 files, 58 tests, all pass,
    0.4 s.
  - `bunx vitest run --config apps/electron-react/vitest.config.mjs --configLoader runner`: 8 files, 51 tests, all
    pass, 9.8 s.
  - `bunx jest` in `apps/mobile`: 8 suites, 36 tests, all pass, 15.7 s.

No mutation was run. Claims that a broken line would still pass are from reading the cited tests.

## Verdict

The app suites are the leanest in the repository: almost every test pins a host rule (a hostile file, a redirect
cap, a race, a wire shape), and only a handful repeat a library test.
Nothing here is Must-fix.

The findings that matter most:

- The desktop main process's AI stream (`apps/electron/src/ai-ipc.ts`) has three written async rules and no unit
  test (§1).
- The desktop renderer's AI runtime drops events for other requests at one line that no test reaches (§2).
- A saved window position that no display shows falls back to the defaults, and no test covers it (§3).
- `agents/TESTING.md` and `agents/AUDIT.md` name app unit commands that leave out mobile, and the audit list leaves
  out web (§6).

On the removal side, about 3 of 180 tests repeat a library test or a neighbor (§4, §5).

## Strengths

Keep these as they are.

- `apps/electron/src/window-close-coordinator.test.ts` is a `agents/TESTING.md` exemplar: deadline at one millisecond
  short and at the limit, a late ack ignored, and dispose clearing the timer.
- `apps/electron/src/optimizer-ipc.test.ts` gates the run to prove progress goes only to the starting window while it
  is open, a closed window cancels the run, and a finished run stops watching.
- `apps/electron/src/media-ipc.test.ts` covers the image fetch at the cap and one byte past it (with the stream
  cancelled), five redirects and the sixth, relative redirects resolved per hop, a redirect to `file:`, and a body read
  aborted mid-flight.
- `navigation-policy.test.ts` covers lookalike hosts (`localhost:3000.evil.com`), a path outside the packaged index,
  and the Windows case rule.
  `koloda-db.test.ts` parses the NAPI class from Rust to keep the hand-written mirror honest.
- `ui-prefs.test.ts`, `window-state.test.ts:26`, and `startup-error.test.ts` are tables over hostile or malformed
  inputs, each row naming what it keeps.
- `apps/electron-react/src/app/sync-events.test.ts:38` parses the sync registry so a new kind fails until it refreshes
  screens; `project.json` lists the Rust file as an input.
- `apps/electron-react/src/app/ai-runtime.test.ts:213` gates the start to prove an abort during start is sent again
  for the same request. `optimizer-queries.test.ts` covers an abort before the run starts and during it.
- `apps/electron-react/src/app/ipc.test.ts` pins the wire codec at both safe-integer limits and one past, and keeps
  date-shaped strings that are not timestamp fields.
- `apps/web/src/app/ai.test.ts` names a Rust twin for each repository rule it shares, and
  `ai.integration.test.ts` states why it is a second door (the real lock).
- `apps/web/src/app/persistent-storage.test.ts` covers ask-once-more on the first gesture and a rejected or throwing
  storage API.
- `apps/mobile/README.md` (§Copies) lists every file copied from another app, including `src/host/wire.ts` and its
  test; the copies are deliberate and documented.

## Findings

### Risk

**1. The desktop main AI stream has no unit test — Should-fix**

`apps/electron/src/ai-ipc.ts` coordinates chat streams in the main process, and its comments state three rules:

- `:30`: concurrent streams are kept apart by `requestId`, and an abort cancels only its own run.
- `:176-191`: the run is registered before the secrets read, so an abort during that read reports `aborted` and the
  chat never starts.
- `:205-208`: only an `AbortError` counts as cancel, so a provider error that races an abort is reported as itself.

A search for `ai-ipc` over `apps` and `libs` test files finds nothing.
`apps/electron-e2e/src/assistant-chat.spec.ts:53` cancels one stream after it started, which covers none of the
three.
`agents/TESTING.md` (§Write tests for) asks for async coordination tests with forced interleavings.

Fix direction: add `apps/electron/src/ai-ipc.test.ts` in the shape of `optimizer-ipc.test.ts`: capture the
handlers, give `db` a gated secrets read, and stub the generation client.
Three cases, one per rule.

**2. The desktop renderer never sees another request's stream event in a test — Should-fix**

`apps/electron-react/src/app/ai-runtime.ts:53` drops every stream event whose `requestId` is not this chat's.
Every test in `ai-runtime.test.ts` emits events only for the request under test, so deleting that line passes them
all.
Every chat subscribes to the same `AI_STREAM_CHANNEL` (`waitForStream`, `:34-53`), so that line is all that keeps
two runs in flight apart.

Fix direction: in `ai-runtime.test.ts:43`, also emit a chunk and a `done` for another `requestId` before the real
ones, and assert neither reaches this chat.
`optimizer-queries.test.ts:66` already does this for optimizer progress.

**3. A window position no display shows is untested — Should-fix**

`apps/electron/src/window-state.ts:59-66` drops a saved window that overlaps no display, so a window last placed on an
unplugged monitor opens at the defaults.
`window-state.test.ts:12` mocks one 1920 × 1080 display, and every row of the table at `:26` places the window on it.
Inverting the overlap check, or dropping it, passes every test.
`agents/TESTING.md` (§Write tests for) asks for a threshold at the limit and one past it.

Fix direction: add rows to the table: an 800-wide window at `x: 1919` is kept, one at `x: 1920` falls back to the
defaults, and the same for `x: -799` and `x: -800`.

### Improvement

**4. A sync test that repeats the cache-refresh table — Later**

`apps/electron-react/src/app/sync-events.test.ts:43` checks which screens a `cards` change marks stale.
That is the `cards` row of `libs/core-react/src/lib/cache-refresh.test.ts:193` (§One home per behavior).
What `applySyncEvent` owns is passing the event's kinds on; one stale key and one fresh key show that.
`apps/mobile/src/host/sync-events.test.ts:21` is the same check in the mobile copy, already that small.

Fix direction: cut `sync-events.test.ts:43` to one key that goes stale and one that does not, and drop the comment
about template locks, which belongs to the library row.

**5. A test subsumed by its neighbor — Later**

`apps/electron-react/src/app/ai-runtime.test.ts:74` asserts the exact `cmd_ai_chat_stream` payload for a provided
`requestId`.
`:99` asserts the same payload with the same `requestId`, plus tools.
Fix direction: delete `:74` and rename `:99` to say it also uses the provided `requestId`.

**6. The guides name the wrong app unit commands — Later**

`package.json:15` defines `test:app-unit` as web, then electron, then `nx run @koloda/mobile:test` (Jest).
`agents/TESTING.md:214-215` says it runs the first two only.
`agents/AUDIT.md:66` (§Method) lists "Desktop unit" and no web or mobile unit command, so an audit of a web or mobile
host has no named command to run.
Fix direction: add the mobile step to `agents/TESTING.md:215`, and add "Web unit: `nx run @koloda/web:test-unit`" and
"Mobile unit: `nx run @koloda/mobile:test`" to the list in `agents/AUDIT.md`.

**7. Branches without a test — Later**

- `apps/web/src/app/browser-support.test.ts:71` covers missing IndexedDB; missing WebAssembly, the other half of
  `canRun`, has no row. The five `isChromiumBased` tests (`:8-58`) differ only by input; make them one table.
- `apps/web/src/app/ai-runtime.test.ts:46` asserts the fallback read resolves to any array.
  Assert the model ids the stub returned, so a fallback that returned an empty list fails.
- `apps/web/src/app/ai.test.ts:62` creates an Ollama profile with no key and asserts only that it resolves.
  Assert the stored profile has no key and `hasSecrets: false`.
- `apps/web/src/app/setup.ts:34` runs setup in one transaction so an interrupted setup leaves the status "blank".
  No test interrupts it.
- `apps/electron-react/src/app/use-electron-zoom.ts:13` ignores a stored level that is not a number; the mount table
  has a number and no value only.

Fix direction: one row or case each, in the file named.

## Deferred entries for the target

- `apps/electron`, the optimizer host reads the review history before checking the abort flag
  (Source: `tasks/archive/algorithms-audit.md`): still holds (`apps/electron/src-rust/src/optimizer.rs:61`).
  It is in the Rust addon, outside this audit's tests.
- `apps/mobile`, eight handoffs from `tasks/archive/mobile-spike.md` (device checks, the ruling, iOS, the raw-HTML
  rule, background sync, scroll inside the swipe, Android backup, the Keystore key race): none is about the unit
  tests, and none was resolved by them.
  `apps/mobile/src/cards/card-markdown.test.tsx:362` pins the spike's raw-HTML rule that the CARDS.md handoff names.

## Resolved deferred entries

none

## Prioritized recommendations

| # | Action | Severity | Effort | Impact |
| --- | --- | --- | --- | --- |
| 1 | Add `ai-ipc.test.ts` with one gated case per stream rule (§1) | Should-fix | Medium | The main-process stream races get their first tests |
| 2 | Emit another request's events in the renderer AI runtime test (§2) | Should-fix | Small | Stream isolation is tested |
| 3 | Add the off-display rows to the window-state table (§3) | Should-fix | Small | The unplugged-monitor fallback is tested at its edge |
| 4 | Fix the app unit commands in `agents/TESTING.md` and `agents/AUDIT.md` (§6) | Later | Small | Mobile and web unit tests are named where agents look |
| 5 | Trim the sync-event second door and delete the subsumed runtime test (§4, §5) | Later | Small | Two tests shrink to what they own |
| 6 | Add the missing branch cases (§7) | Later | Small | Fallbacks pinned |

Per `agents/TESTING.md` (§Repetition and tables), any replacement lands in the same change as the deletion it
replaces, so coverage never dips between commits.
