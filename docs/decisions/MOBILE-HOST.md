# Mobile Host

## Ruling

- The mobile app is React Native on Expo (New Architecture, Hermes), with its UI drawn by native views.
- `koloda` and `koloda-sync` run in-process, exported with UniFFI through a façade crate (`apps/mobile/src-rust`).
  uniffi-bindgen-react-native generates the JS bindings.
- The TypeScript domain libraries (`@koloda/srs`, `@koloda/app`, `@koloda/core-react`) are shared with the other
  apps, not reimplemented for mobile.
- Secrets stay native: a platform vault registers with Rust and never passes a secret through JS.

## Why

The shared domain libraries and the in-process Rust core keep one scheduler, one markdown parser, and one sync engine,
which synced devices must agree on.
The verdict rests on the Android emulator: the stack builds, the shared libs load under Hermes, async calls cross
UniFFI, lessons grade with the desktop's intervals, and sync works both ways.
On a phone, swipe feel, frame rate, and release-build cold start are not yet checked, and iOS is not checked at all.
A failure there reopens this ruling.

## Applies when

- A change to `apps/mobile`, its façade crate, or `@koloda/mobile-native`.
- A change to a shared library or to `koloda` that mobile consumes, when it would need a mobile-only fork.
- Desktop-only or web-only changes do not need this file.

## Rejected designs

- No WebView shell (Tauri, Capacitor) — the desktop app already left Tauri because native WebViews were painful.
- No fully native UI (SwiftUI, Compose) — scheduling, the assistant, and markdown would each need a second
  implementation that synced devices must agree with.
