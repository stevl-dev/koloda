# Assistant answers link to app screens

Status: ready
Guides: agents/ASSISTANT-MAP.md, docs/specs/ASSISTANT-MESSAGES.md, docs/specs/ASSISTANT-DATA-ACCESS.md, docs/specs/CARDS.md, docs/decisions/SPECS-AS-ASSISTANT-HELP.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/VERIFY.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/MARKDOWN.md, agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md
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

- [x] 1. How fine is a target: a screen only, also one deck, template, or preset by id, or down to one setting on its page?
  — Screens and entities: every screen and settings page, plus one deck, preset, or template by id.
  No link reaches a single setting on its page.
- [x] 2. What does the model write: a closed set of named targets under an app scheme
  (such as `[Learning settings](koloda:settings/learning)`), which the renderer maps to routes,
  or route paths themselves?
  — A closed app scheme, such as `koloda:settings/learning` and `koloda:deck/<id>`.
  The renderer maps each target to a route, so saved replies survive a route change.
- [x] 3. Where does the model learn the form and the targets: a tool description (always sent), the app-map help topic,
  the built-in prompt, or a split of these?
  — The form goes in an always-sent tool description, so a custom prompt cannot remove it.
  Each screen's link goes in `docs/help/APP-MAP.md`, beside that screen's section.
- [x] 4. What shows for a target that cannot open: a deleted deck, or Sync on the web app? Plain text, or a link to a not-found state?
  — Plain text for a target outside the closed set and for Sync on the web app.
  A link to a deleted deck, preset, or template stays a link and opens that route's own not-found state.
- [x] 5. Does Copy keep the app links in the copied markdown, or turn each into its text?
  — Each app link is copied as its text; the links mean nothing outside the app.

## Plan

Targets, fixed by open questions 1–2.
A target is the text after `koloda:` in a markdown link, `[text](koloda:<target>)`.
Screens: `dashboard`, `decks`, `algorithms`, `templates`, `assistant`,
`settings/interface`, `settings/learning`, `settings/hotkeys`, `settings/ai`, `settings/sync`.
Entities: `deck/<id>`, `template/<id>`, `algorithm/<id>`, the kinds `libs/ai/src/lib/mentions.ts` uses.
Routes: `/dashboard`, `/decks`, `/algorithms`, `/templates`, `/ai`, `/settings/<page>`,
`/decks/$deckId`, `/templates/$templateId`, `/algorithms/$algorithmId`.

- [x] 1. Let `markdownToHtml` render app links through a resolver
  Goal: `markdownToHtml` in `libs/srs/src/lib/markdown.ts` takes a new option, `resolveAppLink?: (target: string) => string | null`.
  A markdown link whose href starts with `koloda:` is an app link; its target is the rest of the href.
  With the option, an app link renders as `<a href="<resolved>" data-app-link="<target>">` around its text,
  or as its text alone when the resolver returns null.
  Without the option, an app link renders as its text alone, so card content never shows one as a link.
  Resolve in the marked link renderer, before DOMPurify runs:
  DOMPurify 3.4.16's default URI check drops a `koloda:` href, and keeps a relative or `#` href and `data-*` attributes.
  The resolver's href still passes through DOMPurify; a resolver that returns an unsafe href gets it stripped.
  Other links render as today.
  Constraints: `libs/srs` only.
  `libs/srs` knows the `koloda:` prefix and nothing about which targets exist.
  No spec change: the behavior the user sees arrives in item 2.
  Done when: `libs/srs/src/lib/markdown.test.ts` covers an app link with and without the option, a null resolve,
  link text with formatting, and an ordinary link unchanged; `bun run check:push` passes.
  Commit: Let markdownToHtml render app links through a resolver
  Depends on: none

