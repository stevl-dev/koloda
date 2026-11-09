# Check for dead code on every push

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/BACKWARDS-COMPATIBILITY.md
Flow: local

## Intent

Dead code is found by audits, not by a check, so it accumulates between them.
The dead-code audit (archived as `tasks/archive/dead-code-audit.md`) found 103 exports nothing else used,
six unused root dependencies, and unused parameters and members.
Its export probe was a one-off script and was not kept.
Between audits, nothing catches dead code:
oxlint's `no-unused-vars` sees only locals, and clippy's `dead_code` sees only items that are not `pub`.

This task makes the check permanent: knip for TypeScript, `cargo machete` for Rust dependencies.
Duplicated helpers and speculative parameters stay with review and audits; no tool finds them reliably.

The human's constraint is check time.
Measured on `main` at `265f6d48`:

- CI job `checks` takes about 3 minutes for a TS-only change and about 7 for a change that touches Rust.
  The TS track is the critical path in the first case: 150 s, of which lib tests are 95 s.
  The Rust track is the critical path in the second: 389 s, clippy 213 s.
- knip with no config runs in 6.0–6.7 s locally (three runs).
  It adds only to the TS track, so it adds nothing to a change that touches Rust.
- `cargo machete` scans `Cargo.toml` files and sources as text without compiling; not measured yet.

knip with no config on `main` at `265f6d48` reports 350 lines, most of them noise:

| Category | Count | Mostly |
| --- | --- | --- |
| Unused files | 36 | False: CSS, `lingui.config.ts`, Playwright configs, `test-setup.ts`, locale files, `preload.ts` |
| Unlisted dependencies | 175 | `@koloda/*` imports; workspace imports are `check:workspace-deps`'s job, not knip's |
| Unresolved imports | 10 | `test-setup.ts` paths in each `vitest.config.mjs` |
| Unused dependencies | 3 | Root: `@tailwindcss/typography`, `tailwindcss-react-aria-components`, `tw-animate-css` |
| Unused devDependencies | 5 | Root: `@lingui/format-po`, `@lingui/swc-plugin`, `@nx/web`, `@swc/helpers`, `@types/web` |
| Unused exports | 26 in 13 files | Mixed; see below |
| Unused exported types | 105 | `*Props` and `*Options` types used only in their own file; see Open questions |
| Duplicate exports | 1 | `libs/srs/src/lib/reviews.ts`: `reviewValidation` and `reviewRowSchema` |

The dependency rows may be false too: Tailwind plugins load from CSS `@plugin`, and Lingui and SWC from config.

Unused exports reported:

- `apps/electron/src/window.ts`: `TITLEBAR_HEIGHT`.
- `createQueryClientWrapper`, in both `libs/assistant-react/src/test/test-helpers.tsx`
  and `libs/srs-react/src/test/test-helpers.tsx`.
- `libs/ui/src/lib/layout/header-scroll.tsx`: `useReportLayoutHeaderScroll`.
- `libs/ui` form and overlay primitives, 21 symbols:
  `FormLayoutSection`, `FormLayoutSectionTerm`, `FormLayoutSectionContent`, `numberField`, `numberFieldGroup`,
  `sliderRoot`, `SliderContainer`, `SliderTrack`, `SliderThumb`, `TextFieldTextArea`, `timeField`,
  `timeFieldSegment`, `toggleGroup`, `toggleGroupItem`, `ToggleGroupItem`, `dialogClose`, `searchField`,
  `searchFieldGroup`, `searchFieldInput`, `SearchFieldInput`, `TableBodyRow`.

Done when `bun run check:push` fails on an unused export, file, or dependency in TypeScript, or an unused Rust
dependency, and passes on `main`; and the TS track takes no more than 15 s longer than before.

## Scope

In:

- A knip config for the workspace, run from `check:ts`.
- Fixing or deleting what the configured knip reports.
  Code that is unused is deleted, per `agents/BACKWARDS-COMPATIBILITY.md`.
  A knip ignore is allowed only for intentional surface, with a comment giving the reason.
- `cargo machete` in the Rust track, and its CI install.
- The `agents/CODE-STYLE.md` §Props Types example, so it does not export a props type the check would flag.
- The `tools/check-push.ts` header and any README that lists what the push gate runs.

Out:

- `@koloda/*` imports and layer rules: `check:workspace-deps` owns them.
- Unused Rust `pub` items across crates; no tool finds them reliably.
- Duplicated helpers and speculative parameters.
- Making the existing checks faster.

## Open questions

