# Mobile spike

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/RUST.md, docs/decisions/TS-RUST-DOMAIN-MIRRORING.md, apps/electron/README.md, crates/koloda-sync/README.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/VERIFY.md, agents/I18N.md, docs/decisions/APP-ROLES.md, docs/decisions/STORAGE-BUCKETS.md, docs/decisions/MEDIA-STORAGE.md, docs/specs/CARDS.md, docs/specs/MEDIA.md, docs/specs/LESSONS.md, docs/specs/SYNC.md, agents/DECISIONS.md, agents/MARKDOWN.md, agents/DEPENDENCIES.md
Flow: local

## Intent

Decide whether the mobile app is built on React Native (Expo), with the UI drawn by native views.
The spike builds the smallest app that answers the questions that could still make that the wrong choice.

The candidate stack:

- Expo with the React Native New Architecture and Hermes, Expo Router with a native stack and native tabs.
- `koloda` and `koloda-sync` in-process, exported with UniFFI.
  uniffi-bindgen-react-native generates the JS bindings.
- The TypeScript domain libraries shared unchanged: `@koloda/srs`, `@koloda/app`, and `@koloda/core-react`'s
  query keys and types.

Tauri and other WebView shells are out: the desktop app already left Tauri because native WebViews were painful.
Fully native SwiftUI and Compose UIs are out for now: scheduling, the assistant, and markdown parsing would each need
a second implementation that synced devices must agree with.

Done when, on one mid-range Android phone:

- the app installs, starts fresh with the starter content, and keeps its data across a relaunch;
- a lesson runs with tap and swipe grading, haptics, and native transitions;
- the grade buttons show the same intervals as the desktop app for the same card;
- the phone joins a sync space from a desktop pairing code, and the library arrives, card images included;
- a review on either device shows on the other;
- the human has recorded a go or no-go verdict, with the measurements behind it;
- `docs/decisions/MOBILE-HOST.md` records the ruling.

The plan builds for a real target early, because the questions that could end the choice only show there.
Those are whether `koloda` cross-builds, whether UniFFI gives working async calls, and whether the shared libs load
under Hermes.
The spike targets Android only: its toolchain runs on the Linux development machine.
iOS needs a Mac with Xcode, which is not available now, so the iOS port is a follow-up task (open question 10).
Item 5 builds and runs the app on the Android emulator as soon as one call crosses UniFFI.
From then on, every item also has to leave the Android debug build compiling.
Item 10 runs every device check on Android.
No Swift or Kotlin is written on a machine that cannot compile it, so the spike writes no Swift.

An emulator is enough for every check except the hands-on ones.
Those are haptics, swipe feel and frame rate, and cold-start time, and they need a phone.
Building is the agent's step.
Starting the app or an emulator is the human's step, unless the human asks the agent to run it.
Each item adds its device checks to `apps/mobile/README.md` (§Device checks).

Code falls into two kinds.
Kept code meets the repo's normal standards: tests, docs, and the guides above.
Spike code exists only to answer a question; it is listed in `apps/mobile/README.md` and replaced by the follow-up.

- Kept: the mobile builds of `koloda` and `koloda-sync`, the host secret stores, `apps/mobile/src-rust`, the Expo
  app setup, the generated bindings and their wiring, sync hosting, and the card renderer.
- Spike code: the lesson screen, the sync screen, and debug screens.

## Scope

In:

- `koloda` taking a host-provided secret store on iOS and Android, and the Android store.
- `koloda` and `koloda-sync` building for Android.
- `apps/mobile`: the Expo app, its Android Nx targets, its README, and its row in `docs/decisions/APP-ROLES.md`.
- `apps/mobile/src-rust`: the `koloda-mobile` crate, a thin UniFFI façade over `koloda` and `koloda-sync`.
- A native card markdown renderer with attachment images.
- A spike lesson screen and a spike sync screen.
- Sync in the foreground.
- Rows for the mobile host in `docs/decisions/TS-RUST-DOMAIN-MIRRORING.md` (§Persistence owners) and
  `docs/decisions/STORAGE-BUCKETS.md`, ridden with the items that make them true.