- [x] 2. Open app screens from links in assistant replies
  Goal: a click on an app link in assistant text or reasoning opens its screen in the same window, on both hosts.
  - `libs/ai/src/lib/app-links.ts` (exported from `@koloda/ai`) owns the closed target set above:
    `parseAppLinkTarget(target)` returns a typed target, a screen or an entity kind with its id, or null for anything else.
    Entity ids must be non-empty and contain no `/`.
  - `libs/assistant-react/src/lib/ui/assistant-markdown.tsx` reads an app-link context:
    `href(target)` returns the href for a typed target or null, and `open(target)` navigates.
    It parses each target with `parseAppLinkTarget`, passes `resolveAppLink` to `markdownToHtml`,
    and handles clicks by delegation on its container: a primary click with no modifier key on `a[data-app-link]`
    calls `preventDefault` and `open`.
    Other clicks keep the browser's behavior, so a modified click on the web app opens the href in a new tab.
    Without a provider, app links render as text.
    `renderAssistantMarkdown` and `renderAssistantReasoningMarkdown` stay module-level for a stable `renderText`.
  - `AssistantChat` takes an `appLinks` prop with `href` and `open` and provides the context.
    `@koloda/assistant-react` gains no router dependency and does not import `@koloda/app-react`.
  - `libs/app-react` maps each typed target to its route, builds the href through the router
    (hash history in a packaged desktop build, browser history on the web), and navigates with the router.
    `settings/sync` resolves to null when `syncQueriesAtom` is null, as `_.settings.tsx` hides that page.
    A link to a deleted deck, template, or preset still resolves; its route shows its own not-found state.
    `/_/ai` passes the result to `AssistantChat`.
  - Specs: `docs/specs/ASSISTANT-MESSAGES.md` (§Message Content) says an assistant reply may link to an app screen,
    a deck, a template, or a preset; a click opens it in the same window; a link the app cannot open shows as text.
    `docs/specs/CARDS.md` (§Rendered Markdown) says app links are only for assistant replies and show as text elsewhere.
  Constraints: `libs/ai`, `libs/assistant-react`, `libs/app-react`, the two specs.
  Do not touch Electron's navigation policy: a handled click never navigates the frame.
  Done when: tests cover `parseAppLinkTarget` (every screen, each entity kind, unknown, empty id, extra segments),
  and `AssistantMarkdown` (a click calls `open`, a modified click does not, a null `href` renders text,
  no provider renders text); `bun run check:push` passes.
  Manual: in the dev app, a reply written with `[Learning](koloda:settings/learning)` opens Settings → Learning.
  Commit: Open app screens from links in assistant replies
  Depends on: 1

- [x] 3. Teach the assistant to link to app screens
  Goal: the model writes app links when it says where something is.
  - `read_help_topic`'s description in `libs/ai/src/lib/assistant-tools.ts` gains the form:
    link to a screen as `[<label>](koloda:<target>)` with the target the app-map topic gives,
    and to one deck, template, or preset as `koloda:deck/<id>`, `koloda:template/<id>`, or `koloda:algorithm/<id>`
    with an id from a tool or a mention; never invent a target.
  - `get_settings`'s last line changes "say where the user changes them" to say where and link to that screen.
  - `docs/help/APP-MAP.md` gives each screen's target beside its section, Settings pages included,
    and says Sync's link works only in the desktop app.
    Run `bun run gen:help` to regenerate `libs/ai/src/lib/help-corpus.generated.ts`.
  - `docs/specs/ASSISTANT-DATA-ACCESS.md` (§Tool Guidance) gains a bullet: to link to the screen where something is.
  Constraints: no change to the built-in prompt in `libs/ai/src/lib/prompts.ts` (open question 3).
  Done when: `libs/ai` tests that pin tool descriptions or the help corpus are updated; `bun run check:push` passes.
  Manual: asked "where do I change the daily limit?", the assistant answers with a link that opens Settings → Learning.
  Commit: Teach the assistant to link to app screens
  Depends on: 2

- [ ] 4. Copy app links in assistant turns as their text
  Goal: an assistant turn's copy action turns each `[text](koloda:<target>)` into `text`; other links stay as written.
  Add `replaceAppLinksWithText` to `libs/ai/src/lib/app-links.ts` and apply it to the turn's text where
  `libs/assistant-react/src/lib/ui/use-assistant-message-renderer.tsx` builds `copyText`.
  Spec: `docs/specs/ASSISTANT-MESSAGES.md` (§Copying a Message) says app links are copied as their text.
  Constraints: `libs/ai`, `libs/assistant-react`, the spec; the cards part of the copy is unchanged.
  Done when: tests cover `replaceAppLinksWithText` (one link, several, an ordinary link kept, formatting in the text)
  and the renderer's copy text; `bun run check:push` passes.
  Commit: Copy app links in assistant turns as their text
  Depends on: 2

## Outcome

<what shipped>

Spec: <comma-separated paths under docs/specs/, or none — reason>
Review: <findings by tier with the rule each cites, none, or not run>
Change rounds: <N>
