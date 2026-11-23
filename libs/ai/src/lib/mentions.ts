const MENTION_KINDS = ["deck", "template", "algorithm"] as const;

export type MentionKind = (typeof MENTION_KINDS)[number];

// INVARIANT: a mention is written into prompt text as `@[<title>](<kind>:<id>)`.
// Stored drafts and sent messages hold that text, and the tool descriptions tell the model how to read it.
export type Mention = {
  kind: MentionKind;
  id: string;
  title: string;
};

export type MentionTextPart = { type: "text"; text: string } | { type: "mention"; mention: Mention };

// `@[`, a title where `\` escapes the next character, `](`, a kind, `:`, an id, `)`.
const MENTION_PATTERN = new RegExp(
  String.raw`@\[((?:\\[^\n]|[^\\\]\n])*)\]\((${MENTION_KINDS.join("|")}):([0-9A-Za-z-]+)\)`,
  "g",
);

export function formatMention({ kind, id, title }: Mention): string {
  return `@[${title.replace(/[\\\]]/g, "\\$&")}](${kind}:${id})`;
}

export function parseMentionText(text: string): MentionTextPart[] {
  const parts: MentionTextPart[] = [];
  let textStart = 0;
  for (const match of text.matchAll(MENTION_PATTERN)) {
    if (match.index > textStart) parts.push({ type: "text", text: text.slice(textStart, match.index) });
    const [, escapedTitle, kind, id] = match;
    const title = escapedTitle.replace(/\\(.)/g, "$1");
    parts.push({ type: "mention", mention: { kind: kind as MentionKind, id, title } });
    textStart = match.index + match[0].length;
  }
  if (textStart < text.length) parts.push({ type: "text", text: text.slice(textStart) });
  return parts;
}

export function replaceMentionsWithTitles(text: string): string {
  return parseMentionText(text)
    .map((part) => (part.type === "text" ? part.text : `@${part.mention.title}`))
    .join("");
}
