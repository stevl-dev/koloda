# App Map

Where each screen is, what it is for, and which topic covers it.
Each screen names its link target, the text after `koloda:` in a link to it.

## Navigation

The main navigation lists Dashboard, Decks, Presets, Templates, and Assistant, with Settings at the end.
Each of these screens also has a hotkey; see HOTKEYS.md (§Navigation).
On a narrow window the navigation sits in a drawer.

## Dashboard

The Dashboard shows each deck's cards ready to study, and what has been studied today.
Link: `koloda:dashboard`.
A count starts a lesson; see LESSONS.md.

## Decks

Decks lists the decks; opening one shows its cards and its settings.
Link: `koloda:decks`; one deck is `koloda:deck/<id>`.
See DECKS.md and CARDS.md.

## Presets

Presets lists the algorithm presets, the scheduling settings decks use.
Link: `koloda:algorithms`; one preset is `koloda:algorithm/<id>`.
See ALGORITHMS.md, and the Concepts topic for what each setting means.

## Templates

Templates lists the card templates: their fields and layout.
Link: `koloda:templates`; one template is `koloda:template/<id>`.
See TEMPLATES.md.

## Assistant

The Assistant is the AI chat, with its conversations in a list.
Link: `koloda:assistant`.
Its own settings, the system prompt and temperature, open from the chat; see ASSISTANT-SETTINGS.md.
See ASSISTANT-CONVERSATION-LIST.md and ASSISTANT-CONVERSATIONS.md.

## Settings

Settings has these pages:

- **Interface** (`koloda:settings/interface`) — language, color scheme, themes, motion, and date and time formats; see INTERFACE-SETTINGS.md.
- **Learning** (`koloda:settings/learning`) — default preset and template, daily limits, day start, learn-ahead; see LEARNING-SETTINGS.md.
- **Hotkeys** (`koloda:settings/hotkeys`) — keyboard shortcuts; see HOTKEYS.md.
- **AI** (`koloda:settings/ai`) — AI provider profiles and their models; see AI-PROVIDERS.md.
- **Sync** (`koloda:settings/sync`) — desktop app only, and in the web app its link shows as text; see SYNC.md.
