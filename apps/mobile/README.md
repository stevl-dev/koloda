# @koloda/mobile

The mobile app: React Native on Expo, with the UI drawn by native views, on the stack
`docs/decisions/MOBILE-HOST.md` rules.
It studies decks and joins a sync space; the specs name what it leaves out.
Role: product (see `docs/decisions/APP-ROLES.md`).

## Where it sits

The app runs as an Expo development build on the New Architecture and Hermes, not in Expo Go.
Routes live in `src/app` (Expo Router): a native stack over native tabs.
It shares the TypeScript domain libraries with the other apps; Metro resolves them from source.
Data lives in `koloda`, in-process: `src-rust` (crate `koloda-mobile`) is a thin UniFFI façade over it,
and `native` (`@koloda/mobile-native`) is the React Native module uniffi-bindgen-react-native generates for it.
`src/host` turns the façade's JSON payloads into the TS domain types and its errors into `AppError`.
`src/cards` renders card markdown as native views from the `marked` tokens the desktop parses.
Card images load from cache files `koloda-mobile` writes from the attachment bytes, under the app's cache directory.
`koloda-mobile` also hosts the `koloda-sync` engine; `src/host/start-sync.ts` starts it once the database is seeded.
The engine reads secrets from a vault the host registers first: `modules/koloda-secrets`, a local Expo module in
Kotlin over the Android Keystore, which calls Rust through the Kotlin bindings, so secrets never reach JS.
The vault is a UniFFI component of its own, `src-rust/vault` (crate `koloda-mobile-vault`), linked into the same
library; the JS bindings leave it out, and `src-rust/vault/src/lib.rs` says why.
JS takes the engine's events by calling `syncEvents` again and again, not through a callback;
`src-rust/src/sync.rs` (`EventQueue`) says why.
Background sync is a WorkManager task (`src/host/background-sync.ts`) that runs a bounded `syncTick`.
The bundle's entry, `index.ts`, defines it before the router loads, since a background run mounts no screen.
It targets Android only for now; iOS comes in a follow-up.

## Platform setup

An Android build machine installs:

- JDK 17;
- the Android command-line tools, unpacked to `$ANDROID_HOME/cmdline-tools/latest`,
  with `ANDROID_HOME` pointing at the SDK (`~/Android/Sdk` on Linux);
  export it in the shell that runs the Nx targets, or Gradle stops with "SDK location not found";
- the SDK packages, through the tools' `android` command
  (`sdkmanager` is deprecated, and the licenses need no separate step):

  ```sh
  android sdk install platforms/android-37.0 build-tools/37.0.0 ndk/27.1.12297006 \
    platform-tools emulator system-images/android-36/google_apis/x86_64
  ```

- the Rust targets `aarch64-linux-android` (phones) and `x86_64-linux-android` (the emulator on an x86-64 machine),
  through `rustup target add`;
- `cargo-ndk`, through `cargo install cargo-ndk`; it finds the NDK under `ANDROID_HOME`.

The Rust targets stay out of `rust-toolchain.toml`, so machines that build only the desktop app do not download them.

The emulator needs hardware acceleration: `/dev/kvm` must exist and be writable by the user.
Load the `kvm_amd` or `kvm_intel` module and join the `kvm` group if it does not.
Create a device once:

```sh
avdmanager create avd -n koloda -k "system-images;android-36;google_apis;x86_64" -d pixel_7
```

`avdmanager` writes devices under `~/.config/.android/avd`, while the emulator reads `~/.android/avd`,
so set `ANDROID_AVD_HOME=$HOME/.config/.android/avd` before starting it with `emulator -avd koloda`.

The Expo prebuild writes the Gradle project into `android/`, which is generated and not committed.

Android backup is off (`android.allowBackup` in `app.json`).
A restore onto another phone would bring back `koloda.db` with the old phone's device identity, so two phones would sync
as one device, and the vault's encrypted preferences without the Keystore key that decrypts them.
A library moves to a new phone by joining its sync space.

## Running

- `nx run @koloda/mobile:start` — the Metro dev server.
- `nx run @koloda/mobile:android` — builds the debug app and installs it on a running emulator or phone.
- `nx run @koloda/mobile:build-android` — compiles the debug app only; it starts no device or emulator.
  Both first build `koloda-mobile` for each Android target and regenerate its module
  (`nx run @koloda/mobile-native:build-android`).
