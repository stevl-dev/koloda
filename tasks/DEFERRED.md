# Deferred Work

Work that finished tasks left undone on purpose.
Each entry is a skipped or needs-decision finding, an open question, or a handoff.
It names the archived task file it came from, its evidence, and why it was deferred.

This is not the backlog.
Work the human intends to do is in `tasks/BACKLOG.md`, and an item is in one of the two files, never both.
Nothing here is promised or ranked.
An entry leaves when a change resolves it, when it moves to the backlog, or when it is dropped with a reason.

Entries are grouped under one heading per package directory.
`agents/TASKS.md` (§Deferred work) holds the rules for the entry shape and for adding, reading, and removing entries.

## apps/electron

- Handoff: the optimizer host reads the algorithm's whole review history before `optimize` checks the abort flag.
  Evidence: at `1c0661bb`, `apps/electron/src-rust/src/optimizer.rs:61` calls `get_optimization_input` first;
  the abort check is inside `optimize` (`crates/koloda/src/domain/optimizer.rs:196`).
  The outcome is right; only the read is wasted.
  Kind: handoff
  Source: `tasks/archive/algorithms-audit.md`
  Deferred because: seen in passing and not planned; no user sees it.

- Improvement, Later: no test runs the optimizer host's progress reporting, which reports only when progress moved.
  Evidence: at `b23dc2b7`, `apps/electron/src-rust/src/optimizer.rs:68` skips a report when `current` is unchanged;
  both host tests pass `|_, _| {}` on a history too small to train.
  Kind: skipped
  Source: `tasks/archive/rust-addons-tests-audit.md`, finding 1
  Deferred because: training a small history takes about 30 ms, under the 200 ms poll, so a test cannot reach the
  repeat check without control over timing.

## apps/mobile

- Handoff: run the Android device checks and record the mobile host verdict, with its measurements.
  Evidence: at `abb4c255`, `apps/mobile/README.md` (§Device checks) lists them; only item 5's checks have run,
  on the emulator.
  The verdict needs the hands-on checks on a phone: feel, swipe frame rate, and cold start in a release build.
  Kind: handoff
  Source: `tasks/archive/mobile-spike.md`, question 18
  Deferred because: the human deferred the checks to finish the spike's code (open question 18).

- Handoff: record the mobile host ruling in `docs/decisions/MOBILE-HOST.md` once the verdict is in.
  Evidence: at `abb4c255`, no such file exists; `tasks/archive/mobile-spike.md` item 11 says what it holds.
  Kind: handoff
  Source: `tasks/archive/mobile-spike.md`, question 18
  Deferred because: a ruling needs the go verdict the deferred checks give.

- Handoff: port the mobile app to iOS: the Swift Keychain vault, the iOS builds, and the device checks on an iPhone.
  Evidence: at `abb4c255`, `apps/mobile/app.json` lists Android only, and no Swift vault registers on iOS.
  It also answers whether uniffi-bindgen-react-native's async calls work on iOS.
  Kind: handoff
  Source: `tasks/archive/mobile-spike.md`, question 10
  Deferred because: no Mac with Xcode was available.

- Handoff: write the mobile app's raw-HTML rule into `docs/specs/CARDS.md` (§Rendered Markdown).
  Evidence: at `abb4c255`, `apps/mobile/src/cards/card-markdown.tsx` drops tags and shows their text, a spike rule.
  Kind: handoff
  Source: `tasks/archive/mobile-spike.md`, question 3
  Deferred because: the lasting rule belongs to the follow-up that builds the real app.

- Handoff: background sync on mobile through the engine's `tick` (WorkManager, BGTaskScheduler).
  Evidence: at `abb4c255`, the app syncs only in the foreground; Android freezes the runner in the background.
  Kind: handoff
  Source: `tasks/archive/mobile-spike.md`, question 4
  Deferred because: it does not gate the verdict and is the same code under any host.

- Handoff: check on a device whether scrolling a long revealed card grades it on the mobile lesson screen.
  Evidence: at `43710036`, `apps/mobile/src/lesson/lesson-card.tsx:52` puts a vertical `ScrollView` inside the pan of
  `apps/mobile/src/lesson/swipeable-card.tsx:42`, where a swipe down is Hard and a swipe up is Easy.
  Kind: handoff
  Source: `tasks/archive/mobile-spike.md`
  Deferred because: found in a review after the task was archived; it needs a device, and the lesson screen is spike code.

