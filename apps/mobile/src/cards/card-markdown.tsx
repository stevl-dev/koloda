import { ATTACHMENT_REF_PATTERN } from "@koloda/srs";
import { Marked } from "marked";
import type { Token, Tokens } from "marked";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { CardImage } from "./card-image";
import type { MarkdownColors } from "./markdown-colors";
import { useMarkdownColors } from "./markdown-colors";

// INVARIANT: default options, as `libs/srs` parses card markdown, so the phone reads the same tokens as desktop.
const cardMarkdown = new Marked();

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

// WHY: marked keeps entities as written, and a browser decodes them on display; native text does not.
function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isNaN(code) ? entity : String.fromCodePoint(code);
    }
    return ENTITIES[name.toLowerCase()] ?? entity;
  });
}

// INVARIANT: raw HTML shows as its text with the tags dropped; nothing in it renders or loads.
function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ""));
}

// WHY: only web links leave the app (docs/specs/CARDS.md §Rendered Markdown); other schemes do nothing.
function isWebLink(href: string): boolean {
  return /^https?:\/\//i.test(href.trim());
}

function attachmentId(token: Token): string | null {
  if (token.type !== "image") return null;
  return ATTACHMENT_REF_PATTERN.exec((token as Tokens.Image).href)?.[1] ?? null;
}

type Context = { colors: MarkdownColors };

function renderInline(tokens: Token[], context: Context): ReactNode[] {
  const { colors } = context;
  return tokens.map((token, i) => {
    switch (token.type) {
      case "text": {
        const { tokens: children, text } = token as Tokens.Text;
        return children ? renderInline(children, context) : decodeEntities(text);
      }
      case "escape":
        return (token as Tokens.Escape).text;
      case "strong":
        return (
          <Text key={i} style={styles.strong}>
            {renderInline((token as Tokens.Strong).tokens, context)}
          </Text>
        );
      case "em":
        return (
          <Text key={i} style={styles.em}>
            {renderInline((token as Tokens.Em).tokens, context)}
          </Text>
        );
      case "del":
        return (
          <Text key={i} style={styles.del}>
            {renderInline((token as Tokens.Del).tokens, context)}
          </Text>
        );
      case "codespan":
        return (
          <Text key={i} style={[styles.code, { backgroundColor: colors.codeBackground }]}>
            {(token as Tokens.Codespan).text}
          </Text>
        );
      case "link": {
        const { href, tokens: children } = token as Tokens.Link;
        return (
          <Text
            key={i}
            accessibilityRole="link"
            style={{ color: colors.link }}
            onPress={isWebLink(href) ? () => void Linking.openURL(href.trim()) : undefined}
          >
            {renderInline(children, context)}
          </Text>
        );
      }
      case "image":
        // WHY: a card image is cut out of the run by `renderRuns`; any other image never loads, so its alt shows.
        return decodeEntities((token as Tokens.Image).text);
      case "html":
        return stripTags((token as Tokens.HTML).text);
      case "br":
        return "\n";
      default:
        return "text" in token && typeof token.text === "string" ? decodeEntities(token.text) : token.raw;
    }
  });
}

// WHY: native text cannot hold an image, so a card image splits its paragraph into text runs around it.
function renderRuns(tokens: Token[], context: Context, style: object): ReactNode {
  const parts: ReactNode[] = [];
  let run: Token[] = [];
  const flush = () => {
    if (run.length === 0) return;
    parts.push(
      <Text key={parts.length} style={[{ color: context.colors.text }, style]}>
        {renderInline(run, context)}
      </Text>,
    );
    run = [];
  };
  for (const token of tokens) {
    const id = attachmentId(token);
    if (!id) {
      run.push(token);
      continue;
    }
    flush();
    parts.push(
      <CardImage
        key={parts.length}
        id={id}
        alt={decodeEntities((token as Tokens.Image).text)}
        color={context.colors.text}
      />,
    );
  }
  flush();
  return parts.length === 1 ? parts[0] : <View style={styles.runs}>{parts}</View>;
}

