# Assistant answers link to app screens

Status: draft
Guides: agents/ASSISTANT-MAP.md, docs/specs/ASSISTANT-MESSAGES.md, docs/specs/ASSISTANT-DATA-ACCESS.md, docs/decisions/SPECS-AS-ASSISTANT-HELP.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/VERIFY.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/MARKDOWN.md, agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md
Flow: local

## Intent

When the assistant tells the user where a setting or feature lives, the answer carries a link that opens that screen.
Asked "where do I change the daily limit?", the reply names Settings → Learning, and a click on that name opens it.

Done when a link to an app screen in an assistant reply opens that screen in the same window on both hosts,
a link the app cannot resolve shows as plain text, and `docs/specs/ASSISTANT-MESSAGES.md` describes both.

Scheduled from the backlog entry `assistant-deep-links`, which had no brief, read at `5bbd1fbc`:
"Give assistant answers in-app deep links to the screen where a setting or feature lives.
Answers can only describe where a setting lives, not link to it."

## Scope

In:

- A link form the model writes in its markdown, and the set of targets it may name (open questions 1–2).
- Rendering those links in assistant text and reasoning, and in-app navigation on click.
- Telling the model the link form and the targets (open question 3).
- The spec changes: `docs/specs/ASSISTANT-MESSAGES.md` (§Message Content), and the link rule in
  `docs/specs/CARDS.md` (§Rendered Markdown) if it must name the new kind of link.

Out:

- Changing settings from the chat; that is the backlog item `assistant-change-settings`.
- Links in user messages, card content, or lesson views.
- Links that open the app from outside it (OS protocol handlers, URLs shared between devices).

## Context

Facts at `5bbd1fbc` that the plan builds on.

- Assistant text renders through `markdownToHtml` (`libs/srs/src/lib/markdown.ts`), DOMPurify-sanitized,
  into `dangerouslySetInnerHTML` in `libs/assistant-react/src/lib/ui/assistant-markdown.tsx`.
  The same function renders card content, so a change to link handling there reaches cards too.
- Links today: on desktop, a web link opens in the system browser and other links do nothing
  (`apps/electron/src/navigation-policy.ts`, `window.ts`); on web, a link leaves the app in the current tab
  (`docs/specs/CARDS.md` (§Rendered Markdown)).
- Routing is TanStack Router, routes in `libs/app-react/src/lib/routes/`.
  Desktop uses hash history in a packaged build; web uses browser history.
  `@koloda/assistant-react` and `@koloda/ai-react` must not import `@koloda/app-react` (`agents/ASSISTANT-MAP.md`).
- Screens: Dashboard, Decks and one deck, Presets and one preset, Templates and one template, Assistant,
  and Settings with Interface, Learning, Hotkeys, AI, and Sync (desktop only).
  `docs/help/APP-MAP.md` is the help topic that names them for the model.
- `get_settings`'s description says "This tool cannot change settings; say where the user changes them
  (the app-map help topic)" (`libs/ai/src/lib/assistant-tools.ts:409`).
- A rule the model must always follow goes in a tool description: tool descriptions are sent on every run,
  and a custom system prompt replaces the built-in one (`tasks/archive/assistant-self-awareness.md`, Context).
- User messages already carry entity tokens, `@[<title>](algorithm:<id>)` and its deck and template kinds
  (`docs/specs/ASSISTANT-MESSAGES.md` (§Mentions)).

## Open questions

- [ ] 1. How fine is a target: a screen only, also one deck, template, or preset by id, or down to one setting on its page? — open
- [ ] 2. What does the model write: a closed set of named targets under an app scheme
  (such as `[Learning settings](koloda:settings/learning)`), which the renderer maps to routes,
  or route paths themselves? — open
- [ ] 3. Where does the model learn the form and the targets: a tool description (always sent), the app-map help topic,
  the built-in prompt, or a split of these? — open
- [ ] 4. What shows for a target that cannot open: a deleted deck, or Sync on the web app? Plain text, or a link to a not-found state? — open
- [ ] 5. Does Copy keep the app links in the copied markdown, or turn each into its text? — open

## Plan

To be written once the open questions are answered (`agents/IMPLEMENTATION-PLAN.md`).

## Outcome

<what shipped>

Spec: <comma-separated paths under docs/specs/, or none — reason>
Review: <findings by tier with the rule each cites, none, or not run>
Change rounds: <N>
