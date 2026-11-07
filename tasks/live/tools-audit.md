# Tools audit fixes

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/BACKWARDS-COMPATIBILITY.md, agents/MARKDOWN.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/REVIEW.md
Flow: local

## Intent

Settle every finding of the `tools/` (other than CI) package audit as one task.

- The audit ran at `488b3f4a` and wrote its report to `tmp/audits/tools.md`.
  This file restates every finding, so the report is not needed.
- It read `tools/land.ts` and its test, `tools/hooks/pre-commit` and `commit-msg`, `tools/workspace-deps/`
  (`contract.ts`, `layers.ts`, their tests) with the CLI `tools/check-workspace-deps.ts`, `tools/check-markdown.ts`,
  `tools/docs.test.ts`, `tools/vite-plugin-theme-boot.ts`, `tools/vitest.config.mjs`, the Lingui macro mock, and the
  `package.json` scripts that run them.
  `tools/check-push.ts` and `.github/workflows/` stayed with the CI audit (`tasks/archive/ci-audit.md`).
- Command run: `bun run check:workspace-deps` (5 files, 277 tests, and the tripwire), green.
- Probes:
  - a copy of `land.ts` with short timeouts and a fake `gh` on `PATH` (finding 1);
  - two mutated copies of `tools/workspace-deps/` and a one-lib fixture tree (finding 4);
  - the `docs.test.ts` path and pointer rules applied outside their reach (finding 3);
  - `check-markdown.ts` run with absolute and subdirectory-relative paths (finding 7).
- The audit found 10 findings: 2 Should-fix, 8 Later; no Must-fix, no product decision.
- Triage ran at `50d3d4e8` (`origin/main`; `git fetch` failed offline, so `origin/main` is as of the last fetch).
  Since the audit, only `apps/web/vitest.config.mjs` changed among cited files (it gained a `__dirname`-based alias,
  `fs.allow`, and `setupFiles`); its `cacheDir` and repo-root `include` are unchanged, so finding 6 holds.
  Every cited line was re-read and holds; counts below are re-taken at `50d3d4e8`.

Done when:

- `bun run land` keeps waiting through a failed `gh api` poll once a `checks` run was seen, and a test pins that;
- the doc checks that can fail run under their own script, which the markdown and spec guides name, and those guides
  call `check:markdown` advisory;
- the section-pointer check also reads code comments and the `FILE.md §Name` form, and the two stale pointers are fixed;
- one `checkWorkspace` test runs the tripwire on a fixture tree;
- `apps/web` may no longer import `wa-sqlite`;
- no Vitest config writes its cache outside the checkout;
- `check-markdown.ts` reads the file each argument names;
- the inventory pin, the untagged comments, and the surplus exports in `tools/` are gone;
- `bun run check:push` passes on the tip, and every plan item is one commit with a `Task:` trailer.

## Scope

In: every finding below, fixed as its decision says.
None is skipped.

Out:

- `tools/check-push.ts` beyond what item 2 needs, and `.github/workflows/` beyond the docs-only step (CI audit).
- The callers of the theme-boot plugin and the Lingui mock.
- Renaming `check:workspace-deps`: after item 2 it still runs the `land` and `check-push` tests besides the tripwire.
  The name is kept; see Open questions.
- The e2e suites. No item adds or edits an e2e case, so the suite-run rule (`agents/TASKS.md` §Done) does not apply.

Overlap:

- `task/mobile-spike` (local, `Status: draft`) item at its line 365 says "`bun run check:workspace-deps` passes, which
  runs the docs tests", and line 366 gates on `check:markdown`.
  Item 2 makes both stale: that plan should say `bun run check:docs`.
  This task does not edit that branch; the human decides when to update it.
  No file overlap otherwise.
- Remote `task/*` branches could not be listed (offline).
- Untriaged reports:
  - `dead-code.md`: finding 10 (surplus exports in `tools/`) is taken from it; that triage should not re-raise it.
  - `i18n.md` finding 1 adds a step to `tools/check-push.ts`; item 2 here may also touch `check-push.ts` (only its
    header comment). Whichever lands second rebases.
  - The "Guides and docs" concern (not yet audited): finding 3 fixes two stale pointers and item 2 edits
    `agents/MARKDOWN.md`, `agents/FUNCTIONAL-SPECIFICATIONS.md`, `agents/INDEX.md:81`, and `README.md:65-68`; that
    audit should not re-raise them.
    The report also handed it the three prose lines over 120 characters (`agents/INDEX.md:30,33`,
    `libs/ui/README.md:30`); not taken here.

