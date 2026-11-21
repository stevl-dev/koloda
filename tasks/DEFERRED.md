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

- Handoff: `KeystoreVault.key()` can generate the Keystore key twice when two first calls race.
  Evidence: at `43710036`,
  `apps/mobile/modules/koloda-secrets/android/src/main/java/expo/modules/kolodasecrets/KeystoreVault.kt:47` reads and
  then generates the key with no lock; the second key replaces the first, and what the first encrypted is lost.
  Kind: handoff
  Source: `tasks/archive/mobile-spike.md`
  Deferred because: found in a review after the task was archived; it cannot be checked without the Android build.

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

- Handoff: show a change synced from another device when the app returns to the foreground, without a force-quit.
  Evidence: at `0c7f9de5`, a card created on desktop reached the phone (server `cards` 2, the phone's hot cursor 17),
  but the Lessons list did not show it after the app was foregrounded; it showed after a force-quit and relaunch.
  `refreshKinds` (`libs/core-react/src/lib/cache-refresh.ts:47`) maps `cards` to the lessons queries that
  `apps/mobile/src/components/lessons-list.tsx` reads, so the cause is not in that mapping; it is not found.
  Kind: handoff
  Source: `tasks/archive/mobile-spike.md`
  Deferred because: found in the device checks after the task was archived; the human deferred the cause to a later
  session. Until it is fixed, "a review on either device shows on the other" is not met.

## crates/koloda

- Improvement, Should-fix: no test cancels an optimizer run during training or scoring.
  Evidence: at `1c0661bb`, `crates/koloda/tests/domain/optimizer_tests.rs:287` tests only an abort set before the run.
  Kind: skipped
  Source: `tasks/archive/algorithms-audit.md`, finding A9
  Deferred because: the `fsrs` crate has no hook between batches.
  A test would order the abort by sleeping or polling, which `agents/TESTING.md` bans.

- Improvement, Later: the desktop today-totals repo test reads the real clock.
  Evidence: at `1c0661bb`, `get_todays_review_totals` reaches `Local::now()`
  (`crates/koloda/src/domain/learning_day.rs:43`), and
  `crates/koloda/tests/integration/reviews_integration_tests.rs:13-15` takes the current timestamp.
  Kind: skipped
  Source: `tasks/archive/learning-settings-audit.md`, finding LS5
  Deferred because: the domain DST suites on both hosts pin the window.
  A repo clock seam only for this test is not worth it.

- Risk, Should-fix: no test interleaves a template update with a write between the lock check and the update.
  Evidence: at `1c0661bb`, the check runs inside the transaction (`crates/koloda/src/repo/templates.rs:233-246`,
  web twin `libs/db-sqlite/src/lib/templates.ts`), and `templates_integration_tests.rs` has no interleaving case.
  Kind: skipped
  Source: `tasks/archive/templates-audit.md`, finding T4
  Deferred because: neither repo has a seam between its read and its write, and the delete twin has no such test either.

- Handoff: Rust `update_template` keeps a `let Some(stored) = stored else` branch that cannot run.
  Evidence: at `1c0661bb`, `crates/koloda/src/repo/templates.rs:248` reads the row that `:236` already found in the same
  transaction, so the `else` at `:263-265` is unreachable.
  Kind: handoff
  Source: `tasks/archive/templates-audit.md`
  Deferred because: seen in passing and not planned.

- Handoff: sync apply stores card content as received, without dropping keys outside the card's template.
  Evidence: at `1c0661bb`, local writes keep only template fields
  (`template_content`, `crates/koloda/src/repo/cards.rs:233`, `:291`; CARDS.md §Card Content).
  Apply writes the payload's content as is (`crates/koloda/src/repo/sync/apply.rs:704`).
  Kind: handoff
  Source: `tasks/archive/cards-audit.md`
  Deferred because: the cards audit changed only local writes.

- Handoff: `join_mode` reads a file with sync state but no settings rows as blank.
  Evidence: at `1c0661bb`, `crates/koloda/src/repo/sync/join.rs:81-83` returns `JoinMode::Blank` when `settings`
  is empty.
  Real files always have settings.
  Kind: handoff
  Source: `tasks/archive/sync-audit-fixes.md`
  Deferred because: noticed as a follow-up; `sync-desktop-ui` left it out of scope.

- Product decision, Later: an API key may go to a plain-http base URL on another host.
  Evidence: at `537bfe0d`, `require_base_url` accepts any URL that parses (`crates/koloda/src/domain/ai.rs:261-270`).
  The optional key of an Ollama, LM Studio, or OpenAI-compatible profile is sent to it.
  `docs/specs/AI-PROVIDERS.md` §Validation asks only for a valid URL.
  Kind: skipped
  Source: `tasks/archive/koloda-correctness-security.md`, finding 6
  Deferred because: refusing breaks Ollama, LM Studio, vLLM, and LiteLLM on another machine of the local network.
  Every `ai` write validates every profile, so one stored profile would also fail later AI settings saves.

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

- Handoff: let the assistant read lesson and progress statistics, such as why only 10 new cards show today.
  Evidence: at `daa0ad62`, `docs/specs/ASSISTANT-DATA-ACCESS.md:90` says scheduling statistics and lesson history are not read.
  Kind: handoff
  Source: `tasks/archive/assistant-self-awareness.md`
  Deferred because: the human left it out of the self-awareness task; it needs its own read of lesson data.

- Handoff: give assistant answers in-app deep links to the screen where a setting or feature lives.
  Evidence: at `daa0ad62`, `libs/ai/src/lib/assistant-tools.ts:367` tells the model to say where the user changes settings,
  because no link exists.
  Kind: handoff
  Source: `tasks/archive/assistant-self-awareness.md`
  Deferred because: the human left it out of the self-awareness task; the first version reads only and does not act.

- Handoff: add a `propose_settings_change` tool, so the assistant can propose a settings change for the user to apply.
  Evidence: at `daa0ad62`, `libs/ai/src/lib/assistant-tools.ts:367` says the settings tool cannot change settings.
  Kind: handoff
  Source: `tasks/archive/assistant-self-awareness.md`
  Deferred because: the human left it out of the self-awareness task; it is an action, and the first version reads only.

- Handoff: let the assistant write settings directly.
  Evidence: at `daa0ad62`, `libs/ai/src/lib/assistant-tools.ts:367` says the settings tool cannot change settings.
  Kind: handoff
  Source: `tasks/archive/assistant-self-awareness.md`
  Deferred because: the human left it out of the self-awareness task; it is an action, and the first version reads only.

- Handoff: ask Anthropic for reasoning summaries, so the reasoning panel is not empty on Opus 4.7 and later.
  Evidence: at `75bef231`, `libs/ai/src/lib/chat-stream.ts:258` sends no `thinking` option;
  those models return empty thinking text unless a run sends `thinking: { type: "adaptive", display: "summarized" }`.
  Opus 4.5 reports effort levels but rejects adaptive thinking, and the chat stream knows only the model ID and effort.
  Kind: handoff
  Source: `tasks/archive/anthropic-provider.md`, question 1
  Deferred because: the human left it out of the provider task; it needs the model's thinking capabilities at run time.

- Handoff: let an OpenAI-compatible profile list model IDs by hand, for servers that do not serve `/models`.
  Evidence: at `6a590204`, `libs/ai/src/lib/providers/openai-compatible-provider.ts` lists models only from
  `<base URL>/models`, and `docs/specs/AI-PROVIDERS.md` (§Fetching) disables sending while the list has not loaded.
  Kind: handoff
  Source: `tasks/archive/openai-compatible-provider.md`
  Deferred because: most targets serve `/models`; the field is added when a real endpoint needs it.

## libs/ai-react

- Handoff: `ai-model-profile-picker.test.tsx` failed on the first `check:ts` after a change, five times.
  Evidence: at `1c0661bb`, `libs/ai-react/src/lib/ai-model-profile-picker.test.tsx`; it passed on every rerun,
  in isolation, and on clean `main`.
  At `46cf0e63`, `tasks/archive/ai-ai-react-tests-audit.md` (finding 9) replaced the first test's two empty `act`
  flushes with waits for the model loads; the failure was never reproduced, so the fix is unconfirmed.
  Kind: handoff
  Source: `tasks/archive/entity-forms-architecture.md`
  Deferred because: seen during the task, which does not touch the test; drop it if no later run fails.

## libs/app

- Open question: where should `deepMerge` live?
  Evidence: at `1c0661bb`, `libs/app/src/lib/utility.ts:25` exports it; its callers are the `libs/srs-react` and
  `libs/assistant-react` test helpers and its own test.
  `libs/app/README.md:29` lists it without saying it serves test fixtures.
  Recommended: keep it in `@koloda/app` and describe it in the README as the test fixtures' merge.
  Kind: open question
  Source: `tasks/archive/app-audit.md`, question 7
  Deferred because: the human has not answered; `dead-code-audit` handed it on too.

## libs/app-react

- Risk, Later: the boot language is activated twice, once by each host store and once by `AppProviders`.
  Evidence: at `1c0661bb`, `apps/web/src/app/store.ts:18-23` and `apps/electron-react/src/app/store.ts:32-35`
  activate at module load; `libs/app-react/src/lib/app-providers.tsx:96` activates again to learn when it is ready.
  Kind: skipped
  Source: `tasks/archive/app-audit.md`, finding 2
  Deferred because: the second call only re-runs `i18n.load` and `activate` on cached messages, and removing it needs a
  new `AppProviders` API or a reorder in both host stores.

## libs/assistant-react

- Handoff: test files mock `@koloda/core-react` and `@koloda/ai-react` at file level under `isolate: false`.
  Evidence: at `1c0661bb`, `libs/assistant-react/src/lib/ui/use-assistant-chat-hotkeys.test.tsx:26` and
  `assistant-settings.test.tsx:14` mock `@koloda/core-react`; `use-assistant-message-renderer.test.tsx:26` mocks
  `@koloda/ai-react`.
  `agents/TESTING.md` (§Runner constraints) calls such a mock a bug when a sibling imports the package for real.
  The suite passed with `--maxWorkers=1 --sequence.shuffle.files`, seeds 1–8.
  At `abca5a8a` the three mocks are unchanged, and the WHY at `libs/assistant-react/vitest.config.mjs:17-19` says
  such a mock leaks to later files and belongs in `src/test-setup.ts`.
  Kind: handoff
  Source: `tasks/archive/assistant-conversation-list-audit.md`
  Deferred because: seen while working; every probed order passed. `assistant-conversations-audit` saw the same shape;
  `assistant-react-tests-audit` (finding 15) left the mocks in place by the human's choice.

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

- Improvement, Later: the connection's I/O recovery and the stale-IndexedDB wipe have no test.
  Evidence: at `91c9b3d4`, `libs/db-sqlite/src/lib/db.ts:158-165` and `:197-218` (an I/O error drops and reopens the
  connection) and `:114-133` (a leftover IndexedDB without a `blocks` store is wiped).
  Kind: skipped
  Source: `tasks/archive/db-sqlite-assistant-tests-audit.md`, finding 11
  Deferred because: testing either path needs a fake failing VFS call; the human chose to skip them at triage.

## libs/e2e

- Improvement, Later: the two AI-mock transports repeat the response decision, and hold differently after a cancel.
  Evidence: at `1c0661bb`, `apps/web-e2e/src/mock-openai-compatible.ts` and
  `apps/electron-e2e/src/mock-openai-compatible.ts` each decide the response.
  Only the desktop hold ends on a client abort (`waitForHoldOrAbort`, `:116`), so `isHolding()` differs after a cancel
  (web `:172`, desktop `:148`).
  Kind: skipped
  Source: `tasks/archive/e2e-suites-audit.md`, finding 17
  Deferred because: no test reads `isHolding()` after a cancel; then move the decision into `libs/e2e`.

## libs/settings

- Open question: should `SetSettingsData` and `PatchSettingsData` type `name` as `T`?
  Evidence: at `1c0661bb`, both type it as `SettingsName` (`libs/settings/src/index.ts:47-55`), so `T` is never inferred
  from `name`, a call can pair one setting's name with another's content, and `content` is the union of all four.
  Kind: open question
  Source: `tasks/archive/typecheck-tests.md`
  Deferred because: open at landing; the task changed no production code.

## libs/srs

- Handoff: decide whether the maximum interval should hold for Good and Easy, which ts-fsrs schedules past it.
  Evidence: at `40d9197c`, ts-fsrs 5.2.3 caps each interval, then keeps Hard < Good < Easy
  (`node_modules/ts-fsrs/dist/index.mjs:1142-1146`).
  With a maximum of 10 days, a review card gets Hard 10, Good 11, and Easy 12.
  `libs/srs/src/lib/algorithms-fsrs.test.ts` ("caps Hard at maximumInterval and keeps Good and Easy past it") pins it.
  Kind: handoff
  Source: `tasks/archive/srs-app-tests-audit.md`
  Deferred because: a product question found while tightening a test; the task changed no source.

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

## tools

- Improvement, Later: the land gate does not check the e2e suite-run record.
  Evidence: at `59aa04f0`, `taskGateProblems` (`tools/land.ts:87`) checks the trailers, the Add and Archive commits,
  `Status: done`, and the three fixed Outcome lines.
  `agents/TASKS.md` (§Done) also requires the record when a plan item adds or edits e2e cases.
  Kind: skipped
  Source: `tasks/archive/agentic-setup-audit.md`, finding 17
  Deferred because: the record has no fixed line shape yet, and few tasks have needed it.

## Repository

- Handoff: both hosts build the assistant's tool data source by hand.
  Evidence: at `467d8b36`, `apps/web/src/app/ai-runtime.ts` and `apps/electron/src/ai-ipc.ts` each assemble it.
  Kind: handoff
  Source: `tasks/archive/assistant-chat-runs-architecture.md`
  Deferred because: the architecture review left it for a later review of the AI providers.

- Waste, Medium: the per-crate Rust test targets could run as one `cargo test --workspace`.
  Evidence: at `1c0661bb`, `package.json:15` (`test:rust`) runs `koloda`, `koloda-sync-proto`, `koloda-server`, and
  `koloda-sync` as separate Nx targets.
  Kind: skipped
  Source: `tasks/archive/ci-audit.md`, finding 2
  Deferred because: one target loses per-crate Nx caching and the check that each crate builds with its own features.

- Contention, Medium: the ts and rust tracks share one 4-core runner in one CI job.
  Evidence: at `1c0661bb`, `.github/workflows/ci.yml:24` defines the single `checks` job, and `tools/check-push.ts` runs
  the tracks at once.
  The proposed split is a rust job and a ts-and-format job, plus a final `checks` job that needs both with
  `if: always()`.
  Kind: needs-decision
  Source: `tasks/archive/ci-audit.md`, finding 3
  Deferred because: decide from a task branch run on warm caches after `ci-audit` landed (its question 5).

- Size, Low–Medium: `CARGO_PROFILE_DEV_DEBUG=line-tables-only` for workspace crates in CI.
  Evidence: at `1c0661bb`, `Cargo.toml:12-13` gives dependencies `debug = 1`; workspace crates keep full debuginfo, and
  `.github/workflows/ci.yml` does not set the variable.
  Kind: skipped
  Source: `tasks/archive/ci-audit.md`, finding 4
  Deferred because: unmeasured.

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

- Handoff: move to FSRS-7 once ts-fsrs 6 is stable.
  Evidence: at `1c0661bb`, `package.json:79` pins `ts-fsrs` `5.2.3`, and `crates/koloda/Cargo.toml:33` pins `fsrs`
  `=6.6.2`, both FSRS-6 (21 weights).
  It changes the weight count on both sides and needs a migration for stored algorithms.
  Kind: handoff
  Source: `tasks/archive/fsrs-optimizer.md`
  Deferred because: a separate task once ts-fsrs 6 is stable.

- Handoff: recompute stored stability and difficulty of existing cards when optimized weights are applied.
  Evidence: at `1c0661bb`, `docs/specs/ALGORITHMS.md:144`: applied weights affect later grades like any other
  parameter change.
  Kind: handoff
  Source: `tasks/archive/fsrs-optimizer.md`
  Deferred because: the human chose later (2026-10-12).

- Risk, Should-fix: repository behavior that is not validation is kept equal on both hosts only by a written rule.
  Evidence: at `8c285ffa`, the twin rule is `agents/TESTING.md:79-86`, and the shared cases in
  `crates/koloda/tests/cases/` cover validation rules only.
  `tasks/archive/host-desync-audit.md` fixed seven such disagreements (HD1–HD7).
  Kind: skipped
  Source: `tasks/archive/agentic-setup-audit.md`, finding 5
  Deferred because: it needs shared repository cases on both hosts, a task of its own.

- Risk, Should-fix: the agent can push branches and call the GitHub API, held back only by written rules.
  Evidence: at `8c285ffa`, the repository holds no permission rules, a `gh` credential is stored, and not pushing
  unasked is a written rule (`AGENTS.md:7-9`).
  The `main` ruleset, read from the GitHub API on 2026-11-12, requires the status check `checks`, blocks
  non-fast-forward pushes and deletion, and has no bypass actors.
  Kind: skipped
  Source: `tasks/archive/agentic-setup-audit.md`, finding 14a
  Deferred because: the human chose to skip; the `main` ruleset is verified and the written rules have held.

- Product decision, Later: no commit or task records which agent or model produced a change.
  Evidence: at `8c285ffa`, `Task:` trailers tie commits to tasks (`tools/hooks/commit-msg` and the land gate enforce
  them), and nothing names the agent or model.
  Kind: skipped
  Source: `tasks/archive/agentic-setup-audit.md`, finding 7
  Deferred because: accepted by the human on 2026-11-12.

- Risk, Later: nothing mechanical notices a weakened check, and self-review is not independent of the author.
  Evidence: at `8c285ffa`, 9 `oxlint-disable` comments, 3 `#[ignore]` with reasons, and no skipped TS test.
  Kind: skipped
  Source: `tasks/archive/agentic-setup-audit.md`, finding 11
  Deferred because: accepted by the human on 2026-11-12; the human reads most changes before they land.

- Risk, Later: `Escapes:` lines are a written rule only.
  Evidence: at `8c285ffa`, `AGENTS.md:14-15`; nothing can tell that a commit fixes a bug that escaped onto `main`.
  Kind: skipped
  Source: `tasks/archive/agentic-setup-audit.md`, finding 16b
  Deferred because: accepted by the human on 2026-11-12.

- Product decision, Later: spend and the choice of model are not recorded.
  Evidence: at `8c285ffa`, no task file, commit trailer, or tool records either.
  Kind: skipped
  Source: `tasks/archive/agentic-setup-audit.md`, finding 16c
  Deferred because: accepted by the human on 2026-11-12; reopen when a second person joins or spend is tracked.
