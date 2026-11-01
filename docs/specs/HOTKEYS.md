# Hotkeys

## Scope

Covers the keyboard shortcut system: categories, the catalog of hotkeys, scopes, bindings, conflict resolution,
configuration, and validation.
What an action does beyond the one line in the catalog is covered by the spec of the feature it acts on.

Desktop zoom intentionally lives outside this system:
it is not configurable, not scope-gated, and fires while text inputs are focused.
Its keys are in INTERFACE-SETTINGS.md (§Desktop Zoom).

Desktop history keys also live outside this system; see §Desktop History Keys.

Lesson dialog keys (`Escape`, `Enter`, `Space`) also live outside this system:
they are not configurable and are not checked for conflicts.
They are gated to the open lesson dialog; see LESSONS.md (§Hotkeys).
When a configurable hotkey and a lesson system key share the same binding, both actions fire.

## What it is

A hotkey is a keyboard shortcut that triggers an action.
Each hotkey belongs to a category and has one or more key bindings and an action.
Hotkeys that need activation gating also carry a runtime scope.

## Core model

- **Hotkey** — a keyboard shortcut that triggers an action
- **Category** — a grouping used for settings, validation, and persistence
- **Key binding** — a key assigned to a hotkey, with or without modifiers
- **Runtime scope** — when a hotkey is active, distinct from its category
- **Action** — what the hotkey triggers

### Relationships

- Each hotkey belongs to a category and has an action.
- A hotkey has zero or more key bindings.
- A category never gates whether a hotkey fires.
- Hotkeys that need activation gating also carry a runtime scope.

## Categories

Hotkeys are grouped into categories for settings, validation, and persistence.
A category never gates whether a hotkey fires.

The following categories exist:

- **form** — actions within form dialogs
- **ui** — interface-wide actions (focus management, tabs, sidebar, theme)
- **navigation** — route navigation
- **grades** — card grading actions
- **ai** — assistant chat actions

## Catalog

Each table lists the hotkeys of one category, under the name shown in settings.
The default is the binding a fresh install ships with.
A hotkey with the default none is unbound until the user configures it.

### Forms

The **form** runtime scope gates these hotkeys.

| Action | Default | Effect |
| --- | --- | --- |
| Save | `Mod+S` | Submits the open form. Does nothing while the form is unchanged or cannot be submitted. |
| Discard | `Mod+D` | Restores the form's last saved values. Does nothing while the form is unchanged. |

Both work while a text field of the form is focused (§Key Bindings).

### Interface

No runtime scope gates these hotkeys.

| Action | Default | Effect |
| --- | --- | --- |
| Submit text field | `Mod+E` | Submits the add-card dialog, sends the assistant prompt, or submits a typed lesson answer. |
| Focus forward | `Alt+J` | Moves focus to the next control, or to the next option in an open select. |
| Focus backward | `Alt+K` | Moves focus to the previous control, or to the previous option in an open select. |
| Go to next tab | `J` | Moves to the next tab or radio option while focus is on a tab or radio group. |
| Go to previous tab | `K` | Moves to the previous tab or radio option while focus is on a tab or radio group. |
| Close popover | `Alt+C` | Closes the open dialog or popover, the same as Escape. |
| Toggle sidebar | `Mod+B` | Opens or closes the sidebar. |
| Toggle color scheme | none | Cycles Light, Dark, and System, and saves the choice. |
| Toggle language | none | Cycles the offered languages and saves the choice. |

Submit text field only acts while a text field is focused.
The tab hotkeys do not fire while a text field is focused.
The other hotkeys in this category also work there (§Key Bindings).

### Navigation

The **navigation** runtime scope gates these hotkeys.
Each one opens a screen.

| Action | Default | Screen |
| --- | --- | --- |
| Dashboard | `H` | Dashboard |
| Decks | `D` | Decks |
| Presets | `P` | Algorithm presets |
| Templates | `T` | Templates |
| Settings | `Mod+,` | Settings |
| Assistant | `A` | Assistant |

### Grade Selection

The **grades** runtime scope gates these hotkeys.
Each one grades the submitted card in an open lesson, when the key is released.

| Action | Default | Grade |
| --- | --- | --- |
| Again | `1` | Again |
| Hard | `2` | Hard |
| Good | `3` | Good |
| Easy | `4` | Easy |

### AI

No runtime scope gates these hotkeys.
They act on the assistant chat and work while its text field is focused (§Key Bindings).

| Action | Default | Effect |
| --- | --- | --- |
| Interrupt | `Mod+Shift+I` | Cancels the active run. Available only while a run is active. |
| Focus chat input | `Mod+L` | Moves focus to the chat input. |
| Open AI model picker | `Mod+Shift+M` | Opens the model picker. |
| Toggle settings | `Mod+Shift+S` | Opens or closes the assistant settings modal. |
| New conversation | none | Starts a new conversation, when the new conversation button is available. |
| Previous conversation | none | Opens the previous conversation in the list. |
| Next conversation | none | Opens the next conversation in the list. |
| Scroll up | none | Scrolls the messages up. |
| Scroll down | none | Scrolls the messages down. |
| Scroll to top | none | Scrolls to the first message. |
| Scroll to bottom | none | Scrolls to the latest message. |