- `docs/decisions/MOBILE-HOST.md`.
- The React upgrade the Expo SDK needs, as open question 8 settles.

Out:

- The iOS port: iOS builds and Nx targets, the Mac setup, the Swift Keychain store, and the iOS device checks.
  It is a follow-up task, as open question 10 settles.
- Settings screens, deck, card, and template editing, the assistant and AI, color themes, and a second locale.
- Typed answers: a type field behaves as reveal in the spike lesson.
- The lesson init screen: the spike lesson starts with the default amounts.
- Creating a space, inviting a device, the devices list, leaving a space, and Add or Replace for a used database.
- Background sync through the engine's `tick` (BGTaskScheduler, WorkManager), as open question 4 settles.
  It is Swift and Kotlin calling Rust without the JS runtime, so it says nothing about the React Native choice.
- Metered-network handling and an image download policy.
- Hotkeys.
- Extracting a Rust host layer shared with `apps/electron/src-rust`.
  The spike copies what it needs and lists each copy in `apps/mobile/README.md`.
- Moving DOM-free logic out of the `*-react` libs, beyond the subpath exports item 7 adds.
- Mobile builds in CI or in `bun run check:push`.
  Only the desktop-host Rust and TS gates cover the new code.
- Signing for release, store submission, and EAS.
- Any change to desktop or web behavior, beyond the React upgrade in item 1.

## Open questions

- [x] 1. What is `apps/mobile`'s row in `docs/decisions/APP-ROLES.md` during the spike? — Dev tool.
  It ships nowhere and makes no durability promise.
  The follow-up that builds the real app makes it Product.
- [x] 2. How does the mobile host store secrets? — a host-provided store on both platforms.
  It is written in Kotlin over the Android Keystore and in Swift over the Keychain.
  It is handed to `koloda` through a UniFFI callback interface.
  The spike writes the Android store; the iOS follow-up writes the Swift one.
  Rejected: the `keyring` crate on iOS plus a host store on Android only.
- [x] 3. What does the mobile renderer do with raw HTML in card text? — it drops the tags and shows their text.
  That holds for the spike.
  The lasting rule goes into `docs/specs/CARDS.md` (§Rendered Markdown) in the follow-up.
- [x] 4. Does the background `tick` stay in the spike? — no; it moves to the follow-up.
  It does not gate the verdict, and it would be the same code under any host.
- [x] 5. Which phones run the hands-on device checks? — the phones the human owns; the model does not matter.
  The emulator runs every other check.
  If there is no Android phone, the Android feel verdict and measurements are recorded as untested.
- [x] 6. Where do the builds run? — Android on the Linux development machine, from item 5 on.
  It has no Android toolchain yet; item 5 installs it as `apps/mobile/README.md` (§Platform setup) says.
  iOS builds run on a Mac with Xcode, in the iOS follow-up (open question 10).
- [x] 7. What bar makes the verdict a go? — the human judges the lesson screen as native-feeling on the Android
  phone.
  On the Android phone, with a release build, the app starts to the Lessons tab within 2 s.
  A swipe-to-grade stays at the display's frame rate in the performance monitor.
- [x] 8. Which React does the workspace run? — 19.3, upgraded first as item 1, so every app shares one React.
  Checked on the npm registry on 2026-11-13: Expo SDK 58 pins `react` 19.3.0 and `react-native` 0.88.1.
  `react-native` 0.88.1 needs `react` `^19.3.0`, and the workspace had 19.2.0 installed.
  Rejected: an older Expo SDK that accepts 19.2, and a second React for the mobile app alone.