- `nx run @koloda/mobile:build-android-release` — compiles the release app, with `koloda-mobile` built in Cargo's
  release profile and the JS bundled into the APK, for the cold-start and frame-rate checks.
  It builds only the ABIs `ubrn.config.yaml` lists; the app could not load `koloda-mobile` on any other.
  Gradle signs it with the debug key, so it installs over a debug build and keeps the app's data:
  `adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.
- `nx run @koloda/mobile-native:bindings` — regenerates the TS bindings from a desktop build of `koloda-mobile`;
  run it and commit `native/src` after changing the façade's API.
  It generates them for `koloda_mobile` alone and deletes the vault's, so JS never loads the vault component.
  `build-android` runs it first instead of `ubrn`'s `--and-generate`, which would load every component.
- `nx run @koloda/mobile:test-rust` — the façade's Rust tests; `bun run check:push` runs them.
- `nx run @koloda/mobile:prebuild` — regenerates `android/` from the app config.
- `nx run @koloda/mobile:test` — Jest unit tests; `bun run test:app-unit` runs them.
- `nx run @koloda/mobile:typecheck`
- `nx run @koloda/mobile:lingui-extract` and `nx run @koloda/mobile:lingui-compile` — the English and Russian catalogs.

## Device checks

Run on each platform after a change to the app.

- [ ] The app boots to the Lessons tab.
- [ ] The Lessons and Settings tabs both open, and Settings → Sync opens and returns to Settings.
- [ ] In a lesson, a revealed card shows four grades, each with an interval.
- [ ] A fresh install opens on the Lessons tab, which says there are no decks yet: the starter content has none.
  That answer came back from `koloda` through an async UniFFI call.
- [ ] After joining a space, the Lessons tab shows the desktop library's decks with their due counts.
- [ ] Above the decks, the Lessons tab shows what was learned today against each daily limit, with ∞ for no limit.
  After a lesson, they count its cards.
- [ ] After force-quitting and reopening the app, the joined decks still show.
- [ ] A desktop card that uses every markdown kind, with a stored image, shows each kind in a lesson.
  A remote or embedded image shows its alt text instead.
- [ ] The card reads well with the system in light mode and in dark mode.
- [ ] In Settings → Interface, Dark with the system light turns every screen, the tab bar, the headers, the keyboard,
  and the leave dialog dark; Light with the system dark turns them light.
  With System, switching the device's dark mode switches the app at once.
  After a force-quit, the app opens in the chosen scheme with no flash of the other.
- [ ] On a fresh install on a phone set to Russian, the app opens in Russian.
  In Settings → Interface, English switches the tabs, headers, Lessons tab, and lesson grades to English at once,
  and the choice holds after a force-quit.
- [ ] In Settings → Interface, Motion Off makes a graded card leave and the next appear at once, and a drag that grades
  nothing snaps back; On animates them even with the device's remove-animations setting on.
- [ ] Choosing a date or time format changes its preview and the last-sync time in Settings → Sync.
  An invalid custom date pattern shows an error on return and keeps the previous format.
- [ ] In Settings → Learning, lower New's limit and save; the Lessons tab's today's progress shows the new limit.
  A New limit above Total shows an error under the limits and saves nothing; Discard restores the saved values.
  Day starts at shows AM and PM under a 12-hour time format and a 24-hour clock under a 24-hour one.
  The keyboard covers neither the field being edited nor Save.
  A change saved on desktop shows here while the field is untouched.
- [ ] With each of Atom One Light, GitHub Light, Atom One Dark, and GitHub Dark chosen and its scheme active,
  the Lessons tab, a lesson, and Settings read well, and the tab bar and headers match the screens.
  Switching the scheme keeps both theme choices.
- [ ] Tapping the card's web link opens the system browser.
- [ ] The Lessons tab lists "All decks" first; each row's New, Learn, Review, and Total start a lesson of that type,
  and a zero does nothing.
  A Review lesson from "All decks" shows review cards from more than one deck.
- [ ] Starting a lesson opens the init screen with the default amounts and today's progress.
  Raising an amount past what is available holds it there, Total follows, and Start is disabled at a Total of zero.
  The keyboard covers neither the amounts nor Start.
- [ ] While studying, Done and Left count the graded and remaining cards, and the bar fills as cards are graded.
- [ ] Tap a deck's Total, then Start; study ten cards with swipes and buttons.
  Left is Again, down is Hard, right is Good, up is Easy.
  Each grade button shows its arrow, and a drag shows the grade it would give on the card.
- [ ] Mid-lesson, the back button, the back gesture, and the header's back control each ask before ending it.
  "Continue studying" keeps the card as it was, and "Close" returns to the Lessons tab.
  On the init screen and the done screen, back leaves at once.
- [ ] Reveal a card too long for the screen; scrolling it up and down grades nothing.
  At its top a swipe down grades Hard, and at its bottom a swipe up grades Easy.
  Swipes, card transitions, and haptics feel native.
- [ ] On a new card, "Good" shows the same interval as on desktop.
- [ ] On a card whose template types an answer, the keyboard opens on the input and covers neither it nor
  "Continue".
  A tap on the card beside the input closes the keyboard and does not reveal the answer.
  The return key submits; a right answer in another case shows as correct, and a wrong one shows the correct value.
- [ ] After force-quitting and reopening the app, the deck's due count has dropped.
- [ ] Under Findings: the cold start to the Lessons tab in a release build, and a feel verdict for the phone.
- [ ] On Android, under Findings: the swipe frame rate in the performance monitor.
- [ ] After a fresh install, Settings → Sync shows the engine's status (not in a space), not an error.
- [ ] On a fresh install: on desktop, issue a pairing code; on the phone, enter the server address and the code,
  check the preview, and join.
  The desktop library arrives, and a card with an image shows that image in a lesson.
- [ ] Grade a card on the phone; desktop shows its new due time after it syncs.
- [ ] Grade a card on desktop; after the phone returns to the foreground, it shows the change.
- [ ] Force-quit and reopen the phone app; it is still in the space, and the status is in sync.
- [ ] Enter a wrong code; the screen says the code is wrong.
- [ ] Change a card on desktop, then send the phone app to the background and force a background run
  (`adb shell cmd jobscheduler run -f com.koloda.app <job id>`, the id from `adb shell dumpsys jobscheduler`).
  Desktop's change is on the phone when the app opens, before any foreground sync; it also arrives after a
  force-quit.
- [ ] Join a space and send the app to the background while the space downloads; a forced background run downloads
  nothing, and the download goes on once the app opens.

## Copies

Code copied from another app instead of shared:

- The database worker and the payload helpers in `src-rust/src/lib.rs`, from `apps/electron/src-rust/src/lib.rs`.
- `src-rust/src/sync.rs`, from `apps/electron/src-rust/src/sync.rs`: the sync host, its wire shapes, and its
  error codes.

## Findings

What building and running the app showed:

- 2026-11-13, Android emulator (API 36, x86_64, debug build): the first six device checks pass, from booting to the
  sample deck surviving a relaunch.
  The checks after them have not run.
  The shared libs load under Hermes, async calls cross UniFFI, and the database survives a relaunch.
- Jest runs CommonJS, so ESM-only packages the shared libs import (`uuid`, `marked`, `immer`) go through Babel there
  (`jest.config.js`).
  Metro bundles them as they are.
- `koloda`, `koloda-sync`, and `koloda-mobile` cross-build for `arm64-v8a` and `x86_64` unchanged,
  including the sync crate's networking dependencies.
- uniffi-bindgen-react-native links a static library by default; `native/ubrn.config.yaml` links the shared library
  the crate builds anyway, through its shared-library setting.
- The generated module's `build.gradle` names a ProGuard file the generator writes only for native bindings,
  and AGP 9 fails without it; the native bindings the vault needs write it.
- The bindings generator implements callback interfaces in TypeScript, so a Kotlin vault needs its native Kotlin
  bindings too (`--native-bindings`), which load the library through JNA.
- The engine has no way to stop its runner; Android freezes a backgrounded app, and the host nudges it on return.
- Each Expo prebuild writes `react` and an empty `scripts` into `package.json`; both are kept, so builds leave the
  tree clean.
- Bun installs peer dependencies, so Reanimated and Worklets arrive through `expo-router`'s drawer dependency,
  and autolinking compiles them into the app.
- The debug APK is about 250 MB.
- `@koloda/core-react`'s barrel loads under Hermes, so the lesson reducer imports it as it is;
  no DOM-free subpath was needed there.
- The lesson reducer calls `structuredClone`, which TypeScript declares only in the DOM lib.
  Expo's runtime installs it on the device, so `src/globals.d.ts` declares it for the type check.
- Jest cannot run Reanimated's UI runtime: its JS build needs `react-native-web`.
  The lesson test swaps the swipe layer (`src/lesson/swipeable-card.tsx`) for a pass-through and grades with buttons.
- Expo locks an Android app to light mode unless the app config sets an interface style, which needs
  `expo-system-ui`; the app follows the system scheme with it.
- 2026-11-15, Android emulator (debug build): opening the Sync tab logged React Query's missing-`queryFn` error,
  because `SyncPanel` observed the start query with no `queryFn`.
  It now passes `queryFn: skipToken`, which disables the query without the warning; after a reload the tab shows the join form.
- 2026-11-15, Android emulator (debug build, fresh install): device checks 1–7 and 9 pass.
- 2026-11-15, Android emulator, dark mode: device check 8 fails. The card's text turns light, but the debug screen and its
  header stay light, so the text is nearly unreadable. Light mode is fine. Deferred to a later session (`tasks/DEFERRED.md`).
- 2026-11-15, Android emulator: device check 10 passes except swipe feedback. A swipe triggers its grade, but nothing shows
  which direction gives which grade (`src/lesson/swipeable-card.tsx:11–16`). Deferred as out of the spike's scope
  (`tasks/DEFERRED.md`). The grade buttons, transitions, and haptics work.
- 2026-11-15, Android emulator: device check 12 passes. The deck's counts (2 new, 4 learning, 0 review) are the same after a
  force-quit and relaunch.
- 2026-11-15, Android emulator: device check 20 passes. A wrong pairing code says so.
- 2026-11-15, Android emulator: device checks 16 and 17 pass. The phone reached the host's server through
  `adb reverse tcp:8080 tcp:8080` at `http://localhost:8080`. The desktop library arrived and its image shows in a lesson,
  and a grade on the phone reached desktop.
