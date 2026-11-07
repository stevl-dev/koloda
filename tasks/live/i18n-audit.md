# i18n audit fixes

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/I18N.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/BACKWARDS-COMPATIBILITY.md, agents/MARKDOWN.md, agents/REVIEW.md
Flow: local

## Intent

Settle every finding of the i18n concern audit as one task.

- The audit ran at `4b1f2911` and wrote its report to `tmp/audits/i18n.md`.
  This file restates every finding, so the report is not needed.
- Its question: are the Lingui catalogs complete and in step with the source, in both locales, and does any
  user-visible text bypass them or reach the user as a raw id or a fallback?
- It read `agents/I18N.md`, the root `lingui.config.ts` and the three app configs (`apps/web`, `apps/electron-react`,
  `apps/design-system`), all 22 `messages.po` files (nine libs and two apps, each `en` and `ru`: 730 messages per
  locale), the committed compiled catalogs `apps/{web,electron-react}/src/app/locales/{en,ru}.ts`, each app's
  `i18n.ts`, and every `msg`, `Trans`, `plural`, and `_()` call in `libs/*/src` and `apps/*/src`.
- Commands run, in a throwaway worktree: `bunx lingui extract --clean` and `bunx lingui compile` from both apps, and
  the documented `nx run @koloda/web:lingui-extract --clean` / `lingui-compile`; the `libs/ui` and `libs/app` Vitest
  suites, green.
- Probes: extract and compile diffs, a PO scan (id convention, ids in several catalogs, placeholders, plural forms,
  empty strings), a scan for Latin words in Russian strings, a memoized-translation scan, and a Vitest probe of the
  form schemas on a cleared (`NaN`) number field.
- Verdict: the catalogs are complete (no empty string, no orphan; a fresh compile reproduces the committed files byte
  for byte), and no TSX renders hard-coded text. What is weak is how that state is kept, and two paths where text
  reaches the user as something other than its message.
- The audit found 7 findings: 2 Should-fix, 5 Later; no Must-fix, no spec violation, no product decision.
- Triage ran at `83617820` (`origin/main`).
  Since the audit, among cited files only `apps/web/src/components/web-setup.tsx` changed (setup screen rework, with
  its catalogs updated in the same commits); its `scheme.*` and `color-scheme-picker.label` messages are unchanged,
  so finding 3 holds.
  Every cited source line was re-read and holds.
  Triage also found 11 more positional placeholders that finding 5 does not list, and that the extracted catalogs
  already carry a `#. placeholder {0}: <expression>` comment for each (see finding 5).

Done when:

- `bun run check:push` fails when a message is added or edited without extract and compile, and says which catalog
  files are stale;
- extracting does not rewrite line numbers in the catalogs;
- clearing a number field in the algorithm or learning-settings form names that field's error, not "An error
  occurred";
- each shared label is declared once, so one id has one catalog entry, and the API key label and its empty-key error
  use one term in each language;
- no message id has a positional `{0}` placeholder or a `#` in it;
- the empty `libs/ai` catalog is gone and `agents/I18N.md` names the design-system catalog list;
- token counts, the context percentage, card stability and difficulty, and optimizer scores follow the interface
  language;
- `bun run check:push` passes on the tip, and every plan item is one commit with a `Task:` trailer.

## Scope

In: every finding below, fixed as its decision says.
None is skipped.

Out:

- The quality of individual translations, beyond the term in finding 3.
- The Electron main process's own en/ru map (`apps/electron/src/startup-error.ts`, an `electron-main` decision), AI
  prompts (English by design), and server output.
- `useFormatBytes` (`libs/settings-react/src/lib/sync/sync-messages.ts:11-22`) stays as is; item 7 only follows its
  pattern.
- The `linge` and `lingc` Nx targets (documented shorthands, considered and not raised by the audit).
- The e2e suites. No item adds or edits an e2e case, so the suite-run rule (`agents/TASKS.md` §Done) does not apply.
  `apps/web-e2e` finds the API key field by the name "API key"; Playwright's default role-name match ignores case, and
  item 5 picks that casing anyway.

Overlap:

