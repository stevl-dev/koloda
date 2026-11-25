# Assistant Settings Changes

## Scope

Covers the assistant changing the user's learning and interface settings:
which settings it may change, how a change is checked and saved, and what the model is told.
Reading settings, tool activity rows, and the other tools are covered by ASSISTANT-DATA-ACCESS.md.
The settings themselves, their defaults, and their rules are covered by LEARNING-SETTINGS.md and INTERFACE-SETTINGS.md.
The run lifecycle, retry, and revert are covered by ASSISTANT-CONVERSATIONS.md.

## What it is

The user can ask the assistant to change a setting, and the assistant changes it in the chat.
Asked "raise my daily new-card limit to 30", it saves the new limit.

The change is saved at once.
The assistant does not ask the user to confirm first.
It behaves the same for every provider.

## Core model

- **Settings change** — one `change_settings` call: a list of settings, each with its new value
- **Changeable setting** — a learning or interface setting the assistant may change; see §Settings the Assistant Can Change
- **Old value** — a setting's value just before the change, recorded with the call

### Relationships

- A settings change saves through the same checks as the settings screens.
  It cannot save a value the user could not save by hand.
- A settings change is all or nothing: every setting in the call changes, or none does.
- Hotkeys and AI settings are never changed by the assistant.

## Settings the Assistant Can Change

Learning settings, as LEARNING-SETTINGS.md describes them:

- Total daily limit
- the daily limit of New, Learn, and Review, each a number or no limit
- whether New, Learn, and Review each count toward Total
- Day starts at
- the learn-ahead limit
- the default algorithm (preset) and default template for a new deck

Interface settings, as INTERFACE-SETTINGS.md describes them:

- language
- color scheme
- light theme and dark theme
- motion
- date format and time format

Nothing else can be changed.
For a hotkey or an AI setting, the assistant says where the user changes it and links to that screen.

## Changing Settings

One call may change several settings, in learning and interface together.

The app checks each new value, then checks the settings as the settings screen does when the user saves.

- A value of the wrong kind fails the call, such as a negative limit or a theme that does not exist.
- Settings that break a rule fail the call, such as a counted limit above Total;
  see LEARNING-SETTINGS.md (§Daily Limits).
- A default preset or template that does not exist fails the call.
- A setting the call names twice fails the call.

A failed call changes nothing, and the error says why.
The model sees the error and can try again.

A learning change and an interface change in one call are saved one after the other.
If the second save fails, the first is put back, and the call fails.

A setting whose new value equals its current value is not saved again.
When every value already matches, nothing is saved, and the result says so.

A saved change shows at once in the open app, as the same change made on a settings screen does.
It shows whether or not the chat is open.

If the user cancels the run before the save starts, nothing is saved.
A save already under way finishes, and the open app refreshes the settings from what was saved.
A language saved that way is not applied to the open app.

A changed learning setting reaches the user's other devices through sync like any other learning change.
Interface settings stay on this device.

The result lists each changed setting with its old and new value.
The tool activity row shows how many settings changed; see ASSISTANT-DATA-ACCESS.md (§Visibility).

## What the Model Is Told

The tool's description tells the model:

- to change a setting only when the user asks for a change
- to answer a question about what a value would do without changing anything
- to read the current values first
- that the change applies at once, so it does not ask the user to confirm
- each setting it may change and the values it takes
- that hotkeys and AI settings cannot be changed, and to link to the screen where the user changes them

The built-in system prompt repeats the first two.
Guidance steers the model but does not bind it; the app enforces only the checks in §Changing Settings.