- 2026-11-15, Android emulator: after joining, the library did not arrive until the app was force-quit and relaunched.
  At that point the server had no open bootstrap lease for the space. Not diagnosed.
- 2026-11-15, Android emulator: the Sync tab's content started under the status bar, which covered the server address
  field. `src/app/(tabs)/sync.tsx` now wraps the tab in `SafeAreaView` with the top edge. The Lessons tab was not checked
  for the same overlap.
- 2026-11-15, Android emulator: device check 18 is not met for a card created on desktop. After the phone synced it
  (its hot cursor reached the server's head) and the app was foregrounded, the Lessons list still did not show the card.
  It showed after a force-quit and relaunch. Not diagnosed: `refreshKinds` maps `cards` to the lessons queries that the
  list reads, so the cause is probably in the event path. A grade made on desktop failed the same way: the phone's Lessons list did not change after the app was foregrounded.
  The server shows the phone's hot cursor at the head (24) and the reviews at 9, so the phone had the change.
- 2026-11-15, Android emulator: device check 19 passes. After a force-quit and relaunch, the phone is still in the space
  and in sync.
- 2026-11-15, Android emulator: device check 11 passes. The Good interval on a new card matches desktop.
- Device checks 13 and 14 (release-build cold start and frame rate on a phone) are untested: no Android phone was
  available. The handoff in `tasks/DEFERRED.md` covers them.
- 2026-11-26: the human gave a go verdict on the emulator results, with the phone's feel, frame rate, and cold start
  untested. `docs/decisions/MOBILE-HOST.md` records the ruling.
- 2026-11-25, Android emulator (debug build): the two sync findings of 2026-11-15 marked "Not diagnosed" had one cause.
  UniFFI keeps one process-wide vtable per callback interface.
  The TS and the Kotlin bindings each register one for every callback interface in the crate.
  The Kotlin bindings load with the vault, after JS, so every sync event went to Kotlin.
  Kotlin dropped each one: logcat showed `UniffiHandleMap.get: Invalid handle`.
  The sync listener callback is gone; JS now asks for events.
- 2026-11-25, Android emulator (debug build): device check 18 passes against a second device on a fresh server.
  A deck pushed while the app was in the background showed when it returned to the foreground, with no relaunch.
  A deck pushed while the app was open showed within seconds.
  After joining, the library showed without a relaunch.
- 2026-11-25, Android emulator (debug build): after a JS reload from the dev menu, sync stopped with an error.
  Changes stopped arriving. The cause is the same clash, on the vault.
  The TS bindings register their `SecretVault` vtable on every JS start (`uniffiEnsureInitialized`).
  The Kotlin bindings register theirs once per process, and Rust keeps the first vault, which holds a Kotlin handle.
  After a reload its calls reach JS, which cannot find the handle. A force-quit recovers.
  The vault is now a component JS never loads.
  Since then, five dev-menu reloads in a row each kept sync idle, and every deck pushed after them showed.
- 2026-11-25: a device on the current engine joined the 2026-11-15 spike space and held at hot seq 14 with
  `CorruptEnvelope` on its first pull.
  The space predates the V1 baseline reset in `b3a1c98e`, which made `scheduled_days` a float at schema 1.
  Its card payloads hold an integer there, so they do not decode; spaces from before the reset are to be wiped.