- `task/mobile-spike` (local, `Status: draft`) item 2 adds `apps/mobile` with its own Lingui config ("an English
  catalog only, activated as the other apps do").
  Item 1's PO format lives in the root config, so the mobile app inherits it if its config extends the root one.
  Item 2's `check:i18n` covers web and desktop only, and item 4's I18N.md line names the catalog lists; neither
  knows about `apps/mobile`. See Open questions.

### Findings

Numbered as in the report.
Classification and severity are the report's.

1. **Risk, Should-fix.** Nothing checks that catalogs and compiled files match the source.
   - The apps load the committed compiled catalogs, not the `.po` files (`apps/web/src/app/i18n.ts:9-13`, the same in
     `apps/electron-react`).
     Keeping them current is four manual steps per change (I18N.md: extract, translate, compile, for each app).
   - No gate runs Lingui: `rg -n -i "lingui|locales|\.po\b" tools/check-push.ts .github/workflows package.json` finds
     only the dependencies.
   - Unit tests cannot catch a miss: the mock macro (`tools/test/mocks/lingui-core-macro.ts`) renders ids, so tests
     find fields by id (`settings-ai-add-profile.test.tsx:117` uses the label `settings.ai.profiles.api-key.label`).
   - A message added without extract has no catalog entry, so Lingui renders its source, which is the id (such as
     `settings.sync.foo`), in both languages. A `.po` edited without compile ships the old text.
   - Today it holds: in the last 12 commits that touched a `.po`, the compiled files changed too.
   - A diff-based check needs finding 4 first, because every extract rewrites `#:` lines.
   - Decision: fixed by item 2, after item 1.
2. **Risk, Should-fix.** A cleared number field shows only "An error occurred".
   - React Aria's NumberField commits a cleared field as `NaN`
     (`libs/srs-react/src/lib/lessons/lesson-reducer.ts:248-249` documents this).
   - Fields that bind the raw value: the algorithm maximum interval
     (`libs/srs-react/src/lib/algorithms/algorithm.tsx:143-151`), learning and relearning step amounts
     (`algorithm-learning-steps.tsx:27-38`), the daily-limit caps
     (`libs/settings-react/src/lib/settings-learning.tsx:59-67`), and learn-ahead hours and minutes
     (`settings-learning.tsx:210-235`).
   - Their schemas give the type check no code: `z.number()` for step amounts and the maximum interval
     (`libs/srs/src/lib/algorithms-fsrs.ts:33,45`); `z.int()` with no code at all for the caps
     (`libs/app/src/lib/settings-learning.ts:39`); `z.int()` for learn-ahead, whose codes sit only on `.min`/`.max`
     (`settings-learning.ts:140-141`).
   - Probe: on `NaN`, each of those fields fails with Zod's `invalid_type` "Invalid input: expected number, received
     NaN", which is no catalog code. Controls (maximum interval `0`, learn-ahead hours `49`) report the field's code.
   - `libs/ui/src/lib/primitives/form/errors.tsx:29` maps a message that is not a catalog key to
     `ERROR_MESSAGES.unknown` ("An error occurred" / "Произошла ошибка"), and `Controls` shows it with the form's
     errors (`form.tsx:117-123`) without naming the field.
   - Retention is a slider and cannot be cleared; lesson amounts already treat `NaN` as 0 (`lessons-audit` L9).
   - Decision: fixed by item 3.
     Triage choice (open for edit at approval): `DailyLimitCapField` keeps its last number on `NaN`, instead of a new
     TS-only error code. It already holds a `lastNumber` ref (`settings-learning.tsx:53`), and a cap has no code today.
3. **Risk, Later.** One id, two catalogs, two translations; the Russian error uses another term.
   - `msg\`settings.ai.profiles.api-key.label\`` is written in `libs/ai-react/src/lib/use-ai-profiles.ts:13` and
     `libs/settings-react/src/lib/ai-providers/ai-profile-form-fields.tsx:43`, so each lib's catalog has an entry:
     `ai-react` says "API Key" / "API-ключ" (`libs/ai-react/locales/*/messages.po:271-272`), `settings-react` says
     "API key" / "API key" (`libs/settings-react/locales/*/messages.po:176-177`).
   - The compiled merge keeps the catalog listed later in `lingui.config.ts`, `ai-react`, so both apps ship "API Key"
     / "API-ключ"; the copy next to the form never ships.
     The design-system app merges `settings-react` after `ai-react` (`apps/design-system/src/app/i18n.ts:27-49`), so
     it shows "API key" / "API key".
   - The empty-key error is ru "API key не может быть пустым" (`libs/app/locales/ru/messages.po:605-606`) under a
     field labeled "API-ключ"; en "API key can't be empty" under "API Key".
   - The same pattern, consistent today: `settings.ai.profiles.base-url.label` in the same two files;
     `scheme.light`/`dark`/`system` in three packages (`libs/app/src/lib/settings-interface.ts:16-18`, which exports
     them as `SCHEMES`; `libs/settings-react/src/lib/settings-interface.tsx:43-45`;
     `apps/web/src/components/web-setup.tsx:46-48`); `color-scheme-picker.label` in two
     (`libs/settings-react/src/lib/interface-controls/color-scheme-picker.tsx:24`, `web-setup.tsx:152`).
   - Decision: fixed by item 5.
     Triage choice: English casing "API key" (the repo's labels are sentence case: "Base URL", "Color scheme").
4. **Improvement, Later.** Catalog `#:` line references churn on every extraction.
   - The root config uses the default PO format, which writes `#: path:line` origins (`lingui.config.ts`, no
     `format`). At `4b1f2911` a fresh extract for both apps rewrote 208 `#:` lines in 12 catalogs and nothing else.
   - Tasks reverted the churn by hand (`tasks/archive/sync-unknown-codes.md:164-165`, `learning-settings-audit.md:399`,
     `cards-audit.md:760`).
   - It blocks finding 1's diff check.
   - Decision: fixed by item 1.
5. **Improvement, Later.** Positional placeholders, and `#` inside two ids.
   - Interpolating a member expression, a call, or arithmetic makes Lingui name the placeholder by position.
     The report lists six: `ai.conversation.recovery.unsupported {0} {1}`
     (`libs/assistant-react/src/lib/ui/assistant-conversation-recovery.tsx:115`), `lesson.progress.label {0} {total}`
     (`libs/srs-react/src/lib/lessons/lesson-progress-dots.tsx:56`), `form.created-at {0}` and `form.updated-at {0}`
     (`libs/ui/src/lib/primitives/form/form.tsx:33,45`), `{0, plural, other {delete-algorithm.used-by-#-decks}}`
     (`libs/srs-react/src/lib/algorithms/delete-algorithm.tsx:75`), and
     `{0, plural, other {optimize-algorithm.review-count.#}}` (`optimize-algorithm.tsx:195`).
   - Triage found 11 more, each `{0}` from an `i + 1` / `index + 1` row number in `libs/srs-react`:
     `algorithm.learning-steps.{amount,delete,unit}.{0}` and `algorithm.relearning-steps.{amount,delete,unit}.{0}`
     (`algorithm-learning-steps.tsx`), `template.fields.inputs.{is-required,title,type}.label.{0}`
     (`template-fields-item.tsx`), and `template.layout.inputs.{field,operation}.label.{0}` (`template-layout.tsx`).
   - Correction to the report: a translator does see each expression, because extraction writes
     `#. placeholder {0}: <expression>` above the msgid. What remains: a swap of two interpolations in source keeps
     the same msgid, so every translation silently shows the values swapped (the recovery message is that case), and
     a placeholder name is lost on any refactor of the expression.
   - `delete-algorithm.used-by-#-decks` and `optimize-algorithm.review-count.#` break I18N.md's id rule
     (dot-separated kebab-case segments).
   - Decision: fixed by item 6, all 17 placeholders and both ids (human, 2026-11-07).
6. **Improvement, Later.** An empty catalog is still loaded, and the second catalog list is undocumented.
   - `libs/ai` has had no messages since it was added (`e8130441`); its README keeps the root barrel free of Lingui
     macros (`libs/ai/README.md:52-56`), and its two catalogs hold only the PO header.
   - Two lists still load it: the root config (`lingui.config.ts:37-40`) and the design-system app
     (`apps/design-system/src/app/i18n.ts:7-8`, merged at lines 33 and 44).
   - The design-system app imports every lib catalog by hand and merges them in its own order (`i18n.ts:5-22,27-49`).
     I18N.md says only "A new lib with strings needs an entry in the root config", so a lib missed there renders raw
     ids in the design-system app.
   - Decision: fixed by item 4.
7. **Improvement, Later.** A few numbers ignore the interface language.
   - `toLocaleString()` with no locale uses the OS locale: token counts in
     `libs/ai-react/src/lib/ai-chat-context-usage.tsx:19-20`.
   - `toFixed` always writes ".", which is wrong in Russian: the context percentage (`ai-chat-context-usage.tsx:33`),
     card stability and difficulty (`libs/srs-react/src/lib/cards/card-details.tsx:127,134`), and optimizer scores
     (`libs/srs-react/src/lib/algorithms/optimize-algorithm.tsx:226-227`).
   - The repo's pattern is `useFormatBytes`: `Intl.NumberFormat` with `langAtom`.
   - Decision: fixed by item 7.

Report handoffs: finding 6 covers the empty `libs/ai` catalog for "Dead code" and the I18N.md line for "Guides and
docs"; neither concern should re-raise them.
Not checked by the audit, and left to "Dead code": whether every Rust `error_codes` const is still returned somewhere.

## Open questions

- [x] Finding 5's scope: name all 17 positional placeholders, or only the report's six? — all 17 (human, 2026-11-07).
- [x] `task/mobile-spike` item 2: should it add `apps/mobile` to `check:i18n` and to I18N.md's catalog lists? — ignored
  here; that task is a draft (human, 2026-11-07).

## Plan

- [x] 1. Drop line numbers from catalog origins
  Goal: Extraction rewrites every `#: path:line` origin whenever source lines move, which buries real changes and
  blocks a diff check (finding 4).
  In the root `lingui.config.ts`, set `format: formatter({ lineNumbers: false })` from `@lingui/format-po`.
  Add `@lingui/format-po` as a root devDependency at the installed `5.6.0`.
  `@lingui/cli` stays a transitive dependency of `@lingui/vite-plugin`: adding it at the root made Bun re-hoist Babel
  and drop the top-level `@babel/core` from 7.29 to 7.27 (a 500-line lock diff).
  Re-extract once for both apps (`nx run @koloda/web:lingui-extract --clean`, then
  `nx run @koloda/electron-react:lingui-extract --clean`) and compile both.
  Constraints: the diff under `libs/*/locales` and `apps/*/locales` is `#:` lines only, and the compiled
  `src/app/locales/*.ts` files do not change. The two app configs inherit `format` from the root; do not repeat it.
  Done when: a second extract for both apps leaves the tree clean (`git status --porcelain` empty); the catalogs'
  `#:` lines carry paths without `:<line>`; `bun run check:push` is green.
  Commit: Drop line numbers from Lingui catalog origins
  Depends on: none

- [ ] 2. Fail the push gate on stale catalogs
  Goal: Nothing checks that catalogs and compiled files match the source, so a skipped extract ships a raw id and a
  skipped compile ships old text (finding 1).
  Add `bun run check:i18n`: it runs `lingui extract --clean` and then `lingui compile --strict` from `apps/web` and
  from `apps/electron-react`, and fails if any file under `libs/*/locales`, `apps/*/locales`, or
  `apps/*/src/app/locales` differs from its content before the run, naming each changed file.
  It compares contents it read before the run, not `git diff`, so uncommitted work elsewhere does not matter; it
  leaves the regenerated files in place for the developer to commit.
  `--strict` also fails on an empty translation.
  Run it from `check:ts` (after `check:docs`), so `check:push` and CI's `checks` job run it, sequential with `tsc`
  and lint in that track; update the `check:ts` summary in `tools/check-push.ts`'s header comment.
  Put the script in `tools/` (for example `tools/check-i18n.ts`) if it is more than a one-line `package.json` script,
  with a unit test for its comparison against a temp-dir fixture.
  In `agents/I18N.md`, add a line that `bun run check:i18n` (run by `check:push`) fails on a stale catalog or
  compiled file.
  Constraints: no change to the apps' catalog loading. Do not add Nx caching to the Lingui targets.
  Done when: adding a probe `msg` to a lib without extracting makes `bun run check:i18n` fail and name the lib
  catalogs; editing a `msgstr` without compiling makes it fail and name the compiled files; on the clean tree it
  passes and leaves the tree clean; `bun run check:push` is green (probes reverted).
  Commit: Fail the push gate on stale Lingui catalogs
  Depends on: 1

- [ ] 3. Name the field when a cleared number field fails
  Goal: React Aria commits a cleared NumberField as `NaN`; Zod's type check then fails with its own English text,
  which the form shows as "An error occurred" without naming the field (finding 2).
  Pass each number's own code to its type check, as the schema's `message`/`error` option (match the style already
  in the file): the learning and relearning step amounts get their list's amount code
  (`validation.algorithm.fsrs.learning-steps.amount`, `…relearning-steps.amount`) in
  `libs/srs/src/lib/algorithms-fsrs.ts` (the shared `learningStepValidation` tuple needs one per list, or the
  refinement that already reports per list must also see `NaN`; pick whichever keeps one code per list); the maximum
  interval gets `validation.algorithm.fsrs.maximum-interval`; learn-ahead hours and minutes get their range codes
  (`LEARN_AHEAD_HOURS_RANGE`, `LEARN_AHEAD_MINUTES_RANGE`) on the `z.int()` itself in
  `libs/app/src/lib/settings-learning.ts`.
  For the daily-limit caps, `DailyLimitCapField` (`libs/settings-react/src/lib/settings-learning.tsx`) keeps its last
  number on `NaN`: it does not pass `NaN` to `onChange` and does not overwrite `lastNumber`. No new error code.
  Add a `NaN` row per field to `libs/srs/src/lib/algorithms-fsrs.test.ts` and
  `libs/app/src/lib/settings-learning.test.ts` asserting the field's code, and a `DailyLimitCapField` case to
  `libs/settings-react/src/lib/settings-learning.test.tsx` (clearing keeps the last number).
  Constraints: no Rust change (serde rejects a non-number before validation); no change to `ERROR_MESSAGES` or the
  error parity test; leave lesson amounts and the retention slider alone.
  Done when: the new rows pass and fail without the fix; `bun run check:push` is green.
  Commit: Report the field's error when a number field is cleared
  Depends on: none

- [ ] 4. Drop the empty AI catalog and document the second catalog list
  Goal: `libs/ai` has never had messages, yet the root Lingui config and the design-system app still load its empty
  catalogs; and the design-system app's hand-written catalog list is not documented, so a new lib could be missed
  there (finding 6).
  Delete `libs/ai/locales/` and its entry in the root `lingui.config.ts`, and its two imports and two spreads in
  `apps/design-system/src/app/i18n.ts`.
  Reorder that file's merge to the root config's order (`app`, `app-react`, `srs`, `srs-react`, `assistant-react`,
  `settings-react`, `ui`, `ai-react`), so it resolves a duplicate id as the apps do.
  In `agents/I18N.md`, say that a new lib with strings also needs an entry in
  `apps/design-system/src/app/i18n.ts`, kept in the root config's order.
  Check `libs/ai/project.json`, `libs/ai/README.md`, and `libs/ai/package.json` for a reference to the catalog.
  Constraints: re-extract and compile both apps; the compiled files must not change.
  Done when: `rg -n "libs/ai/locales"` finds nothing; `bun run check:push` (with `check:i18n`) is green.
  Commit: Drop the empty AI catalog and document the design-system catalog list
  Depends on: 2

- [ ] 5. Declare each shared label once
  Goal: Some labels are written as `msg` in several packages, so extraction puts one id in several catalogs with
  different text, and which one ships depends on merge order (finding 3).
  Export the AI secret field labels from `libs/ai-react/src/lib/use-ai-profiles.ts` (`SECRETS_LABELS` or a named
  export per label) through the package barrel, and use them in
  `libs/settings-react/src/lib/ai-providers/ai-profile-form-fields.tsx` instead of its own `msg` calls.
  Use `SCHEMES` from `@koloda/app` in `libs/settings-react/src/lib/settings-interface.tsx:43-45` and
  `apps/web/src/components/web-setup.tsx:46-48`.
  Export the `color-scheme-picker.label` descriptor from `libs/settings-react` (beside `ColorSchemePicker`) and use it
  in `web-setup.tsx:152`.
  Re-extract and compile both apps, so each id has one catalog entry.
  Set en "API key" for `settings.ai.profiles.api-key.label` (ru stays "API-ключ"), and ru "API-ключ не может быть
  пустым" for `validation.settings-ai.providers.api-key` in `libs/app/locales/ru/messages.po`.
  Constraints: no id changes; keep the layer rules (`bun run check:workspace-deps`); update tests that find these
  fields by id only if an id moves package and the mock output changes.
  Done when: in `libs/*/locales/en` and `apps/*/locales/en`, each of `settings.ai.profiles.api-key.label`,
  `settings.ai.profiles.base-url.label`, `scheme.light`, `scheme.dark`, `scheme.system`, and
  `color-scheme-picker.label` has one msgid entry; `bun run check:push` is green.
  Commit: Declare each shared interface label once
  Depends on: 4

- [ ] 6. Name every message placeholder
  Goal: Interpolating anything but a plain identifier makes Lingui name the placeholder `{0}`, `{1}`; reordering two
  of them in source silently swaps the values in every translation, and two plural ids contain `#`, which breaks the
  id rule (finding 5).
  Bind each interpolated value to a named local before the macro, so the placeholder takes its name: the recovery
  message (`found`, `supported`), lesson progress (the position), `form.created-at` / `form.updated-at` (the formatted
  date), both plurals (the count), and the 11 row-number labels in `algorithm-learning-steps.tsx`,
  `template-fields-item.tsx`, and `template-layout.tsx`.
  Rename `delete-algorithm.used-by-#-decks` and `optimize-algorithm.review-count.#` to kebab-case ids without `#`
  (for example `delete-algorithm.used-by-decks`, `optimize-algorithm.review-count`).
  Re-extract and compile both apps, then carry each old `en` and `ru` string over to its new msgid with the placeholder
  renamed; keep every `ru` plural's `one`/`few`/`many`/`other`.
  Constraints: rendered text unchanged in both languages (the e2e suites find step fields by "Amount for learning step
  number 1"); update unit tests that match the old ids.
  Done when: `rg -n 'msgid ".*\{[0-9]+[,}]|msgid ".*#' libs/*/locales apps/*/locales` finds nothing (plural `#` inside a
  msgstr is fine); `bun run check:push` is green.
  Commit: Name every Lingui placeholder and drop # from two ids
  Depends on: 2

- [ ] 7. Format numbers in the interface language
  Goal: A few numbers use the OS locale (`toLocaleString()`) or always write "." (`toFixed`), not the interface
  language (finding 7).
  Format through `Intl.NumberFormat(lang, …)` with `lang` from `langAtom`, as `useFormatBytes` does
  (`libs/settings-react/src/lib/sync/sync-messages.ts:11-22`): the token counts and context percentage in
  `libs/ai-react/src/lib/ai-chat-context-usage.tsx`, stability and difficulty in
  `libs/srs-react/src/lib/cards/card-details.tsx`, and log loss and RMSE in
  `libs/srs-react/src/lib/algorithms/optimize-algorithm.tsx`.
  Keep today's digit counts with equal `minimumFractionDigits` and `maximumFractionDigits` (1, 2, 4).
  If the three files want the same helper, add one hook to `@koloda/core-react` beside `langAtom`; otherwise memoize
  the formatter per component on `lang`.
  Constraints: no catalog change; `useFormatBytes` stays as is.
  Done when: a unit test per component (or for the hook) renders `1234.5` / `0.1234` with `ru` and gets a "," decimal
  separator and locale grouping; `bun run check:push` is green.
  Commit: Format numbers in the interface language
  Depends on: none

## Outcome

<what shipped>