- [x] 9. Which new dependencies does the human approve? — the set below, by item.
  `agents/DEPENDENCIES.md` (§Adding a Dependency) makes each one the human's decision.
  - item 3: `expo`, `react-native`, `expo-router`, `jest-expo`, and React Native Testing Library;
  - item 4: the `uniffi` crate and `uniffi-bindgen-react-native`, which is at a prerelease (0.31.0-7);
  - item 5: `cargo-ndk` and the Android Rust targets, installed on the machine and not in the repo;
  - item 6: `expo-image`; `marked` is already a workspace dependency;
  - item 7: React Native Gesture Handler, Reanimated, and `expo-haptics`.
  Before adding one, the item's implementer still gives the human the facts that section lists.
  A dependency outside this set is a new question.
- [x] 10. How does the spike handle iOS without Xcode? — it splits into this Android task and an iOS follow-up.
  Decided 2026-11-13: no Mac with Xcode is available, and the human wants the spike finished without waiting.
  The follow-up is a new task, branched from `main` on a Mac with Xcode once one is available.
  It ports the app, writes the Swift Keychain store, and runs every device check on the simulator and an iPhone.
  It also answers whether uniffi-bindgen-react-native gives working async calls on iOS.
  `docs/decisions/MOBILE-HOST.md` records the ruling on the Android verdict and says iOS is not yet checked.
  The follow-up revises it if iOS fails.
  The Archive commit adds the follow-up to `tasks/DEFERRED.md` as a handoff.
  Rejected: holding the decision until iOS is checked, and writing Swift that no machine here can compile.
- [x] 11. Which dependencies outside open question 9 does item 3 need? — these, approved on 2026-11-13.
  They are required peers of the approved Expo packages, plus Lingui's Babel plugin and Jest's types:
  - `expo-router` peers: `react-native-screens`, `react-native-safe-area-context`, `expo-linking`, `expo-constants`,
    `@expo/metro-runtime`, and `@expo/log-box`, at the versions Expo SDK 58 pins;
  - `jest-expo` and React Native Testing Library peers: `jest`, `@react-native/jest-preset`, and `test-renderer`;
  - `@lingui/babel-plugin-lingui-macro` 5.x, since Metro compiles with Babel and cannot run the SWC plugin;
  - `@types/jest`, so `bun run typecheck` covers the Jest tests.

## Plan

- [x] 1. Upgrade React to 19.3
  Goal: Move the workspace's `react`, `react-dom`, `@types/react`, and `@types/react-dom` to 19.3, as open question
  8 settles.
  Expo SDK 58 pins `react` 19.3.0, and `react-native` 0.88.1 needs `^19.3.0`; the workspace has 19.2.0 installed.
  Follow `agents/DEPENDENCIES.md` (§Upgrading a Dependency): read the release notes for 19.2.0 to the target, list
  what changed, and search the codebase for each change.
  The four packages move together in one commit.
  Add a Manual verify block per `agents/VERIFY.md`, since React runs in the desktop and web apps.
  Constraints: No other package moves.
  If the release notes list a change that needs more than a mechanical edit, stop and report it to the human.
  Done when: `bun.lock` resolves `react` and `react-dom` to the same 19.3 version Expo SDK 58 pins.
  `bun run check:push` is green.
  Commit: Upgrade React to 19.3
  Depends on: none

- [x] 2. Let koloda take a host secret store on mobile
  Goal: On iOS and Android, `create_secret_store` in `crates/koloda/src/app/secrets.rs` returns the store a host
  registered.
  Add a registry for the host's store, with one register call taking an `Arc<dyn SecretStore>`.
  Until a host registers one, every secret call returns an `AppError` that says no secret store is set.
  The registry compiles on every target, so its tests run on the desktop host.
  Only `create_secret_store` chooses it, by `cfg(any(target_os = "ios", target_os = "android"))`.
  `keyring` stays unlinked on those targets: `crates/koloda/Cargo.toml` names it for macOS, Linux, and Windows only.
  Update `crates/koloda/README.md` where it says which secret store each platform uses.
  Constraints: Desktop targets build and behave as before, with no new dependency.
  Do not add the mobile targets to `rust-toolchain.toml`, since every machine and CI would then download them.
  Do not change `koloda-sync`.
  Cross-building starts in item 5; this item does not need the mobile targets installed.
  Done when: Tests pin the registry: an unregistered store errors, and a registered one sets, gets, and removes a
  key.
  `cargo test -p koloda` and `cargo test -p koloda-sync` pass.
  `cargo tree -p koloda --target aarch64-linux-android` and `--target aarch64-apple-ios` list no `keyring`.
  `bun run check:push` is green.
  Commit: Let koloda take a host secret store on mobile
  Depends on: none

