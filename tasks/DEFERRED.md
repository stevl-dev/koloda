# Deferred Work

Work that finished tasks left undone on purpose.
Each entry is a skipped or needs-decision finding, an open question, or a handoff.
It names the archived task file it came from, its evidence, and why it was deferred.

This is not a backlog.
Nothing here is promised or ranked.
An entry leaves when a change resolves it, or when it is dropped with a reason.

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

## crates/koloda-server

- Handoff: ending a lease scans `versions` once per lease.
  Evidence: at `1c0661bb`, `end_lease` (`crates/koloda-server/src/log.rs:565-570`) runs `LEASE_ONLY_VERSIONS`
  (`:44-51`), a `DELETE FROM versions WHERE EXISTS (…)` over the whole table.
  It is linear since `sync-audit-fixes` R1, no longer quadratic.
  Kind: handoff
  Source: `tasks/archive/sync-audit-fixes.md`
  Deferred because: noticed as a follow-up; `sync-desktop-ui` left it out of scope.

- Handoff: `serve_removes_staged_uploads_before_it_listens` failed once in a full `check:push` run.
  Evidence: at `1c0661bb`, `crates/koloda-server/tests/server/attachments_tests.rs:553`.
  It failed once during `templates-audit` and once during `typecheck-tests`, and passed on re-run and alone.
  During `mobile-spike` it failed in 4 full `check:push` runs on 2026-11-13, each passing on re-run.
  The test drops the upload's result (`put(...).await.ok()`), so an upload that fails under load goes unnoticed.
  Kind: handoff
  Source: `tasks/archive/templates-audit.md`
  Deferred because: seen, not fixed; neither task touched the test.

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

- Improvement, Later: the `chat tool streaming` tests live in `assistant-tools.test.ts`, not `chat-stream.test.ts`.
  Evidence: at `1c0661bb`, the block is at `libs/ai/src/lib/assistant-tools.test.ts:968`.
  Kind: skipped
  Source: `tasks/archive/assistant-data-access-card-generation-audit.md`, finding D8
  Deferred because: the fake-model harness lives there, and a second file-level mock of `ai-sdk-ollama` would leak under
  `isolate: false`; revisit only together with the harness.

## libs/ai-react

- Handoff: `ai-model-profile-picker.test.tsx` failed on the first `check:ts` after a change, five times.
  Evidence: at `1c0661bb`, `libs/ai-react/src/lib/ai-model-profile-picker.test.tsx`; it passed on every rerun,
  in isolation, and on clean `main`.
  Kind: handoff
  Source: `tasks/archive/entity-forms-architecture.md`
  Deferred because: seen during the task, which does not touch the test.

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
  Kind: handoff
  Source: `tasks/archive/assistant-conversation-list-audit.md`
  Deferred because: seen while working; every probed order passed. `assistant-conversations-audit` saw the same shape.

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

## libs/settings

- Open question: should `SetSettingsData` and `PatchSettingsData` type `name` as `T`?
  Evidence: at `1c0661bb`, both type it as `SettingsName` (`libs/settings/src/index.ts:47-55`), so `T` is never inferred
  from `name`, a call can pair one setting's name with another's content, and `content` is the union of all four.
  Kind: open question
  Source: `tasks/archive/typecheck-tests.md`
  Deferred because: open at landing; the task changed no production code.

## libs/settings-react

- Handoff: the `settings-react` suite fails in some shuffled file orders.
  Evidence: at `1c0661bb`, `--maxWorkers=1 --sequence.shuffle.files --sequence.seed=5` fails three cases in
  `libs/settings-react/src/lib/sync/settings-sync-devices.test.tsx` ("Unable to find an element with the text: laptop");
  seeds 2, 3, 4, and 6 pass.
  Kind: handoff
  Source: `tasks/archive/assistant-settings-providers-audit.md`
  Deferred because: seen during self-review; the leak needs a wider set of files and belongs to a sync or
  settings-react task.

## libs/srs-react

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
