# Cards table content cells

Status: ready
Guides: agents/TASKS.md, agents/IMPLEMENTATION-PLAN.md, docs/specs/CARDS.md, docs/specs/MEDIA.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/CSS.md, agents/I18N.md, agents/TESTING.md, agents/VERIFY.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/MARKDOWN.md, agents/REVIEW.md
Flow: local

## Intent

The cards table is for scanning and finding cards.
Today a content cell shows the field's raw text and wraps without limit.
A markdown field shows its source, an image shows as a reference with a 64-character id,
and one long cell makes its row many lines tall beside one-line rows.

Rulings from the human (2026-11-16):

- Every content cell is one line; text that does not fit is cut with an ellipsis.
- A markdown field shows as plain text: what the rendered card would say, without formatting.
- A card image shows as an image icon only: no alt text and no thumbnail.
- Search and sort use the text the cell shows, not the markdown source.

Rulings the agent made, confirmed by the human at plan approval:

- A text field still shows as written; only its line breaks collapse, as today.
- An image that rendered markdown would not show (another site, embedded data) shows its alt text,
  as CARDS.md (§Rendered Markdown) already says for rendered cards.
- An image icon is not searchable, and a cell that starts with one sorts after cells that start with text.
- The cell has no hover tooltip with the full text; preview and edit show it.

Done when: in a deck with long, multi-line, markdown, and image content, every table row has the same height.
A markdown cell reads as plain text, a card image is an icon, and search finds a card by the text its cell shows.
Searching for markdown syntax or part of an image id finds nothing.

## Scope

In:

- A plain-text reading of card markdown in `libs/srs`, next to `markdownToHtml`.
- The cards table content columns in `libs/srs-react`: value, cell, search, sort.
- `docs/specs/CARDS.md` (§Card Content, §Table View) and `docs/specs/MEDIA.md` (§Where Images Show).
- One new message for the image icon's accessible name, in the `libs/srs-react` catalogs.

Out:

- Image thumbnails in the table.
- A hover tooltip or an expandable row for the full text.
- Rendering markdown formatting (bold, code, links) inside a cell.
- The shared table primitives in `libs/ui`, the stack view, the card editor, and the mobile app.
- Decoding HTML entities written in markdown source; they show as written.
- Column resizing.

## Open questions

- [x] Confirm the agent rulings in Intent — confirmed by the human (2026-11-16)

## Plan

- [x] 1. Add a plain-text reading of card markdown
  Goal: add `markdownToPlainText(markdown: string): string` to `libs/srs/src/lib/markdown.ts`.
  It reads the tokens of the installed `marked` lexer (17.0.2; read its types in `node_modules`), with no DOM.
  It needs no DOM because the table calls it for every card in a deck, and DOMPurify per value is too slow for that.
  Rules: formatting marks are dropped (emphasis, strong, strikethrough, headings, blockquotes, list markers, rules).
  Block-level pieces (paragraphs, list items, table cells, code blocks) are joined by one space.
  Inline code and code blocks keep their text, without fences or the language tag.
  A link gives its text, not its URL.
  Raw HTML tags are dropped and the text between them stays.
  An image whose target matches `ATTACHMENT_REF_PATTERN` becomes one exported marker character, U+FFFC.
  Any other image becomes its alt text.
  Runs of whitespace collapse to one space and the result is trimmed.
  Export the marker as a named constant, with a `// WHY:` saying one string feeds display, search, and sort.
  Update the Markdown line of the Architectural Map in `libs/srs/README.md`.
  Constraints: `libs/srs` only; do not change `markdownToHtml`; no new dependency; no Rust twin, since
  `crates/koloda` has no markdown code.
  Tests go in `libs/srs/src/lib/markdown.test.ts` as one table-driven test, one row per rule above,
  plus empty input, an image-only value, and an image inside a link.
  Done when: `bunx vitest run --config libs/srs/vitest.config.mjs --configLoader runner markdown` passes,
  and `bun run typecheck` passes.
  Commit: Add a plain-text reading of card markdown
  Depends on: none

- [ ] 2. Show cards table content as one line of plain text
  Goal: change the content columns of `libs/srs-react/src/lib/cards/cards-table.tsx`.
  The accessor resolves the field through the card's own template, as it does now, and also reads that field's type.
  For a `markdown` field it returns `markdownToPlainText(text)`; for a `text` field it returns the text unchanged.
  A column can mix both types, because columns are aligned by field position across templates.
  Search (the global filter) and sort already read the accessor, so they follow with no other change.
  In `cards-table-cell.tsx`, a content cell (column id starts with `content.field.`) renders on one line with an
  ellipsis, and replaces each marker character with `ImageIcon` from `@koloda/ui`.
  The icon's accessible name is a new message, `cards-table.content.image`, in the `en` and `ru` catalogs of
  `libs/srs-react`; follow `agents/I18N.md` for extract and compile.
  Update the specs in the same commit:
  `docs/specs/CARDS.md` (§Card Content, §Table View) and `docs/specs/MEDIA.md` (§Where Images Show) say the table
  shows raw text and a raw image reference; state the new behavior, including what search matches.
  Then run `bun run gen:help`.
  Constraints: do not edit `libs/ui`; pass classes through the `class` option of `Table.CellContent` variants.
  Risk to settle first: the table root has `table-fixed` but no width, so the browser may lay it out with the
  automatic algorithm, where `white-space: nowrap` content widens its column and pushes the table past its container.
  The one-line cell must not change any column's width.
  The `td` is already `relative`, and `tableCellContent` has a `size: "full"` variant (`absolute inset-0`) that takes
  the content out of the width calculation; if that is used, centre the text vertically, since row height then comes
  from the other cells.
  Tests go in `cards-table.test.tsx`, with a `// WHY:` naming what the table owns that item 1 cannot see:
  a markdown field and a text field at the same position each show by their own card's template;
  search matches the shown text and not markdown syntax or an attachment id;
  a card image shows as an element with the image name.
  Done when: `bunx vitest run --config libs/srs-react/vitest.config.mjs --configLoader runner cards-table` passes;
  `bun run typecheck`, `bun run check:docs`, and `bun run check:i18n` pass; and the Manual verify block below is
  handed to the human.
  Manual verify (web): open a deck whose cards have a long value, a multi-line value, markdown with a list and a code
  block, and an inserted image.
  In the table view every row has the same height, long values end in an ellipsis, and the table is no wider than
  before.
  The markdown card reads as plain text and the image is an icon.
  Search for a word inside the markdown card: it is found.
  Search for `**` or the first characters of an image id: nothing is found.
  Sort by a content column: rows reorder by the shown text.
  Commit: Show cards table content as one line of plain text
  Depends on: 1

## Outcome

Spec: docs/specs/CARDS.md, docs/specs/MEDIA.md
Review: not run
Change rounds: 0