- [x] 3. Add the Expo mobile app shell
  Goal: Add `apps/mobile` (`@koloda/mobile`): an Expo app on SDK 58, with the New Architecture and Hermes.
  It runs as a development build through prebuild, not in Expo Go, because item 4 adds native code.
  Expo Router gives a native stack and native tabs: "Lessons" and "Sync", both placeholders for now.
  Metro resolves the workspace libs from source, as Vite does for the other apps.
  Lingui compiles macros through its Babel plugin, with an English catalog only, activated as the other apps do.
  `project.json` has `nx:run-commands` targets, with tags like the other apps':
  - `start`, `prebuild`, `android`, `typecheck`, and `test`;
  - `build-android`, which compiles a debug build and starts no device or emulator.
  iOS targets come with the iOS follow-up.
  Add the app to the root `tsconfig.json` references, so `bun run typecheck` covers it with React Native types and no
  DOM lib.
  Add Jest with `jest-expo` and React Native Testing Library as `@koloda/mobile:test`, and add it to
  `bun run test:app-unit`.
  A debug screen proves the shared domain code runs on the device.
  It builds the starter FSRS algorithm from `@koloda/srs` and shows the interval each grade gives a new card.
  Add `apps/mobile/README.md` with these sections:
  - its role line pointing at `docs/decisions/APP-ROLES.md`;
  - Platform setup: what an Android machine installs, including the Rust targets and `cargo-ndk`;
  - Running: the Nx commands for Android;
  - Device checks: a checklist item 10 runs on Android, starting with this item's checks;
  - Spike code, Copies, and Findings.
  This item's device checks: the app boots, both tabs open, and the debug screen shows four intervals.
  Add the app's row to `docs/decisions/APP-ROLES.md`, as open question 1 settles.
  Constraints: Mobile-only dependencies go in `apps/mobile/package.json`, not the root `package.json`.
  Add only the dependencies open questions 9 and 11 approved.
  The app uses the workspace's React version, which item 1 moved to the one the SDK pins.
  If the SDK and the workspace still disagree on React, stop and report it to the human.
  Do not change shared libs.
  The Android targets are not run here; item 5 runs them.
  Done when: A Jest test renders the debug screen and finds four intervals.
  `bun run typecheck`, `bun run lint`, `bun run check:workspace-deps`, and `nx run @koloda/mobile:test` pass.
  `bun run check:push` is green.
  Commit: Add the Expo mobile app shell
  Depends on: 1

