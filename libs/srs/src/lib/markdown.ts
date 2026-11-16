import type { UponSanitizeAttributeHookEvent } from "dompurify";
import DOMPurify from "dompurify";
import { Marked } from "marked";
import type { MarkedToken, Token } from "marked";
import { ATTACHMENT_REF_PATTERN } from "./attachments";

// WHY: A remote image URL is fetched as soon as the markdown is shown, so a
// prompt injection can carry card text out in the query string. Links stay;
// they wait for a click. Only relative URLs stay: data: URLs go too, because
// inline image bytes bloat the text that every card read loads.
const RELATIVE_IMAGE_BASE = "https://koloda.invalid";

const AUTO_LOAD_ATTRS = new Set(["src", "poster", "background"]);
const SVG_IMAGE_TAGS = new Set(["image", "feimage"]);

// WHY: a dedicated instance keeps the attachment renderer out of the global `marked` defaults.
// An attachment image has no src: the card renderer resolves `data-attachment-id` from the database.
const cardMarkdown = new Marked({
  renderer: {
    image({ href, text, tokens }) {
      const match = ATTACHMENT_REF_PATTERN.exec(href);
      if (!match) return false;
      const alt = tokens ? this.parser.parseInline(tokens, this.parser.textRenderer) : text;
      return `<img data-attachment-id="${match[1]}" alt="${escapeAttribute(alt)}">`;
    },
  },
});

export type MarkdownToHtmlOptions = { shouldKeepAttachmentImages?: boolean };

export function markdownToHtml(
  markdown: string,
  { shouldKeepAttachmentImages = false }: MarkdownToHtmlOptions = {},
): string {
  const html = cardMarkdown.parse(markdown, { async: false }) as string;
  // WHY: CSS can load a remote image via url(), from a <style> tag or a style attribute.
  const config = { FORBID_TAGS: ["style"], FORBID_ATTR: ["style"] };
  // WHY: without a DOM, DOMPurify returns its input unchanged. Every caller renders in the browser,
  // so a missing DOM is a wiring bug; returning the HTML would show it unsanitized.
  if (!DOMPurify.isSupported) throw new Error("markdownToHtml needs a DOM to sanitize");
  const fragment = DOMPurify.sanitize(html, { ...config, RETURN_DOM_FRAGMENT: true });
  // WHY: browsers draw a broken-image icon for an image without a source, so its alt text
  // takes its place. Attachment images stay only for a caller that resolves them.
  const sourceless = shouldKeepAttachmentImages ? "img:not([src]):not([data-attachment-id])" : "img:not([src])";
  for (const img of fragment.querySelectorAll<HTMLImageElement>(sourceless)) img.replaceWith(img.alt);
  const container = document.createElement("div");
  container.append(fragment);
  return container.innerHTML;
}

// WHY: the cards table shows, searches, and sorts one string per field, so a card image has to be a
// character in that string. U+FFFC cannot be typed into a search and sorts after text.
export const MARKDOWN_IMAGE_MARK = "\uFFFC";

// WHY: reads lexer tokens instead of the sanitized HTML. The cards table calls this for every card in a
// deck, and DOMPurify per value is too slow for that. The result is shown as text, never as HTML.
export function markdownToPlainText(markdown: string): string {
  return tokensToPlainText(cardMarkdown.lexer(markdown)).replace(/\s+/g, " ").trim();
}

function tokensToPlainText(tokens: Token[]): string {
  return tokens.map(tokenToPlainText).join("");
}

// WHY: block-level text is padded with spaces so neighbouring blocks do not run together. Inline text is
// not, so a word with formatting inside it stays one word. The caller collapses the extra spaces.
function tokenToPlainText(generic: Token): string {
  const token = generic as MarkedToken;
  switch (token.type) {
    case "image":
      return ATTACHMENT_REF_PATTERN.test(token.href) ? MARKDOWN_IMAGE_MARK : tokensToPlainText(token.tokens);
    case "html": {
      const text = token.text.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "");
      return token.block ? ` ${text} ` : text;
    }
    case "code":
      return ` ${token.text} `;
    case "codespan":
    case "escape":
      return token.text;
    case "text":
      return token.tokens ? tokensToPlainText(token.tokens) : token.text;
    case "list":
      return tokensToPlainText(token.items);
    case "table":
      return [...token.header, ...token.rows.flat()].map((cell) => ` ${tokensToPlainText(cell.tokens)} `).join("");
    case "paragraph":
    case "heading":
    case "blockquote":
    case "list_item":
      return ` ${tokensToPlainText(token.tokens)} `;
    case "strong":
    case "em":
    case "del":
    case "link":
      return tokensToPlainText(token.tokens);
    case "br":
    case "space":
      return " ";
    default:
      return "";
  }
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function isSafeImageUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value.trim(), RELATIVE_IMAGE_BASE);
  } catch {
    return false;
  }
  return url.origin === RELATIVE_IMAGE_BASE;
}

function dropRemoteImageUrl(node: Element, data: UponSanitizeAttributeHookEvent): void {
  const attr = data.attrName.toLowerCase();
  // WHY: srcset candidates are comma-separated and data URLs contain commas.
  if (attr === "srcset") {
    data.keepAttr = false;
    return;
  }
  const tag = node.tagName.toLowerCase();
  const svgImageLink = (attr === "href" || attr === "xlink:href") && SVG_IMAGE_TAGS.has(tag);
  if (!AUTO_LOAD_ATTRS.has(attr) && !svgImageLink) return;
  if (!isSafeImageUrl(data.attrValue)) data.keepAttr = false;
}

// WHY: Without a DOM (node-environment tests import this module), DOMPurify
// returns early and never defines addHook.
if (DOMPurify.isSupported) {
  DOMPurify.addHook("uponSanitizeAttribute", dropRemoteImageUrl);
}