- [x] Are the 21 `libs/ui` primitive exports intentional design-system surface, kept for apps to compose,
  or dead? — Dead as exports; drop the `export` keyword and keep the code. No knip ignores.
  Evidence, on `335d7cc4`:
  - `libs/ui/src/index.ts` is the package's only entry and re-exports by name.
    None of the 21 is in it, so no other package can import them.
  - 9 are compound-component members, still used through the parent:
    `FormLayout.Section` and its `Term` and `Content`, `Slider.Container`, `Slider.Track`, `Slider.Thumb`,
    `TextField.TextArea`, `ToggleGroup.Item`, `SearchField.Input`.
    The `Parent.Member = Member` assignment keeps them reachable without the export.
  - 11 are `tv()` style recipes used only in their own file:
    `numberField`, `numberFieldGroup`, `sliderRoot`, `timeField`, `timeFieldSegment`, `toggleGroup`,
    `toggleGroupItem`, `dialogClose`, `searchField`, `searchFieldGroup`, `searchFieldInput`.
    Recipes with outside users (`formLayout`, `link`, `overlayFrame`) are re-exported from the index; these are not.
  - `TableBodyRow` is used only in `table-body.tsx`.
- [x] Should knip check exported types too (105 reports), or only values, files, and dependencies? —
  Check types. Ignore the generated `libs/app-react/src/lib/routeTree.gen.ts`.
  Evidence: knip 5.88.1 with `--include types` on `335d7cc4` reports 121 types
  (the Intent table's 105 came from an earlier run; the difference was not traced).
  - 5 are in the generated TanStack Router file `routeTree.gen.ts`.
  - The other 116 are 92 `*Props`, 20 `*Options`, and `WindowState`, `NavigationDecision`,
    `WindowCloseCoordinatorHooks`, `WebBoot`.
    Every one is used in its own file, so the fix is dropping `export`, not deleting the type.
  - The repo already holds 238 unexported `*Props` types beside 222 exported ones, so unexported props are not new.
  - Libs build with `composite: true`; declaration emit already handles unexported props types in exported signatures.
  - `agents/CODE-STYLE.md` §Props Types shows `export type SelectProps` as the good example;
    it changes so the guide and the check agree.
- [x] `cargo machete` is a cargo binary, not a bun dependency.
  CI can install a pinned version with a prebuilt binary.
  Locally, should `check:push` require it, or skip it when it is not installed, as the pre-commit hook does for dprint?
  `land` waits for CI either way. — Skip locally when not installed.

## Plan

- [ ] 1. Configure knip for the workspace
  Goal: Add a knip config at the repo root that knows the workspace's entry points and tools,
  so its report holds only real findings.
  It covers the Nx, Vite, Vitest, Playwright, and Lingui setups; CSS entry points and Tailwind's CSS `@plugin` loads;
  `test-setup.ts` files; Electron's `preload.ts`; generated locale files; and `tools/`.
  It leaves `@koloda/*` imports to `check:workspace-deps`.
  It checks unused exported types, and ignores the generated `libs/app-react/src/lib/routeTree.gen.ts`.
  Pin knip as a root dev dependency.
  Add a `check:dead-code` script that runs it; do not wire it into `check:ts` yet.
  Constraints: Config and `package.json` only; no source changes.
  Every ignore entry carries a comment giving the reason.
  Done when: `bun run check:dead-code` reports none of the false categories in the Intent table,
  and the findings it still reports are listed in this file's Plan item 2.
  Commit: Configure knip for the workspace
  Depends on: none

- [ ] 2. Remove the dead code knip reports
  Goal: Fix every finding item 1 leaves: delete unused exports, files, and dependencies,
  or make a symbol local when its own file uses it.
  Resolve the duplicate export in `libs/srs/src/lib/reviews.ts`.
  The 21 `libs/ui` primitives and the unused exported types are used in their own files:
  drop `export` and keep the code, as Open questions records.
  Change the `agents/CODE-STYLE.md` §Props Types good example so it does not export the props type.
  Where a symbol is intentional surface, add a knip ignore with the reason instead.
  Constraints: Follow `agents/BACKWARDS-COMPATIBILITY.md`; do not keep a symbol "in case".
  No behavior changes.
  Done when: `bun run check:dead-code` exits 0, and `bun run check:push` passes.
  Commit: Remove the dead code knip reports
  Depends on: 1

- [ ] 3. Run knip in the push gate
  Goal: Add `check:dead-code` to `check:ts`, and update the `tools/check-push.ts` header that lists the TS track.
  Constraints: Do not change what any other check runs.
  Done when: `bun run check:push` passes; adding an unused export to a lib makes it fail;
  and Outcome records knip's run time locally and the TS track time on the CI run of the tip.
  Commit: Run knip in the push gate
  Depends on: 2

- [ ] 4. Check for unused Rust dependencies
  Goal: Run `cargo machete` over the Cargo workspace in `check:rust-push`, and install a pinned version in CI.
  Fix what it reports, or add a `[package.metadata.cargo-machete]` ignore with the reason
  for a dependency used only through a macro or a build script.
  Locally, skip the step when `cargo machete` is not installed, and print that it was skipped and how to install it.
  In CI (`CI` set), a missing binary fails the step, so a broken install cannot pass silently.
  Constraints: Do not change Rust code beyond removing unused dependencies.
  Done when: `bun run check:push` passes; adding an unused dependency to `crates/koloda/Cargo.toml` makes it fail;
  and Outcome records the step's time on CI.
  Commit: Check for unused Rust dependencies
  Depends on: none

## Outcome