function renderBlocks(tokens: Token[], context: Context): ReactNode[] {
  const { colors } = context;
  return tokens.map((token, i) => {
    switch (token.type) {
      case "space":
      case "def":
      case "checkbox":
        return null;
      case "heading": {
        const { depth, tokens: children } = token as Tokens.Heading;
        return <View key={i}>{renderRuns(children, context, [styles.heading, HEADING_SIZES[depth - 1]])}</View>;
      }
      case "paragraph":
        return <View key={i}>{renderRuns((token as Tokens.Paragraph).tokens, context, styles.body)}</View>;
      case "text": {
        const { tokens: children, text } = token as Tokens.Text;
        return <View key={i}>{renderRuns(children ?? [{ type: "text", raw: text, text }], context, styles.body)}</View>;
      }
      case "code":
        return (
          <View key={i} style={[styles.codeBlock, { backgroundColor: colors.codeBackground }]}>
            <Text style={[styles.mono, { color: colors.text }]}>{(token as Tokens.Code).text}</Text>
          </View>
        );
      case "blockquote":
        return (
          <View key={i} style={[styles.quote, { borderLeftColor: colors.border }]}>
            {renderBlocks((token as Tokens.Blockquote).tokens, { colors: { ...colors, text: colors.muted } })}
          </View>
        );
      case "list": {
        const { items, ordered, start } = token as Tokens.List;
        const first = typeof start === "number" ? start : 1;
        return (
          <View key={i} style={styles.list}>
            {items.map((item, n) => (
              <View key={n} style={styles.item}>
                <Text style={[styles.body, styles.marker, { color: colors.text }]}>
                  {item.task ? (item.checked ? "☑" : "☐") : ordered ? `${first + n}.` : "•"}
                </Text>
                <View style={styles.itemBody}>{renderBlocks(item.tokens, context)}</View>
              </View>
            ))}
          </View>
        );
      }
      case "table": {
        const { header, rows } = token as Tokens.Table;
        return (
          <View key={i} style={[styles.table, { borderColor: colors.border }]}>
            {[header, ...rows].map((cells, r) => (
              <View key={r} style={[styles.row, r > 0 && { borderTopColor: colors.border, borderTopWidth: 1 }]}>
                {cells.map((cell, c) => (
                  <Text key={c} style={[styles.cell, styles.body, { color: colors.text }, r === 0 && styles.strong]}>
                    {renderInline(cell.tokens, context)}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        );
      }
      case "hr":
        return <View key={i} testID="markdown-rule" style={[styles.hr, { backgroundColor: colors.border }]} />;
      case "html": {
        const text = stripTags((token as Tokens.HTML).text).trim();
        return text ? (
          <Text key={i} style={[styles.body, { color: colors.text }]}>
            {text}
          </Text>
        ) : null;
      }
      default:
        return (
          <Text key={i} style={[styles.body, { color: colors.text }]}>
            {token.raw}
          </Text>
        );
    }
  });
}

export type CardMarkdownProps = {
  text: string;
};

export function CardMarkdown({ text }: CardMarkdownProps) {
  const colors = useMarkdownColors();
  const tokens = useMemo(() => cardMarkdown.lexer(text), [text]);
  return <View style={styles.root}>{renderBlocks(tokens, { colors })}</View>;
}

const HEADING_SIZES = [
  { fontSize: 26 },
  { fontSize: 22 },
  { fontSize: 19 },
  { fontSize: 17 },
  { fontSize: 16 },
  {
    fontSize: 15,
  },
];

const styles = StyleSheet.create({
  root: { gap: 10 },
  runs: { gap: 8 },
  body: { fontSize: 16, lineHeight: 24 },
  heading: { fontWeight: "700" },
  strong: { fontWeight: "700" },
  em: { fontStyle: "italic" },
  del: { textDecorationLine: "line-through" },
  mono: { fontFamily: "monospace", fontSize: 14 },
  code: { fontFamily: "monospace", fontSize: 14 },
  codeBlock: { padding: 10, borderRadius: 6 },
  quote: { borderLeftWidth: 3, paddingLeft: 10, gap: 8 },
  list: { gap: 4 },
  item: { flexDirection: "row", gap: 6 },
  marker: { minWidth: 18 },
  itemBody: { flex: 1, gap: 4 },
  table: { borderWidth: 1, borderRadius: 4 },
  row: { flexDirection: "row" },
  cell: { flex: 1, padding: 6 },
  hr: { height: 1 },
});