- Handoff: decide what Android backup restores for the mobile app.
  Evidence: at `43710036`, the prebuilt manifest sets `android:allowBackup="true"` and `apps/mobile/app.json` does not
  turn it off.
  A restore onto another phone would bring back `koloda.db` with its device identity, and the encrypted preferences
  of `apps/mobile/modules/koloda-secrets` without the Keystore key that decrypts them.
  Kind: handoff
  Source: `tasks/archive/mobile-spike.md`
  Deferred because: found in a review after the task was archived; the spike ships nowhere.

- Handoff: make the mobile card readable in dark mode, and decide how far the app follows the dark scheme.
  Evidence: at `0c7f9de5`, `apps/mobile/src/cards/markdown-colors.ts:19` sets light text for dark mode, while the debug
  screen and its header stay light (`apps/mobile/src/app/debug.tsx`); device check 8 fails on the emulator in dark mode.
  Kind: handoff
  Source: `tasks/archive/mobile-spike.md`
  Deferred because: found in the device checks after the task was archived; the fix needs a choice between a card
  surface and dark screens across the app, and the human will take it in another session.

- Handoff: show which grade each swipe direction gives, during the drag and after the reveal.
  Evidence: at `0c7f9de5`, `apps/mobile/src/lesson/swipeable-card.tsx:11–16` maps left to Again, down to Hard, right to
  Good, and up to Easy; nothing on screen shows the mapping, so device check 10 fails on the emulator for this.
  Kind: handoff
  Source: `tasks/archive/mobile-spike.md`
  Deferred because: found in the device checks after the task was archived; the human judged it outside the spike, which
  tests the stack, not the app's gesture design.

## crates/koloda-server

- Handoff: ending a lease scans `versions` once per lease.
  Evidence: at `1c0661bb`, `end_lease` (`crates/koloda-server/src/log.rs:565-570`) runs `LEASE_ONLY_VERSIONS`
  (`:44-51`), a `DELETE FROM versions WHERE EXISTS (…)` over the whole table.
  It is linear since `sync-audit-fixes` R1, no longer quadratic.
  Kind: handoff
  Source: `tasks/archive/sync-audit-fixes.md`
  Deferred because: noticed as a follow-up; `sync-desktop-ui` left it out of scope.

- Risk, Later: the fork fallback's success arm is untested.
  Evidence: at `851b81c0`, `crates/koloda-server/src/devices.rs:152-154`: a fork that lost the unique index returns
  the winner's device. It runs only when two forks with one nonce and token interleave between `same_fork` and
  `insert_fork`, and no test forces that.
  The refusal arm (another token for the nonce) runs in the fork retry test in `tests/server/devices_tests.rs`.
  Kind: skipped
  Source: `tasks/archive/sync-proto-server-tests-audit.md`, finding 4
  Deferred because: forcing the race needs a seam in `fork_device`, which integration tests reach only by a feature.

- Product decision, Later: 100 wrong pairing codes a minute, server-wide, lock pairing for every space.
  Evidence: at `3e7db94e`, `crates/koloda-server/src/pairing.rs:29-31` and `:256-272`: ten addresses at two wrong
  codes a second keep previews and claims refused for all spaces, with no token.
  Kind: skipped
  Source: `tasks/archive/sync-correctness-security.md`, finding 9
  Deferred because: `crates/koloda-sync-proto/PROTOCOL.md` §Pairing states the limit and accepts it.

## crates/koloda-sync

- Risk, Later: a bootstrap under a bounded tick restarts each tick, so a snapshot past one tick's budget never ends.
  Evidence: at `1c0661bb`, `crates/koloda-sync-proto/PROTOCOL.md:1375-1377` states the limit;
  the desktop host does not call `Engine::tick`.
  The report gave R findings no severity.
  Kind: skipped
  Source: `tasks/archive/sync-audit-fixes.md`, finding R2
  Deferred because: deferred to the mobile host, whose background ticks are usually further apart than the lease TTL.

- Handoff: no test forces an upload nudge to land between a fetch's `404` and its deferral.
  Evidence: at `1c0661bb`, the engine releases waiting fetches after a running cycle ends
  (`crates/koloda-sync/src/attachments.rs:136`); the harness has no hook between the `404` and the deferral.
  Kind: handoff
  Source: `tasks/archive/sync-late-images.md`
  Deferred because: listed under Not checked; the harness lacks the seam.

