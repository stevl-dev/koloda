import { markdownToPlainText } from "@koloda/srs";
import type { Card, Template } from "@koloda/srs";

// INVARIANT: one path per edited card sync group (crates/koloda/tests/cases/editor-sync-groups.json).
export const CARD_SYNC_GROUPS = ["content"] as const;

// INVARIANT: card lists read a field by its position on the card's own template, since one deck can hold cards of
// several templates. Search reads this text too, so it matches what the list shows.
export function cardFieldText(card: Card, template: Template | undefined, index: number): string {
  const field = template?.content.fields[index];
  if (!field) return "";
  const text = card.content[field.id]?.text ?? "";
  return field.type === "markdown" ? markdownToPlainText(text) : text;
}