- [ ] 4. Call koloda from the mobile app through UniFFI
  Goal: Add `apps/mobile/src-rust`, crate `koloda-mobile`, as a Cargo workspace member.
  It is a thin façade over `koloda`, exported with UniFFI, like `apps/electron/src-rust` over NAPI.
  It opens `koloda.db` in the app's documents directory, reports its status, runs migrations, and seeds the starter
  content.
  It also lists decks and lessons, loads lesson data, and submits lesson results.
  Database calls run on one dedicated thread in call order and return Promises, as on desktop.
  Errors reach JS as the `AppError` shape `@koloda/app` defines.
  uniffi-bindgen-react-native generates the bindings; commit its config for Android.
  Nx targets regenerate the bindings and build the native libraries for Android.
  The `android` and `build-android` targets depend on them, so one command builds the app.
  Generated code is not committed, unless the TS bindings need a mobile toolchain to generate.
  Then commit the generated TS, so `bun run typecheck` runs on any machine.
  The app implements the `Queries` methods it calls, typed as a `Pick` of `Queries` from `@koloda/core-react`, with
  its query keys.
  It does not set `queriesAtom`, which is typed as the whole `Queries`.
  The starter content mirrors what `apps/electron-react/src/app/setup.ts` builds; copy it and list it under Copies.
  The Lessons tab lists decks with due counts, as spike code.
  Add `apps/mobile/src-rust/**` to the inputs of `nx run koloda:lint`, so its clippy cache sees the crate.
  Add the mobile row to `docs/decisions/TS-RUST-DOMAIN-MIRRORING.md` (§Persistence owners): `koloda` over rusqlite,
  exposed through UniFFI.
  Add the build commands to the README's Running section.
  Device checks to add: a fresh install shows the starter decks with due counts.
  After force-quitting and reopening, the same decks show.
  Constraints: No change to `koloda`'s behavior.
  Copy what the façade needs from `apps/electron/src-rust` instead of refactoring it, and list each copy under
  Copies.
  Add only the dependencies open question 9 approved.
  Done when: Rust tests on the desktop host open, migrate, and seed a temporary database through the façade and list
  its lessons.
  A Jest test renders the Lessons tab over a mocked façade and shows each deck's due count.
  `cargo test -p koloda-mobile`, `nx run koloda:lint`, and `bun run typecheck` pass.
  `bun run check:push` is green.
  Commit: Call koloda from the mobile app through UniFFI
  Depends on: 2, 3

- [ ] 5. Build and run the mobile app on Android
  Goal: Prove the stack on a real target before more code is written on it.
  Set the machine up as `apps/mobile/README.md` (§Platform setup) says for Android: the Android SDK and NDK, a JDK,
  `cargo-ndk`, and the Rust targets `aarch64-linux-android` and `x86_64-linux-android`.
  The emulator on an x86-64 machine runs the `x86_64` build; a phone runs `arm64-v8a`.
  `koloda`, `koloda-sync`, and `koloda-mobile` build for both targets.
  `koloda-sync` is not called yet; building it now shows whether its networking dependencies cross-build.
  The bindings and the app build through the Nx `build-android` target.
  The human runs the app on the emulator and runs the device checks items 3 and 4 added.
  Those answer the three questions: the debug screen shows that the shared libs load under Hermes, and the deck
  list shows that an async call crosses UniFFI and that the database survives a relaunch.
  Fix what breaks, and record each fix and why under Findings.
  Fix any README step that turned out wrong or missing.
  Constraints: Fixes stay in Android-only code and config: Kotlin, Gradle, the Android side of the app config, and
  target-specific Cargo features.
  A dependency that fails to cross-build gets the smallest target-specific feature change, so desktop builds are
  unchanged.
  If a fix would change shared Rust or TS code, stop and report it to the human.
  If uniffi-bindgen-react-native cannot give working async calls, stop and report it to the human.
  If a shared lib fails to load under Hermes, record why under Findings and stop for the human.
  A stop here is a possible no-go; the human decides whether the plan continues.
  Done when: `cargo ndk -t arm64-v8a -t x86_64 build -p koloda -p koloda-sync -p koloda-mobile` succeeds.
  `nx run @koloda/mobile:build-android` succeeds.
  The device checks of items 3 and 4 pass on the emulator, or each failure is recorded under Findings.
  `bun run check:push` is green.
  Commit: Build and run the mobile app on Android
  Depends on: 4

