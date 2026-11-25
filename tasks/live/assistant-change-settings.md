# Assistant changes settings

Status: draft
Guides: agents/ADD-ASSISTANT-TOOL.md, agents/ASSISTANT-MAP.md, docs/specs/ASSISTANT-DATA-ACCESS.md, docs/specs/ASSISTANT-CONVERSATIONS.md, docs/specs/LEARNING-SETTINGS.md, docs/specs/INTERFACE-SETTINGS.md, docs/decisions/CACHE-REFRESH.md, docs/decisions/SPECS-AS-ASSISTANT-HELP.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/I18N.md, agents/TESTING.md, agents/VERIFY.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/MARKDOWN.md, agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md
Flow: local

## Intent

The user can ask the assistant to change a setting, and the change happens in the chat.
Asked "raise my daily new-card limit to 30", the assistant makes the change.
The change applies at once, and the user can undo it from the chat.

One `change_settings` tool does this.
A per-field table in code, not the model, names the fields the tool may change.
Every listed field can be restored to its old value, so every change applies with Undo and none asks first.
The model calls the tool the same way on every provider.

Done when the assistant changes an allowed setting on both hosts and Undo restores the old value.
A new spec, `docs/specs/ASSISTANT-SETTINGS-CHANGES.md`, describes the tool, its fields, and Undo.

Scheduled from the backlog entry `assistant-change-settings`, which had no brief, read at `de00614e`:
"Add one `change_settings` tool; a per-field table in code applies reversible changes with Undo
and asks the user first for the rest.
Why: The settings tool only reads; one tool whose mode the host picks keeps model behavior the same across providers."

## Scope

In:

- The `change_settings` tool: its input, its output, and the per-field table (open questions 1, 3).
- Apply-with-Undo, with its chat UI (open question 5).
- Tool and prompt guidance: change a setting only when the user asks for a change.
  A question such as "what if my limit were 30?" gets an answer, not a write.
- The host writes on web and desktop, through the same validation and cache refresh as the settings screens.
- The spec rule for this write; `docs/specs/ASSISTANT-DATA-ACCESS.md` (§Resources) now says such writes
  need a named product spec with undo and validation.
- The tool descriptions and prompt lines that say the assistant cannot change settings
  (`get_settings` in `libs/ai/src/lib/assistant-tools.ts`, and `libs/ai/src/lib/prompts.ts`).

Out:

- Writes to decks, cards, templates, and presets.
- Hotkeys (open question 1).
- All AI settings: profiles, allowed models, keys, temperature, and the prompt choice (open question 1).
- Asking the user before a change (open question 2).
- Sync settings and sync actions.
- Removing or merging `get_settings`.

## Open questions

- [x] 1. Which fields does the table list, across learning, interface, hotkeys, and AI? — learning and interface.
  - Learning: daily limits (Total; New, Learn, and Review, each its value and whether it counts toward Total),
    Day starts at, the learn-ahead limit, and the default preset and template.
  - Interface: language, color scheme, light and dark theme, motion, date and time formats.
  - Each takes the validation its settings screen applies on save.
  - Hotkeys are out: a new binding can clash with another or take away one the user relies on,
    and typing a key combination in chat is awkward next to recording it on the screen.
  - AI settings are out: profiles involve providers and keys the assistant cannot read.
    Temperature and the prompt choice would let the assistant change its own behavior mid-conversation.
- [x] 2. Which mode does each listed field take: apply with Undo, or ask first? — apply with Undo, for every field.
  Every listed field can be restored to its old value, so asking first adds a step and no safety.
- [x] 3. Input shape: one field per call, or a patch of several fields under one Undo? — several fields.
  One call takes a patch of fields across learning and interface, and one Undo reverts that call.
- [x] 4. How does ask-first wait for the user? — it does not; nothing asks first (question 2).
  The tool is a direct write, as `add_deck` is, so the run never pauses for the user.
- [x] 5. Where does Undo live, and how long does it stay valid? — in the tool call row, for as long as the row exists.
  - Every successful `change_settings` row offers Undo, not only the latest.
    Undo restores only the fields that call changed.
  - Undo survives a reload.
    The tool output records each field's old and new value, and is saved with the conversation.
    The row's undone state is saved too.
  - A field that changed since the call, by the user or by sync from another device, is restored anyway.
    The human chose this over skipping such a field or refusing the Undo.
    The newer value is lost.
  - Undo saves through the same validation as the settings screen.
    When the restored values fail it, for example a counted limit above a Total changed since, nothing is written,
    and the row shows the error.
  - After Undo the row shows "Undone" and the button goes away.
    There is no Redo; the user asks again.
    The model does not see the Undo, since tool traffic stays off follow-up history; `get_settings` reads the truth.
  - Revert and retry do not undo a change.
    Retry clears the run's tool rows, so the Undo goes with them and the change stays.