Entries use the report's numbers.
Paths are relative to the repo root.

### Risk

- 1. Risk, Should-fix: a failed `gh api` poll ends the landing as "no run appeared".
  Decision: fixed by item 1.
  - `tools/land.ts:178`, in `waitForChecks`, turns a failed poll (`fetchCheckRuns` returns `null`, `:135-144`) into
    `{ kind: "missing" }`.
  - `:185-188` fails a `missing` state once `waited > START_TIMEOUT_MS` (3 minutes, `:23`).
    `waited` counts from the start of the wait (`:174`), and ignores whether a run was already shown (`shown`, `:175`).
  - So after the third minute one transient API error ends the landing, with "no `checks` run appeared for <sha>;
    check the CI workflow triggers", although "waiting for `checks` on …" was already printed.
  - Probe: POLL 20 ms, start timeout 200 ms, a fake `gh` that reports an in-progress run 15 times and then fails like a
    TLS timeout. Output: "waiting for …", "gh api failed, retrying", "no `checks` run appeared"; 16 `gh` calls.
  - It happened on 2026-11-04 landing `electron-main-audit`: the first `bun run land` stopped on a GitHub API timeout
    while `checks` had passed; a re-run landed.
  - The waiting loop has no test; only `checkState` does (`land.test.ts:107-125`).

- 2. Risk, Should-fix: the doc checks that can fail are unnamed; plans gate on one that cannot.
  Decision: fixed by item 2.
  - `tools/check-markdown.ts:1-12` checks prose line length only and always exits 0 (`:4`, `:76`), deliberately.
  - Plans still use it as a gate: 47 lines in 19 files under `tasks/archive/` cite `check:markdown`
    (`grep -rn 'check:markdown' tasks/archive`).
    `tasks/archive/lessons-audit.md:715` expects it to prove "every `§` pointer names an existing heading".
  - The markdown checks that can fail live in `tools/docs.test.ts`: guide paths exist, spec shape, Title Case headings,
    no code names in specs, decision reachability, archive shape, `(§…)` pointers.
    They run only through `tools/vitest.config.mjs` (`include: ["tools/**/*.test.ts"]`), which
    `check:workspace-deps` runs (`package.json:16`); `check:ts` runs that (`package.json:26`), and the CI docs-only
    path runs it directly (`.github/workflows/ci.yml:109-111`).
  - No guide names them. `agents/MARKDOWN.md`, `agents/FUNCTIONAL-SPECIFICATIONS.md`, and `agents/DECISIONS.md` name
    no check command; `agents/INDEX.md:81` routes `check:workspace-deps` as "Workspace dependency layers";
    `README.md:65-68` lists it as "workspace layers".
    Only the comment at `ci.yml:30-32` says `docs.test.ts` runs there.
  - Effect: a doc edit "verified" by its plan reaches CI unchecked; a broken pointer fails `checks` during `land`, and
    the task must reset its Archive commit (`agents/TASKS.md` §Fix after Archive).

- 3. Risk, Later: the pointer check reads only markdown and only `(§…)`.
  Decision: fixed by item 3.
  - `tools/docs.test.ts:158` (`describe("section pointers")`) scans `allMarkdown()` only, and the pattern at `:168`
    requires the parenthesised form `(§…)`.
  - Unchecked at `50d3d4e8`: 194 `FILE.md §Name` pointers (9 in markdown outside `tasks/`, the rest in code comments)
    and 30 `FILE.md (§Name)` pointers in code comments.
    Counted with `git grep -E '\.md`? §'` and `git grep -E '\.md`?\s*\(§'`, excluding `tasks/` and the test itself.
  - Two are wrong today:
    - `libs/assistant-react/src/lib/state/conversation-reducer-messages.test.ts:388` points at
      `ASSISTANT-CHAT-REFACTOR.md §E`. No such file has ever been in the repository
      (`git log --all -- '*CHAT-REFACTOR*'` is empty); the comment dates from `3b76e513` (2026-07-23).
    - `libs/settings-react/src/lib/sync/sync-first-run-join.tsx:18` points at `SYNC.md` §First run; the heading is
      "First Run" (`docs/specs/SYNC.md:119`).
  - At the audit, every other flagged pointer resolved once a line wrap was joined (186 checked).
  - Fix direction: extend the check to tracked source files' comments and the `FILE.md §Name` form; accept text after
    `§` that a line wrap cut short as a prefix of a heading.