- [ ] 6. Render card markdown natively on mobile
  Goal: Add a card markdown renderer under `apps/mobile/src/cards/` (kept code) that needs no DOM.
  It parses with the `marked` lexer, so its tokens match the desktop's parse.
  It renders the tokens as native components.
  Those are paragraphs, headings, emphasis, strong, inline and block code, lists, blockquotes, tables, links,
  images, rules, and line breaks.
  A card image (`ATTACHMENT_REF_PATTERN` from `@koloda/srs`) shows through `expo-image` from a cache file.
  `koloda-mobile` writes that file into the app's cache directory under the attachment's id, through `koloda`'s byte
  store.
  Behavior follows `docs/specs/MEDIA.md` (§Where Images Show) and `docs/specs/CARDS.md` (§Rendered Markdown).
  While an image loads, its place stays empty.
  A missing or unreadable image shows its alt text.
  A remote or `data:` image never loads, and its alt text shows instead.
  A web link opens in the system browser only when tapped.
  Raw HTML follows open question 3.
  Colors follow the system light or dark scheme.
  Classify the image cache files as device-local in `docs/decisions/STORAGE-BUCKETS.md`.
  Device checks to add: a debug screen shows a sample card with every token kind and an attachment image.
  It reads well in light and dark mode, and a tapped link opens the system browser.
  Constraints: Do not change `libs/srs/src/lib/markdown.ts`.
  Add only the dependencies open question 9 approved.
  Done when: Tests cover each token kind.
  They also cover a card image resolving to its cache file, remote and `data:` images showing alt text, a missing
  image showing alt text, and the raw HTML rule.
  A Rust test writes an attachment's cache file and returns the same path on a second call.
  `nx run @koloda/mobile:build-android` succeeds.
  `bun run check:push` is green.
  Commit: Render card markdown natively on mobile
  Depends on: 5

- [ ] 7. Add a spike lesson screen on mobile
  Goal: Tapping a deck on the Lessons tab starts a lesson with the default amounts (spike code).
  The session runs on the existing lesson reducer, store, and selectors.
  Add a DOM-free subpath export, `@koloda/srs-react/lesson-state`, that re-exports them without moving files.
  The reducer imports `dispatchReducerAction` and `ReducerAction` from `@koloda/core-react`'s barrel.
  If that barrel pulls in DOM code, add a DOM-free subpath there as well for those two, and record it under
  Findings.
  Each card shows its template's fields through the item 6 renderer, with display and reveal; type acts as reveal.
  Tapping the card or "Continue" submits it.
  The four grade buttons show their intervals, and swipes grade too.
  Swipes and the card transition run on the UI thread through Gesture Handler and Reanimated.
  Each grade gives haptic feedback.
  Results are saved through `koloda-mobile`'s submit call, in the `LessonResultData` shape.
  A plain screen shows completion.
  Device checks to add:
  - Study ten cards with swipes and buttons; swipes, transitions, and haptics feel native.
  - On a new card, "Good" shows the same interval as on desktop.
  - After force-quitting and reopening, the deck's due count has dropped.
  - Record under Findings the cold start to the Lessons tab in a release build, and a feel verdict for the phone.
  - On Android, also record the swipe frame rate in the performance monitor.
  Constraints: No spec change.
  The only change to `@koloda/srs-react` is the subpath export.
  Add only the dependencies open question 9 approved.
  Done when: A Jest test runs a three-card lesson over a mocked façade with button grades.
  It checks the intervals on the buttons and the `LessonResultData` the façade receives.
  `bun run test:libs` and `bun run typecheck` pass.
  `nx run @koloda/mobile:build-android` succeeds.
  `bun run check:push` is green.
  Commit: Add a spike lesson screen on mobile
  Depends on: 6