- Handoff: `import` and a join's first probe still fail once with `Restored` after a server restore.
  Evidence: at `162eced7`, `crates/koloda-sync/src/pairing.rs:339` and `:358` call `probe` with no repeat, and
  Replace calls the device route directly (`pairing.rs:365`).
  Routing `probe` through `call_across_restore` needs a fetch mode, since the cycle calls it too (`cycle.rs:48`).
  Kind: handoff
  Source: `tasks/archive/sync-engine-architecture.md`
  Deferred because: found in review of item 4, outside the three host calls the task carried across a restore.

- Improvement, Later: a pending credential is stored two ways.
  Evidence: at `162eced7`, a claim or a creation keeps its nonce in `sync_enrolling`
  (`crates/koloda/src/repo/sync/mod.rs:131-229`); a fork keeps it in `sync_state.fork_nonce`
  (`crates/koloda/src/repo/sync/switch.rs:74-97`, `crates/koloda-sync/src/fork.rs`).
  Both pair it with `sync.pending_token.<nonce>`.
  The architecture review gave findings no classification or severity.
  Kind: skipped
  Source: `tasks/archive/sync-engine-architecture.md`, finding 3
  Deferred because: no archived finding or fix commit traces to the difference, and the review proposed nothing.

- Improvement, Later: `crates/koloda-sync/src/engine.rs` is the hot file.
  Evidence: at `99e4fdf2`, it changed in 35 of 62 engine-source commits; 12 of those touched 6 or more engine files.
  The architecture review gave findings no classification or severity.
  Kind: skipped
  Source: `tasks/archive/sync-engine-architecture.md`, finding 5
  Deferred because: the review proposed nothing; the task took the cycle-ending and restore jobs out of it.

## crates/koloda-sync-proto

- Improvement, Later: `PROTOCOL.md` moves with nearly every engine change.
  Evidence: at `99e4fdf2`, 55 of 62 engine-source commits (89%) edit `crates/koloda-sync-proto/PROTOCOL.md`,
  and 127 of the sync area's 187; the file has 2,050 lines at `162eced7`.
  The architecture review gave findings no classification or severity.
  Kind: skipped
  Source: `tasks/archive/sync-engine-architecture.md`, finding 6
  Deferred because: splitting the contract is a protocol-area question, outside the reviewed area.

- Handoff: deletes cascade in one transaction; chunked `sync_delete_jobs` are a later optimization.
  Evidence: at `1c0661bb`, `crates/koloda-sync-proto/PROTOCOL.md:474`, `:528`, and `:1869` say chunked deletes may come
  later; until then a space below its disk reserve refuses every push, deletes included (`sync-holds` Outcome).
  Kind: handoff
  Source: `tasks/archive/sync-apply.md`
  Deferred because: a later scale task; v1 accepts the cost under the writer lock.

- Handoff: a per-device download policy for images (always, on unmetered networks, on demand).
  Evidence: at `1c0661bb`, `crates/koloda-sync-proto/PROTOCOL.md:1757-1758`: "Until device policy exists, every queued
  fetch runs."
  Kind: handoff
  Source: `tasks/archive/media-audit.md`
  Deferred because: left for the mobile phase (`sync-transport` Out).

## libs/ai

- Handoff: confirm that Anthropic's Models API sends `capabilities.pdf_input`; without it, Claude models are unknown for PDF.
  Evidence: at `04e88bb5`, `libs/ai/src/lib/providers/anthropic.ts` reads `capabilities.pdf_input.supported`,
  named after `image_input`; the Models API page could not be fetched to confirm the field.
  Kind: handoff
  Source: `tasks/archive/assistant-file-attachments.md`
  Deferred because: the docs page was unreachable; a live list response settles it, and the "Accepts PDF" switch covers it.

## libs/app-react

- Risk, Later: the boot language is activated twice, once by each host store and once by `AppProviders`.
  Evidence: at `1c0661bb`, `apps/web/src/app/store.ts:18-23` and `apps/electron-react/src/app/store.ts:32-35`
  activate at module load; `libs/app-react/src/lib/app-providers.tsx:96` activates again to learn when it is ready.
  Kind: skipped
  Source: `tasks/archive/app-audit.md`, finding 2
  Deferred because: the second call only re-runs `i18n.load` and `activate` on cached messages, and removing it needs a
  new `AppProviders` API or a reorder in both host stores.

## libs/assistant-react

- Handoff: apply a language that `change_settings` saved while its run was canceled to the open app.
  Evidence: at `234731c3`, `libs/assistant-react/src/lib/runs/settings-change-notification.ts` passes unknown values
  when a run ends mid-save, and the shell then refreshes the rows without setting `langAtom`, which the saved row
  never feeds (`libs/app-react/src/lib/hooks/use-global-sync.ts`).
  Kind: handoff
  Source: `tasks/archive/assistant-change-settings.md`
  Deferred because: a cancel landing during the save is rare; the call's input is unchecked, so it cannot be applied.