- 4. Risk, Later: no test runs the tripwire end to end; a dropped rule stays green.
  Decision: fixed by item 5.
  - `tools/workspace-deps/contract.ts:314-317` feeds `compareDirection` with
    `[...compared.imported, ...compared.external]`; the `external` half makes `wa-sqlite` exclusivity fire
    (`layers.ts:43`).
  - Probe: with `...compared.external` removed, all 54 workspace-deps tests still pass.
    On a fixture with one lib, `@koloda/ui`, whose source imports `wa-sqlite`, the real `checkWorkspace` reports
    "wa-sqlite is exclusive to …"; the mutated one reports nothing.
    A control mutation in `layers.ts` was caught by `layers.test.ts:115`.
  - Also untested: `isLib` dropping manifest checks for apps (`contract.ts:324-336`), apps without a `package.json`
    named after their directory (`:271-279`), packages outside `@koloda/` skipped (`:260`).
    The live run cannot tell "no violations" from "scanned nothing".

- 5. Risk, Later: `wa-sqlite` lets `apps/web` import it, though web never has.
  Decision: fixed by item 4.
  - `tools/workspace-deps/layers.ts:43` lists `["@koloda/db-sqlite", "@koloda/web"]`; `layers.test.ts:125` pins web as
    allowed (and `:121-123` pins the reason string naming both).
  - `git grep wa-sqlite apps/web/src` is empty, and was when the entry was added in `2a87ad52` (2026-09-27).
  - The only web mention is `optimizeDeps.exclude` in `apps/web/vite.config.ts` and `apps/web/vitest.config.mjs`,
    which the scan never reads, as the comment at `layers.ts:40-42` says.
  - What the entry does allow: web source opening the backend directly, which `apps/web/README.md:42` says web does not
    own ("persistence schema — `@koloda/db-sqlite`").

- 6. Risk, Later: Vitest caches resolve outside the checkout.
  Decision: fixed by item 6.
  - `tools/vitest.config.mjs:4` sets `cacheDir: "../node_modules/.vite/tools"` with no `root`, so Vitest resolves it
    against the working directory, the repo root (`include: ["tools/**/*.test.ts"]` only matches from there).
    The audit's run wrote `results.json` one level above the checkout.
  - Twins: 13 lib configs (every `libs/*/vitest.config.mjs:8`, plus `libs/srs/vitest.dst.config.mjs:10`) and
    `apps/web/vitest.config.mjs:8` use `../../node_modules/.vite/…` with repo-root include globs, so their caches sit
    two levels above the checkout.
  - The app Vite configs are right because they set `root: __dirname` (`apps/web/vite.config.ts:14`).
  - Effect: timing caches land outside the repository, shared by every project under the same parent.
    `agents/TESTING.md:230` relies on `results.json` timings for file order.

- 7. Risk, Later: `check-markdown.ts` joins its arguments to the repo root.
  Decision: fixed by item 7.
  - `tools/check-markdown.ts:62` takes file arguments as given, and `:49` reads `join(root, file)`.
  - An absolute path crashes: `bun run tools/check-markdown.ts "$PWD/README.md"` threw ENOENT on
    `<repo>/home/…/README.md` and exited 1, against the header's "always exits 0" (`:4`).
  - A path relative to a subdirectory checks the wrong file silently: from `apps/web`,
    `bun run ../../tools/check-markdown.ts README.md` checked the root `README.md`.

### Improvement