- [ ] 8. Host the sync engine on mobile
  Goal: `koloda-mobile` hosts the `koloda-sync` engine as `SyncHost` in `apps/electron/src-rust/src/sync.rs` does.
  It takes the host's secret store through a UniFFI callback interface and registers it with `koloda` at startup,
  before the engine starts.
  Implement that store for Android as open question 2 settles, in Kotlin over the Android Keystore.
  The iOS store is the iOS follow-up's; until then an iOS build has no store, and secret calls return item 2's error.
  The façade starts the engine with the starter content and runs the runner in the foreground.
  It forwards engine events to JS through a UniFFI callback interface.
  Product writes tell it to sync.
  The runner stops when the app goes to the background and resumes on return, with a nudge.
  The device claims with platform `ios` or `android`.
  Expose the calls a join needs: preview, join, and status.
  The app refreshes the queries each synced kind feeds, as `apps/electron-react/src/app/sync-events.ts` does.
  Copy it and list it under Copies.
  Images the engine fetched refresh their cache files.
  Device checks to add: after a fresh install, the Sync tab's placeholder shows the engine's status, not an error.
  Constraints: Secrets stay in Rust and the host store, and never reach JS.
  Do not change `koloda-sync`.
  Write no Swift.
  Done when: Rust tests on the desktop host cover registering the host store before the engine starts.
  They also cover starting and stopping the engine through the façade, and an event reaching the callback.
  `nx run @koloda/mobile:build-android` succeeds, with the Kotlin store compiled in.
  `bun run check:push` is green.
  Commit: Host the sync engine on mobile
  Depends on: 5

- [ ] 9. Add a spike sync screen on mobile
  Goal: The Sync tab joins a space (spike code).
  It asks for the server address, the pairing code, and the device name, which starts as the device's name.
  It shows the preview (space name and counts) as `docs/specs/SYNC.md` (§Joining a Space) describes, then joins.
  Afterwards it shows the sync status and how far behind each lane is.
  Only a database that holds just its starter content joins; any other is refused with a message.
  Device checks to add:
  - On desktop, issue a pairing code; on the phone, enter it, check the preview, and join.
    The desktop library arrives, and a card with an image shows that image in a lesson.
  - Grade a card on the phone; desktop shows its new due time after it syncs.
  - Grade a card on desktop; after the phone returns to the foreground, it shows the change.
  - Force-quit and reopen the phone app; it is still in the space, and the status is in sync.
  - Enter a wrong code; the screen says the code is wrong.
  Constraints: No spec change.
  No create, invite, devices, leave, or Add or Replace.
  Done when: Jest tests over a mocked façade cover the preview-then-join flow, the wrong-code message, and the
  refusal for a database with more than its starter content.
  `bun run typecheck` passes and `nx run @koloda/mobile:build-android` succeeds.
  `bun run check:push` is green.
  Commit: Add a spike sync screen on mobile
  Depends on: 7, 8

- [ ] 10. Verify the mobile app on Android
  Goal: Run every check in `apps/mobile/README.md` (§Device checks) on Android, with the human.
  The emulator runs all of them except the hands-on ones.
  The Android phone open question 5 names runs those: haptics, swipe feel and frame rate, and cold start, with a
  release build.
  Without a phone, record those as untested.
  Fix what breaks, and record each fix and why under Findings.
  Record the measurements and the Android feel verdict under Findings.
  Fix any README step that turned out wrong or missing.
  Constraints: Fixes stay in the mobile app and its crate.
  If a fix would change `koloda`, `koloda-sync`, or a shared lib, stop and report it to the human.
  Done when: Every device check passes on Android, or its failure is recorded under Findings.
  `bun run check:push` is green.
  Commit: Verify the mobile app on Android
  Depends on: 9

- [ ] 11. Record the mobile host decision
  Goal: On a go verdict on Android, write `docs/decisions/MOBILE-HOST.md` per `agents/DECISIONS.md`.
  Its Ruling: the mobile host is React Native on Expo, with `koloda` and `koloda-sync` in-process through UniFFI.
  The TypeScript domain libraries are shared, and the UI is native views.
  Its Why says the verdict rests on Android, and that iOS is not yet checked, as open question 10 settles.
  Its Rejected designs name WebView shells (Tauri, Capacitor) and fully native UIs, one line each with why.
  Add pointers from `agents/INDEX.md`.
  Restate the spike's findings in the task's Outcome, not in the decision.
  On a no-go verdict, stop and ask the human; this item is rewritten.
  Constraints: Docs only.
  Done when: `bun run check:docs` passes.
  Commit: Record the mobile host decision
  Depends on: 10

## Outcome

Not started.
