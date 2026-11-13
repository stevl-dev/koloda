# @koloda/mobile

Mobile app spike: React Native on Expo, with the UI drawn by native views.
It answers whether this stack is the right mobile host before a real app is built on it.
Role: dev tool (see `docs/decisions/APP-ROLES.md`).

## Where it sits

The app runs as an Expo development build on the New Architecture and Hermes, not in Expo Go.
Routes live in `src/app` (Expo Router): a native stack over native tabs.
It shares the TypeScript domain libraries with the other apps; Metro resolves them from source.
Data lives in `koloda`, in-process: `src-rust` (crate `koloda-mobile`) is a thin UniFFI façade over it,
and `native` (`@koloda/mobile-native`) is the React Native module uniffi-bindgen-react-native generates for it.
`src/host` turns the façade's JSON payloads into the TS domain types and its errors into `AppError`.
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

## Running

- `nx run @koloda/mobile:start` — the Metro dev server.
- `nx run @koloda/mobile:android` — builds the debug app and installs it on a running emulator or phone.
- `nx run @koloda/mobile:build-android` — compiles the debug app only; it starts no device or emulator.
  Both first build `koloda-mobile` for each Android target and regenerate its module
  (`nx run @koloda/mobile-native:build-android`).
- `nx run @koloda/mobile-native:bindings` — regenerates the TS bindings from a desktop build of `koloda-mobile`;
  run it and commit `native/src` after changing the façade's API.
- `nx run @koloda/mobile:test-rust` — the façade's Rust tests; `bun run check:push` runs them.
- `nx run @koloda/mobile:prebuild` — regenerates `android/` from the app config.
- `nx run @koloda/mobile:test` — Jest unit tests; `bun run test:app-unit` runs them.
- `nx run @koloda/mobile:typecheck`
- `nx run @koloda/mobile:lingui-extract` and `nx run @koloda/mobile:lingui-compile` — the English catalog.

## Device checks

Run on each platform before the spike's verdict.

- [ ] The app boots to the Lessons tab.
- [ ] The Lessons and Sync tabs both open.
- [ ] "Open the debug screen" on the Lessons tab shows four grades, each with an interval.
- [ ] A fresh install opens on the Lessons tab, which says there are no decks yet: the starter content has none.
  That answer came back from `koloda` through an async UniFFI call.
- [ ] On the debug screen, "Add a sample deck" adds a deck; the Lessons tab shows it with twelve new cards.
- [ ] After force-quitting and reopening the app, the sample deck still shows.

## Spike code

Code that exists only to answer a question, replaced by the follow-up:

- `src/app/(tabs)/index.tsx` and `src/components/lessons-list.tsx`: the deck list on the Lessons tab.
- `src/app/(tabs)/sync.tsx`: the Sync tab placeholder.
- `src/app/debug.tsx`, `src/components/debug-intervals.tsx`, and `src/components/sample-deck.tsx`: the debug screen.

## Copies

Code copied from another app instead of shared:

- `src/host/wire.ts` and its test, from `apps/electron-react/src/app/ipc.ts`: the JSON wire shapes.
- `src/host/setup.ts`, from `apps/electron-react/src/app/setup.ts`: the starter content and settings.
- The database worker and the payload helpers in `src-rust/src/lib.rs`, from `apps/electron/src-rust/src/lib.rs`.

## Findings

What building and running the spike showed:

- 2026-11-13, Android emulator (API 36, x86_64, debug build): every device check passes.
  The shared libs load under Hermes, async calls cross UniFFI, and the database survives a relaunch.
- Jest runs CommonJS, so ESM-only packages the shared libs import (`uuid`, `marked`) go through Babel there
  (`jest.config.js`).
  Metro bundles them as they are.
- `koloda`, `koloda-sync`, and `koloda-mobile` cross-build for `arm64-v8a` and `x86_64` unchanged,
  including the sync crate's networking dependencies.
- uniffi-bindgen-react-native links a static library by default; `native/ubrn.config.yaml` links the shared library
  the crate builds anyway, through its shared-library setting.
- The generated module's `build.gradle` names a ProGuard file the generator writes only for native bindings,
  and AGP 9 fails without it, so an empty one is committed (`native/.gitignore`).
- Each Expo prebuild writes `react` and an empty `scripts` into `package.json`; both are kept, so builds leave the
  tree clean.
- Bun installs peer dependencies, so Reanimated and Worklets arrive through `expo-router`'s drawer dependency,
  and autolinking compiles them into the app.
- The debug APK is about 250 MB.
- Expo locks an Android app to light mode unless the app config sets an interface style.
  That setting needs `expo-system-ui`, so the config leaves it unset until a change that follows the system scheme.