## Desktop History Keys

On the desktop the user can move back and forward through visited screens from the keyboard.
These keys are not configurable, not scope-gated, and fire while text inputs are focused.

- Back is `Alt+Left` on Windows and Linux, and `Cmd+[` on macOS.
- Forward is `Alt+Right` on Windows and Linux, and `Cmd+]` on macOS.

They act like the titlebar back and forward buttons.
With no screen to go back or forward to, the key does nothing.
In the browser the browser's own history keys apply instead.

## Runtime Scopes

A runtime scope determines when its hotkeys are active, distinct from the settings category.
The following runtime scopes exist: `navigation`, `grades`, `form`.
The `ui` and `ai` categories have no runtime scope.
Their hotkeys are active while the part of the interface they act on is on screen.

## Scope Activation

A runtime scope must be enabled for its hotkeys to fire.
Scopes are enabled and disabled at runtime.

The **navigation** scope is enabled on app load.
It is off while a lesson, a modal dialog, or a select list is open.
It comes back once none of them is open, including when the screen that showed a list is left with the list open.
Popovers do not turn navigation off.
The **grades** scope is enabled while a lesson is open.
The **form** scope is enabled while any form is mounted.
When one form replaces another, the scope stays on for the new form.

When a scope is disabled, its hotkeys are silently ignored.
They do not fire, even if the keys are pressed.
Enabling a scope that is already enabled leaves it enabled.
A hotkey that acts when its key is released, such as a grade, does nothing if its scope turned off before the release.

## Key Bindings

Each hotkey can have zero or more key bindings.
A hotkey with no bindings does nothing.

Key bindings use a modifier-plus-key format.
Modifiers are written in this order:

- `Mod` — Ctrl on Windows and Linux, Cmd on macOS
- `Control` — Ctrl on macOS
- `Alt`
- `Shift`
- `Meta` — the Windows or Super key on Windows and Linux

Single keys without modifiers are also valid.

While a text field is focused, navigation, grade, and tab hotkeys never fire.
Form Save and Discard, the AI hotkeys, and the other Interface hotkeys work there, but only through a binding with
`Mod`, `Control`, `Alt`, or `Meta`, or bound to Escape.
Bound to anything else, such as a single letter, they fire everywhere except in a text field, where the key types as
usual.

## Conflict Resolution

Hotkey conflicts occur when two hotkeys share the same key binding.

### Within a Category

Duplicate key bindings within the same category are not allowed.
If the user tries to assign the same key to two hotkeys in the same category, validation fails.

### Across Categories

The **ui** category has special status.
If a **ui** hotkey shares a binding with a hotkey in any other category, both hotkeys are marked as conflicting.
The conflict is reported as a validation error.

Non-UI categories can share bindings with each other without conflict.
When the key is pressed, every hotkey on it that is active at that moment fires.
For example, with an **ai** scroll hotkey and the **navigation** Decks hotkey both on `D`, pressing `D` on the assistant
screen scrolls the chat and opens Decks.
A **navigation** hotkey and a **grades** hotkey on one key never fire together, because navigation is off during a
lesson.

## Configuration

Users can configure hotkey bindings in the settings panel.

### What Can Be Changed

- Add a new key binding to a hotkey
- Remove a key binding from a hotkey
- Change an existing key binding to a different key

While a binding is being recorded, each key press replaces the recorded binding, and no other hotkey fires.
Escape cancels the recording.
Tab moves focus, and Enter or Space without a modifier presses the focused button, so none of them can be recorded.
A chord is stored the same way on every platform, so validation sees two spellings of one chord as a duplicate.

### What Cannot Be Changed

- The hotkey's category
- The hotkey's action
- Which hotkeys exist

### Validation on Save

When the user saves hotkey settings, the configuration is validated:

1. No duplicate bindings within any category
2. No binding in a non-UI category conflicts with a UI binding
3. Unknown hotkey names are dropped and are not persisted

The save still succeeds after unknown names are dropped.
If duplicate-binding validation fails, the save is rejected and the user sees an error.

### Default Bindings

The default of each hotkey is in §Catalog.
Some hotkeys have no default binding and must be configured by the user to be usable.

## Persistence

Hotkey settings persist across sessions.

If a save fails, the hotkeys keep working with the last saved bindings.
The settings screen keeps the unsaved edits next to the error.
If the stored settings are corrupted, the app reports an error instead of silently falling back to defaults.
Corrupted settings must never look the same as missing settings.
While the stored settings cannot be read, no configurable hotkey fires, and the hotkeys settings screen shows the error.
Keys outside this system, such as the lesson dialog keys, keep working.
Only missing settings use the default bindings.

When stored settings contain unknown action names (for example a retired hotkey), those names are dropped.
Known actions and their bindings are kept.
Missing known actions are filled with no bindings.
