// @vitest-environment jsdom

import DOMPurify from "dompurify";
import { describe, expect, it } from "vitest";
import { MARKDOWN_IMAGE_MARK, markdownToHtml, markdownToPlainText } from "./markdown";

describe("markdownToHtml", () => {
  it("keeps links and drops remote images", () => {
    const html = markdownToHtml(
      [
        "[docs](https://docs.example/guide)",
        "![](https://evil.example/card.png?q=secret)",
        '<img src="//evil.example/a.png" srcset="https://evil.example/b.png 2x">',
        '<video poster="https://evil.example/c.png"></video>',
        '<svg><image href="https://evil.example/d.png"></image></svg>',
        "<style>b{background:url(https://evil.example/e.png)}</style>",
        '<p style="background:url(https://evil.example/f.png)">styled</p>',
      ].join("\n"),
    );

    expect(html).toContain("https://docs.example/guide");
    expect(html).not.toContain("evil.example");
    expect(html).not.toContain("<style");
  });

  it("keeps relative images", () => {
    const html = markdownToHtml("![](/cards/front.png)");

    expect(html).toContain('src="/cards/front.png"');
  });

  it("shows data and remote images as their alt text", () => {
    const html = markdownToHtml(
      [
        "![logo](data:image/gif;base64,R0lGODlhAQABAAAAACw=)",
        '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="dot">',
        "![a <b>](https://evil.example/c.png)",
      ].join("\n"),
    );

    expect(html).toBe("<p>logo\ndot\na &lt;b&gt;</p>\n");
  });
});

describe("markdownToHtml attachment refs", () => {
  const id = "0123456789abcdef".repeat(4);

  it("renders a ref as an image with its attachment id, its alt text, and no src", () => {
    const template = document.createElement("template");
    template.innerHTML = markdownToHtml(`![a "b" <c>](attachment:${id})`, { shouldKeepAttachmentImages: true });
    const img = template.content.querySelector("img");

    expect(img?.dataset.attachmentId).toBe(id);
    expect(img?.alt).toBe('a "b" <c>');
    expect(img?.hasAttribute("src")).toBe(false);
  });

  it("shows a ref as its alt text when the caller does not resolve attachments", () => {
    expect(markdownToHtml(`![label](attachment:${id})`)).toBe("<p>label</p>\n");
  });

  it.each([
    ["63 hex characters", `attachment:${id.slice(1)}`],
    ["uppercase hex", `attachment:${id.toUpperCase()}`],
  ])("shows a malformed ref (%s) as its alt text", (_, href) => {
    expect(markdownToHtml(`![label](${href})`, { shouldKeepAttachmentImages: true })).toBe("<p>label</p>\n");
  });

  it("refuses to render without a DOM instead of returning unsanitized HTML", () => {
    const isSupported = DOMPurify.isSupported;
    // WHY: this lib shares modules across test files, so the instance must be restored.
    DOMPurify.isSupported = false;
    try {
      expect(() => markdownToHtml('<img src="x" onerror="alert(1)">')).toThrow();
    } finally {
      DOMPurify.isSupported = isSupported;
    }
  });
});

describe("markdownToPlainText", () => {
  const id = "0123456789abcdef".repeat(4);
  const image = `![photo](attachment:${id})`;

  it.each([
    ["empty input", "", ""],
    ["emphasis inside a word", "**bo**ld, *it*alic, ~~gone~~", "bold, italic, gone"],
    ["headings and paragraphs", "# Title\n\nfirst\nsecond", "Title first second"],
    ["a blockquote and a rule", "> quoted\n\n---\n\nafter", "quoted after"],
    ["list items, nested and task", "- [ ] one\n- two\n  1. three", "one two three"],
    ["table cells", "| a | b |\n| --- | --- |\n| c | d |", "a b c d"],
    ["a fenced code block", "before\n\n```js\nrun()\n```\n\nafter", "before run() after"],
    ["inline code", "call `a < b` now", "call a < b now"],
    ["a link", "see [the docs](https://docs.example/guide) here", "see the docs here"],
    ["raw HTML", "<div>block <b>bo</b>ld</div>\n\nin<i>line</i> tag", "block bold inline tag"],
    ["an HTML line break", "one<br>two<br />three", "one two three"],
    ["an escaped mark", "2 \\* 3", "2 * 3"],
    ["a card image", `front ${image} back`, `front ${MARKDOWN_IMAGE_MARK} back`],
    ["a card image alone", image, MARKDOWN_IMAGE_MARK],
    ["a card image inside a link", `[${image} open](https://docs.example)`, `${MARKDOWN_IMAGE_MARK} open`],
    ["a remote image", "![a *remote* logo](https://evil.example/c.png)", "a remote logo"],
    ["a malformed card image", `![label](attachment:${id.slice(1)})`, "label"],
  ])("reads %s", (_, markdown, text) => {
    expect(markdownToPlainText(markdown)).toBe(text);
  });
});