- [x] 6. Does the mode or the copy differ for a change that reaches the user's other devices? — no.
  Learning settings are global and sync; interface settings are device-local (`docs/decisions/STORAGE-BUCKETS.md`).
  Every change applies with Undo, and an undo syncs like any other save.
- [x] 7. Does the rule go in `docs/specs/ASSISTANT-DATA-ACCESS.md`, or in a new spec it points to? — a new spec.
  `docs/specs/ASSISTANT-SETTINGS-CHANGES.md` holds the fields, validation, the Undo row and its lifetime,
  and how retry and revert treat a change.
  `docs/specs/ASSISTANT-DATA-ACCESS.md` keeps one `change_settings` line in §Tools that points to it,
  as `propose_cards` points to `ASSISTANT-CARD-GENERATION.md`.
  The name keeps clear of `ASSISTANT-SETTINGS.md`, which covers the assistant's own prompt and temperature.
- [ ] 8. One call changes fields of one section, learning or interface, not both. — proposed in the Plan, confirm
  One section is one settings row, so a call is one write and one Undo restores one row.
  A request that spans both sections takes two calls, and two Undo buttons.

## Plan

Facts the items rely on, read at `de00614e`:

- Tools run in the host binder: `apps/web/src/app/ai-runtime.ts`, and the Electron main process in
  `apps/electron/src/ai-ipc.ts`, whose `AiIpcDb` picks methods from the NAPI mirror (`setSettings` exists there).
  Neither has a `QueryClient`.
- `patchSettings` merges per RFC 7386 on both hosts, so `null` deletes a key and the default refills it.
  A daily limit of `null` means no limit, so a patch cannot set one.
  The learning screen saves the whole row with `setSettings`; a settings change does the same.
- The interface row reaches the live UI through atoms.
  `useGlobalSync` (`libs/app-react/src/lib/hooks/use-global-sync.ts`) copies scheme, themes, motion, and formats
  from the interface query into atoms, but not language.
  `langAtom` is the live language; each host's store subscribes to it, saves it, and activates the catalog.
  `useInterfaceSettingWrite` (`libs/settings-react`) holds the field-to-atom table and sets the atom with the save.
- `"settings.learning"` is a data kind (`libs/core-react/src/lib/cache-refresh.ts`); `refreshKinds` refreshes the
  learning query and the lesson queries.
- `@koloda/assistant-react` may import no feature lib but `@koloda/ai-react` (`tools/workspace-deps/layers.ts`),
  so it cannot reach `settings-react`.
  `@koloda/core-react` sits in the data layer and cannot import `motionSettingAtom` from `@koloda/ui`.
  The app shell, `@koloda/app-react`, can import both.
- `add_deck` refreshes caches through a callback the shell registers (`add-deck-query-invalidation.ts`),
  called once the reducer records the tool's success.
- The persisted tool call (`toolCallField` in `conversation-persistence-schema.ts`) is a plain `z.object`.
  An older build strips a key it does not know and still loads the row.