- Improvement, Later: a run's terminal status enters the store from the UI or the shell, then again from the engine.
  Evidence: at `467d8b36`, user cancel writes `cancelRun` and `markRead` itself
  (`libs/assistant-react/src/lib/runs/use-assistant-session.ts:74-78`), and shutdown writes `interruptRun`
  (`runs/use-assistant-engine-host.ts:20-21`); the engine then repeats it, and `transitionRun` ignores the repeat
  (`state/conversation-run-lifecycle.ts:58`).
  Retry eligibility is checked three times: `hasRetryableTurn` (`runs/use-run-orchestration.ts:63`),
  an untyped read in `libs/assistant/src/lib/conversation-runtime.ts:279-281`, and `transitionRun`.
  The architecture review gave findings no classification or severity.
  Kind: skipped
  Source: `tasks/archive/assistant-chat-runs-architecture.md`, finding F1
  Deferred because: the duplicate writes are harmless; take it when a change to cancel or shutdown is planned.

- Improvement, Later: outside the engine path, marking a conversation dirty is still a manual touch beside each change.
  Evidence: at `467d8b36`, 39 lines in 8 non-test files of `libs/assistant-react/src` name a touch helper,
  imports and definitions included; the restore path touches four times (`persistence/use-conversation-restore.ts`).
  The architecture review gave findings no classification or severity.
  Kind: skipped
  Source: `tasks/archive/assistant-chat-runs-architecture.md`, finding F3
  Deferred because: dirty derived from `conversationsAtom` identity was not taken (`agents/ASSISTANT-MAP.md`).

- Improvement, Later: four `persistence/` files import from `runs/`, and the shell keeps four module slots.
  Evidence: at `467d8b36`, `libs/assistant-react/src/lib/persistence/conversation-write-adapter.ts:3-5`,
  `use-conversation-persistence.ts:3`, `use-conversation-restore.ts:6` and `use-conversation-save-host.ts:11-12`
  import `runs/assistant-engine-instance.ts` or `runs/assistant-persistence-host.ts`.
  The architecture review gave findings no classification or severity.
  Kind: skipped
  Source: `tasks/archive/assistant-chat-runs-architecture.md`, finding F4
  Deferred because: the human kept the import direction and the module slots; the map now names the host's file.

- Improvement, Later: the engine event adapter knows one tool by name.
  Evidence: at `467d8b36`, `libs/assistant-react/src/lib/runs/add-deck-query-invalidation.ts:35` checks
  `ASSISTANT_TOOL_SPECS.add_deck.name`.
  The architecture review gave findings no classification or severity.
  Kind: skipped
  Source: `tasks/archive/assistant-chat-runs-architecture.md`, finding F4
  Deferred because: the review called it a note, not a finding to act on.

## libs/db-sqlite

- Improvement, Later: web keeps a second implementation of every repo, and audit after audit finds a host-only defect.
  Evidence: at `99e4fdf2`, `libs/db-sqlite` has 1,718 source lines and 3,464 test lines.
  Host-difference findings appear in 12 audits.
  The web-only defects include templates T5, cards C11, and host-desync HD1.
  26 of the 80 commits that touch `libs/db-sqlite/src` also touch the Rust side.
  Kind: skipped
  Source: `tasks/archive/host-persistence-architecture.md`, finding F3
  Deferred because: shared `.sql` files fit no read both hosts run (§Rejected designs of
  `docs/decisions/TS-RUST-DOMAIN-MIRRORING.md`), and a WASM `koloda` for web needs a new decision.
  Rule disagreements are covered by the shared rule cases.

## libs/e2e

- Improvement, Later: the two AI-mock transports repeat the response decision, and hold differently after a cancel.
  Evidence: at `1c0661bb`, `apps/web-e2e/src/mock-openai-compatible.ts` and
  `apps/electron-e2e/src/mock-openai-compatible.ts` each decide the response.
  Only the desktop hold ends on a client abort (`waitForHoldOrAbort`, `:116`), so `isHolding()` differs after a cancel
  (web `:172`, desktop `:148`).
  Kind: skipped
  Source: `tasks/archive/e2e-suites-audit.md`, finding 17
  Deferred because: no test reads `isHolding()` after a cancel; then move the decision into `libs/e2e`.