- 8. Improvement, Later: `layers.test.ts:56` pins the list of exclusive packages.
  Decision: fixed by item 8.
  - `tools/workspace-deps/layers.test.ts:53-56` asserts the `@koloda` keys of `EXCLUSIVE_CONSUMERS` equal
    `["@koloda/db-sqlite", "@koloda/e2e", "@koloda/native-ipc"]`: an inventory pin (`agents/TESTING.md` §Banned
    patterns). Adding an exclusive package fails it; no bug does.
  - The loop after it (`:57-59`, each key is in `PACKAGE_LAYERS`) is the real rule.

- 9. Improvement, Later: untagged inline comments (`agents/CODE-DOCUMENTATION.md` §Strict Commenting Rules).
  Decision: fixed by item 9, except `layers.ts:40-42`, which item 4 rewrites.
  - `tools/land.ts:196`: "Moves a local main that is not checked out anywhere; harmless when it cannot." A WHY without
    the tag.
  - `tools/workspace-deps/layers.ts:40-42`: an untagged rule that repeats the INVARIANT at `contract.ts:65-67`.
  - `tools/workspace-deps/contract.ts:186-187`: why external specifiers never count as missing or phantom; a WHY without
    the tag, and a second home for the rule at `contract.ts:65`.
  - `tools/vite-plugin-theme-boot.ts:8`: a JSDoc that narrates the function.

- 10. Improvement, Later: surplus exports.
  Decision: fixed by item 10.
  - Exported and used only in their own file: `tools/land.ts:201` `land` (only caller `:234`), `:33` `CheckState`;
    `tools/workspace-deps/contract.ts:7` `ReferenceKind`, `:9` `WorkspaceReference`, `:18` `UnresolvableReference`,
    `:26` `ManifestIssue`, `:44` `WorkspaceCheckResult`.
  - Search: `git grep -l -E '\b<name>' -- tools` hits only the defining file for each.
  - `agents/BACKWARDS-COMPATIBILITY.md` says not to leave unused exports.

## Open questions

- [x] How does item 2 split the scripts? — Triage choice, open for edit at approval: a new `check:docs` runs
  `tools/docs.test.ts` alone; `check:workspace-deps` excludes it and keeps the other `tools/` tests and the tripwire;
  `check:ts` runs both; the CI docs-only path runs `check:format` and `check:docs`.
  Rejected: renaming `check:workspace-deps` to a `tools` name (wider churn, and `task/mobile-spike` cites it).
- [x] Item 6: repo-root-relative strings, or paths resolved from the config's own directory? — Resolved from the
  config's directory (triage choice), so the cache stays in the checkout whatever the working directory.
- [ ] Should `task/mobile-spike`'s two Done-when lines (its file, lines 365-366) be updated to `bun run check:docs`
  after item 2 lands? — open, the human's call; this task does not touch that branch.

## Plan

- [x] 1. Keep waiting for checks through a failed poll after the run appeared
  Goal: fix finding 1. In `tools/land.ts`, a failed `gh api` poll is unknown, not missing.
  - Add a pure step beside `checkState`, for example
    `nextWait({ runs, shown, waited }): "keep" | "done" | { fail: string }` (name and shape free), that takes the
    poll result (`CheckRun[] | null`), whether a run has been seen, and the elapsed time.
    It applies `START_TIMEOUT_MS` only while no run has been seen, `RUN_TIMEOUT_MS` always, and treats `null` as
    "keep" under both. A `null` before any run was seen still counts toward the start timeout.
  - `waitForChecks` keeps its I/O (fetch, log once, sleep) and delegates the decision to it.
    The "no run appeared" message stays for the case where no run was ever seen.
  - Tests in `tools/land.test.ts`: an API error after a run was seen and past the start timeout keeps waiting; no run
    and past the start timeout fails with the triggers message; past the run timeout fails; success and failure end.
  Constraints: `tools/land.ts`, `tools/land.test.ts` only. No change to the task gate.
  Done when: `bunx vitest run --config tools/vitest.config.mjs --configLoader runner tools/land.test.ts` passes, and
  `bun run check:workspace-deps` passes.
  Commit: Keep waiting for checks when a poll fails after the run appeared
  Depends on: none

