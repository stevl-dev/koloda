# @koloda/mobile

Mobile app spike: React Native on Expo, with the UI drawn by native views.
It answers whether this stack is the right mobile host before a real app is built on it.
Role: dev tool (see `docs/decisions/APP-ROLES.md`).

## Where it sits

The app runs as an Expo development build on the New Architecture and Hermes, not in Expo Go.
Routes live in `src/app` (Expo Router): a native stack over native tabs.
It shares the TypeScript domain libraries with the other apps; Metro resolves them from source.
It targets Android only for now; iOS comes in a follow-up.

## Platform setup

An Android build machine installs:

- JDK 17;
- the Android SDK with platform 37, build tools 37.0.0, and NDK 27.1.12297006,
  with `ANDROID_HOME` pointing at the SDK;
- an emulator image, for running the app without a phone;
- the Rust targets `aarch64-linux-android` (phones) and `x86_64-linux-android` (the emulator on an x86-64 machine),
  through `rustup target add`;
- `cargo-ndk`, through `cargo install cargo-ndk`.

The Rust targets stay out of `rust-toolchain.toml`, so machines that build only the desktop app do not download them.

The Expo prebuild writes the Gradle project into `android/`, which is generated and not committed.

## Running

- `nx run @koloda/mobile:start` — the Metro dev server.
- `nx run @koloda/mobile:android` — builds the debug app and installs it on a running emulator or phone.
- `nx run @koloda/mobile:build-android` — compiles the debug app only; it starts no device or emulator.
- `nx run @koloda/mobile:prebuild` — regenerates `android/` from the app config.
- `nx run @koloda/mobile:test` — Jest unit tests; `bun run test:app-unit` runs them.
- `nx run @koloda/mobile:typecheck`
- `nx run @koloda/mobile:lingui-extract` and `nx run @koloda/mobile:lingui-compile` — the English catalog.

## Device checks

Run on each platform before the spike's verdict.

- [ ] The app boots to the Lessons tab.
- [ ] The Lessons and Sync tabs both open.
- [ ] "Open the debug screen" on the Lessons tab shows four grades, each with an interval.

## Spike code

Code that exists only to answer a question, replaced by the follow-up:

- `src/app/(tabs)/index.tsx` and `src/app/(tabs)/sync.tsx`: tab placeholders.
- `src/app/debug.tsx` and `src/components/debug-intervals.tsx`: the debug screen.

## Copies

Code copied from another app instead of shared:

- None yet.

## Findings

What building and running the spike showed:

- Jest runs CommonJS, so ESM-only packages the shared libs import (`uuid`, `marked`) go through Babel there
  (`jest.config.js`).
  Metro bundles them as they are.
- Expo locks an Android app to light mode unless the app config sets an interface style.
  That setting needs `expo-system-ui`, so the config leaves it unset until a change that follows the system scheme.