## libs/srs-react

- Improvement, Later: the prepare-error wait in `useLessonSession` has no test that can fail.
  Evidence: at `959aefc1`, `libs/srs-react/src/lib/lessons/use-lesson-session.ts:159` skips a query that is
  fetching; a retrying query reports no error, and a refetch after a close passed with the check removed.
  Kind: skipped
  Source: `tasks/archive/srs-react-settings-react-tests-audit.md`, finding 9
  Deferred because: no reachable state was found in which the check decides anything; it may be dead.

- Handoff: the four editors' `*_SYNC_GROUPS` lists mirror the Rust field-group registry with nothing that ties them.
  Evidence: at `1c0661bb`, `libs/srs-react/src/lib/cards/card-details.tsx:39`, `algorithms/algorithm.tsx:29`,
  `decks/deck-details.tsx:17`, and `templates/template.tsx:29`; no test reads them.
  Kind: handoff
  Source: `tasks/archive/entity-forms-architecture.md`, finding F5
  Deferred because: the review proposed nothing here; the host-persistence review's shared case tables are the place.

- Handoff: the whole-number format is one value written in two packages.
  Evidence: at `1c0661bb`, `WHOLE_NUMBER_FORMAT` (`libs/srs-react/src/lib/algorithms/algorithm-learning-steps.tsx:11`)
  and `wholeNumberFormatOptions` (`libs/settings-react/src/lib/settings-learning.tsx:18`).
  Kind: handoff
  Source: `tasks/archive/entity-forms-architecture.md`, finding F5
  Deferred because: audit-sized; left for the next audit of either package.

## libs/ui

- Improvement, Later: the tooltip surface measures itself after every render.
  Evidence: at `1c0661bb`, `libs/ui/src/lib/primitives/overlay/tooltip/tooltip-surface.tsx:42-44` has a layout effect
  with no dependency list, and no comment says why.
  Kind: skipped
  Source: `tasks/archive/ui-audit.md`, finding 17
  Deferred because: React Aria moves the arrow by re-rendering with a new offset, which a dependency list or the
  `ResizeObserver` would miss; it runs only while a tooltip is open.

- Improvement, Later: `motionSettingAtom` is typed `string`, with `""` as a sentinel.
  Evidence: at `1c0661bb`, `libs/ui/src/lib/hooks/use-motion-settings.ts:5` is `atom("")`.
  Any value but `"on"` or `"off"` means System, and `libs/settings-react/src/lib/wire-ui-preferences.ts:75` relies on
  `""` as "not wired yet".
  Kind: skipped
  Source: `tasks/archive/ui-audit.md`, finding 25
  Deferred because: `@koloda/app` has no motion union to type it with, its sibling atoms are untyped too, and moving it
  to `core-react` has no concrete payoff.

## Repository

- Improvement, Later: the desktop command path restates the data command list in eight files.
  Evidence: at `99e4fdf2`, `updateTemplate` is written by hand in ten places; six of them, from
  `apps/electron-react/src/app/queries.ts:136` to `apps/electron/src-rust/src/lib.rs:482`, forward the same payload.
  Adding the attachment commands touched all eight files in each of `5cce133d`, `aba158b9`, and `b6714ae7`.
  Data commands use three argument conventions (`apps/electron/IPC.md:24`), and every NAPI method takes and returns
  `serde_json::Value`.
  Options: A, do nothing; B, one argument convention, `KolodaDb` derived from `DataIpc`, and one forwarder in main
  (about 4 commits, roughly −250 lines); C, one typed dispatch in Rust with TS types generated from it
  (about 10 commits, a new dependency, reverses `ipc-typed-contract`).
  Kind: needs-decision
  Source: `tasks/archive/host-persistence-architecture.md`, finding F4
  Deferred because: wait for the mobile host verdict, still pending after `mobile-spike`; a go keeps a second Rust
  façade over the command list,
  which is evidence for C that B would have to be redone against.

- Risk, Later: the conversation list query loads every conversation's full state on both hosts.
  Evidence: at `1c0661bb`, web selects and parses `state` per row (`libs/db-sqlite/src/lib/conversations.ts:20-28`), and
  desktop derives `hasTurns` in the renderer from every full row (`apps/electron-react/src/app/queries.ts:70`).
  Kind: skipped
  Source: `tasks/archive/assistant-conversation-list-audit.md`, finding 10
  Deferred because: no cost is measured, and a summary column should cover `hasTurns` and `isUnread` at once, with a
  schema change on both hosts (question 3).