- [x] 2. Run the docs tests as check:docs and name it in the guides
  Goal: fix finding 2.
  - `package.json`: add `"check:docs": "bunx vitest run --config tools/vitest.config.mjs --configLoader runner
    tools/docs.test.ts"`. Make `check:workspace-deps` exclude `tools/docs.test.ts` (Vitest `--exclude`), and add
    `bun run check:docs` to `check:ts`, so `check:push` still runs it.
  - `.github/workflows/ci.yml`: the docs-only branch (`:109-111`) runs `check:format` and `check:docs`; update the
    comment at `:30-32` to name `check:docs`.
  - `tools/check-push.ts:3`: its header lists what `check:ts` runs; add the docs tests.
  - `agents/MARKDOWN.md`: name `bun run check:docs` as the check a markdown edit must pass, and say `check:markdown`
    only reports long lines, always exits 0, and is not a Done-when.
  - `agents/FUNCTIONAL-SPECIFICATIONS.md`: name `bun run check:docs` for the spec shape rules it enforces.
  - `agents/INDEX.md:81` stays: it routes the tripwire, which `check:workspace-deps` still runs.
  - `README.md:65-68`: list `bun run check:docs` ("docs rules: paths, spec shape, § pointers") and mark
    `check:markdown` advisory.
  - Do not edit archived task files.
  Constraints: no change to what `docs.test.ts` checks.
  Done when: `bun run check:docs` runs only `tools/docs.test.ts` and passes; `bun run check:workspace-deps` no longer
  runs it and passes; a deliberately broken `(§…)` pointer in a scratch edit fails `check:docs` (revert it);
  `bun run check:docs` passes on the guide edits.
  Commit: Run the docs tests as check:docs and name it in the guides
  Depends on: none

- [x] 3. Check section pointers in code comments and the bare FILE.md § form
  Goal: fix finding 3.
  - Extend the "section pointers" block in `tools/docs.test.ts` to read tracked source files (`git ls-files` for
    `*.ts`, `*.tsx`, `*.rs`, `*.mjs`, and the like; skip `tasks/` and the test itself) as well as markdown.
  - Accept `FILE.md §Name` as well as `FILE.md (§Name)`; a bare `(§Name)` still points into its own file and only in
    markdown.
    For the bare form, the section name runs to the end of the comment line or a closing quote or backtick; accept it
    when it is a prefix of an existing heading, since a line wrap may cut it short. State that heuristic in a `WHY:`.
  - Fix the two stale pointers: `conversation-reducer-messages.test.ts:388` drops the `ASSISTANT-CHAT-REFACTOR.md §E`
    reference (keep the rest of the WHY); `sync-first-run-join.tsx:18` says `SYNC.md` §First Run.
  - Any further pointer the new check flags is fixed in the same commit; list them in the commit body.
  Constraints: `tools/docs.test.ts` and the comments it flags. Tag the pointer case and placeholder rules as they are.
  Done when: `bun run check:docs` passes; reverting either stale-pointer fix makes it fail.
  Commit: Check section pointers in code comments and the bare FILE.md § form
  Depends on: 2

- [x] 4. Stop allowing apps/web to import wa-sqlite
  Goal: fix finding 5, and finding 9's `layers.ts:40-42` comment.
  - `tools/workspace-deps/layers.ts:43`: `"wa-sqlite": ["@koloda/db-sqlite"]`.
  - Rewrite the comment at `:40-42`: drop the web parenthetical; keep only what `contract.ts:65-67`'s INVARIANT does not
    already say, tagged, or delete it.
  - `layers.test.ts:121-125`: the reason string names only `@koloda/db-sqlite`, and `@koloda/web` importing
    `wa-sqlite` is rejected.
  Constraints: `tools/workspace-deps/layers.ts`, `layers.test.ts`.
  Done when: `bun run check:workspace-deps` passes (so no web source imports `wa-sqlite`).
  Commit: Stop allowing apps/web to import wa-sqlite
  Depends on: none