- [ ] 1. Add the `change_settings` tool
  Goal: The assistant can change learning and interface settings with one call.
  - In `libs/ai`, add a field table: each entry a dotted path into one settings row and the schema for its value.
    Learning: `dailyLimits.total`; `dailyLimits.<untouched|learn|review>.value` and `.counts`; `dayStartsAt`;
    `learnAheadLimit`; `defaults.algorithm`; `defaults.template`.
    Interface: `language`, `scheme`, `lightTheme`, `darkTheme`, `motion`, `dateFormat`, `timeFormat`.
    Hotkeys and AI settings are not in it.
  - Add a pure function that applies a list of `{ field, value }` to a row's content and returns the new content.
    Undo (item 3) applies the same list with the old values.
  - Add `change_settings` to `ASSISTANT_TOOL_SPECS`.
    Input: `section` (`learning` or `interface`) and `changes`, a non-empty list of `{ field, value }`,
    with `field` an enum of that section's paths.
    The executor reads the row, checks each value against its field's schema, applies the list,
    and validates the whole row with the settings schema, as the settings screen's save does.
    A new default preset or template must exist (`getAlgorithms`, `getTemplates`), as `add_deck` checks.
    Any failure fails the call and writes nothing.
    A change whose value equals the current one is dropped; a call left with none writes nothing and says so.
    It saves the row whole through a new `setSettings(name, content)` on `AssistantToolDataSource`.
    Output: `section` and `changes`, each `{ field, from, to }`.
  - Bind `setSettings` on both hosts; add it to `AiIpcDb`.
  - Tool description and `prompts.ts`: change a setting only when the user asks for a change, never for a
    "what if"; read with `get_settings` first; say which fields it cannot change and link to that screen.
    Drop "cannot change settings" from `get_settings`.
  - Activity label, icon, and a success summary in `libs/ai-react/src/lib/ai-tool-activity.tsx`, both catalogs.
  - Spec: add `docs/specs/ASSISTANT-SETTINGS-CHANGES.md` with the fields, validation, and what the model is told.
    In `docs/specs/ASSISTANT-DATA-ACCESS.md`: one `change_settings` line in §Tools pointing to it,
    the tool count, §Tool Guidance, `get_settings` no longer "does not change settings",
    and §Resources' paragraph on writes.
    Run `bun run gen:help`.
  - `agents/ADD-ASSISTANT-TOOL.md` (§Tool kinds, direct write) names `change_settings` beside `add_deck`.
  Constraints: Out of scope: hotkeys, AI settings, writes to other rows.
  The open UI refreshing after the write is item 2.
  Done when: unit tests cover the field table, the apply function, each failure (unknown field, bad value,
  a row that fails the settings schema such as a counted limit above Total, a missing default preset or template),
  a no-op call, and a `null` daily limit saved as no limit; the host binder tests cover `setSettings`;
  `bun run check:push` passes.
  Commit: Let the assistant change learning and interface settings
  Depends on: none

- [ ] 2. Show an assistant settings change in the open app
  Goal: A change the assistant makes shows at once, as the same change on the settings screen does.
  - Move the interface field-to-atom table out of `useInterfaceSettingWrite` into an exported
    `@koloda/settings-react` helper that sets the atoms for a set of interface values; the hook uses it.
  - In `@koloda/assistant-react`, add a registration seam beside `add-deck-query-invalidation.ts`:
    once the reducer records a `change_settings` success, call the registered handler with the call's output.
    A run that ends while the write is still running follows `notifyAddDeckStillRunning`.
  - The shell (`@koloda/app-react`) registers the handler.
    For learning it calls `refreshKinds(queryClient, ["settings.learning"])`.
    For interface it sets the atoms with the helper, including `langAtom`, and refreshes the interface query.
  - Spec: `docs/specs/ASSISTANT-SETTINGS-CHANGES.md` says a change shows at once; run `bun run gen:help`.
  Constraints: No `QueryClient` in `libs/ai` or the host binders.
  Do not add `settings-react` to `assistant-react`'s dependencies.
  Done when: tests show a recorded `change_settings` success calls the handler once with the output,
  an error or an unmatched call does not, and the shell handler sets the atoms and refreshes the right keys;
  `bun run check:push` passes.
  Commit: Apply assistant settings changes in the open app
  Depends on: 1

- [ ] 3. Undo an assistant settings change from its tool row
  Goal: Every successful `change_settings` row offers Undo, which writes back each changed field's old value.
  - `RunToolCall` gains an optional `undone: true`; `toolCallField` reads it.
    The schema version stays 1: an older build strips the key and loads the row.
  - A reducer action marks a call undone, which saves the conversation.
  - `AIToolActivity` gains a slot for a per-call action; `assistant-react` fills it with Undo
    for a successful `change_settings` call that is not undone.
  - Undo reads the row through `queriesAtom`, applies each change's `from` with item 1's function,
    and saves the row whole with `setSettingsMutation`.
    A field changed since the call is restored anyway.
    It then calls item 2's handler with the restored values and marks the call undone.
    If the save fails, for example a counted limit above a Total changed since, or a default preset since deleted,
    nothing is written, the row shows the error, and Undo stays.
  - An undone row shows "Undone" and no button; there is no Redo.
  - Copy in both `ai-react` catalogs.
  - Spec: §Undo in `docs/specs/ASSISTANT-SETTINGS-CHANGES.md` with all of the above,
    and that revert does not undo a change and retry clears the row with its Undo while the change stays.
    Run `bun run gen:help`.
  Constraints: Undo writes through the renderer's queries, not a new IPC channel.
  Done when: tests cover Undo restoring the old values, a field changed since overwritten,
  a failed save leaving the row and the value, the undone flag surviving save and restore,
  and an undone row showing no button; `bun run check:push` passes.
  Commit: Undo assistant settings changes from the tool row
  Depends on: 1, 2

## Outcome