- [x] 5. Test the workspace tripwire end to end on a fixture tree
  Goal: fix finding 4.
  - Add a fixture tree under `tools/workspace-deps/` (for example `fixtures/basic/`) with: a lib `@koloda/ui` whose
    source imports `wa-sqlite` and an `@koloda` package its `package.json` does not declare; an app directory without a
    `package.json` named after it; a package outside `@koloda/`.
  - One `checkWorkspace(fixtureRoot)` test asserts the exclusivity violation ("wa-sqlite is exclusive to
    @koloda/db-sqlite"), the missing dependency, no manifest issues for the app, and that the outside package is
    skipped. Assert the libs scanned, so "scanned nothing" fails.
  - Keep the fixture out of the live scan and out of `tsc -b` (check `tsconfig` includes and `isProductionSource`).
  Constraints: `tools/workspace-deps/` only.
  Done when: `bun run check:workspace-deps` passes; removing `...compared.external` at `contract.ts:316` makes the new
  test fail (revert it).
  Commit: Test the workspace tripwire end to end on a fixture tree
  Depends on: 4

- [x] 6. Keep Vitest caches inside the checkout
  Goal: fix finding 6.
  - In `tools/vitest.config.mjs`, all 12 `libs/*/vitest.config.mjs`, `libs/srs/vitest.dst.config.mjs`, and
    `apps/web/vitest.config.mjs`, resolve `cacheDir` from the config's own directory
    (`resolve(dirname(fileURLToPath(import.meta.url)), "../../node_modules/.vite/…")`, `../node_modules` for `tools/`),
    keeping each cache's current name.
  Constraints: `cacheDir` lines and the imports they need; no other config change.
  Done when: after `nx run-many -t test --skip-nx-cache` for the libs and `bun run check:workspace-deps`, new
  `results.json` files appear under `<repo>/node_modules/.vite/` and none newer appear in the parent directories;
  `bun run check:ts` passes.
  Commit: Keep Vitest caches inside the checkout
  Depends on: none

- [ ] 7. Resolve check-markdown arguments against the working directory
  Goal: fix finding 7.
  - `tools/check-markdown.ts`: resolve explicit arguments against `process.cwd()`; keep `root` for the git-derived list.
    Print paths relative to `root` as now.
  Constraints: `tools/check-markdown.ts` only.
  Done when: `bun run tools/check-markdown.ts "$PWD/README.md"` exits 0 and checks the root README; from `apps/web`,
  `bun run ../../tools/check-markdown.ts README.md` checks `apps/web/README.md`.
  Commit: Resolve check-markdown arguments against the working directory
  Depends on: none

- [ ] 8. Drop the exclusive-package inventory pin
  Goal: fix finding 8. Delete the `toEqual` at `tools/workspace-deps/layers.test.ts:56`; keep the loop.
  Constraints: that test only.
  Done when: `bun run check:workspace-deps` passes.
  Commit: Drop the exclusive-package inventory pin
  Depends on: 4

- [ ] 9. Tag or drop the untagged comments in tools
  Goal: fix finding 9's other three comments.
  - `tools/land.ts:196`: tag as `// WHY:`.
  - `tools/workspace-deps/contract.ts:186-187`: delete it, leaving `contract.ts:65-67` as the one home; extend that
    INVARIANT if it does not already say external specifiers never count as missing or phantom.
  - `tools/vite-plugin-theme-boot.ts:8`: delete the narrating JSDoc, or replace it with a `WHY:` on why the file must
    paint before CSS.
  Constraints: comments only.
  Done when: `bun run check:workspace-deps` and `bun run lint` pass.
  Commit: Tag or drop the untagged comments in tools
  Depends on: 4

- [ ] 10. Drop surplus exports in tools
  Goal: fix finding 10. Remove `export` from `land` and `CheckState` in `tools/land.ts`, and from `ReferenceKind`,
  `WorkspaceReference`, `UnresolvableReference`, `ManifestIssue`, and `WorkspaceCheckResult` in
  `tools/workspace-deps/contract.ts`. Re-run the search first; keep any that item 1 or 5 now imports from a test.
  Constraints: `export` keywords only.
  Done when: `bun run typecheck` and `bun run check:workspace-deps` pass.
  Commit: Drop surplus exports in tools
  Depends on: 1, 5

## Outcome

<what shipped>
