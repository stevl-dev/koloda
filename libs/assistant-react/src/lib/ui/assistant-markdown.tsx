import { parseAppLinkTarget } from "@koloda/ai";
import type { AppLinkTarget } from "@koloda/ai";
import { markdownToHtml } from "@koloda/srs";
import { createContext, useContext, useMemo } from "react";
import type { MouseEvent } from "react";
import { tv } from "tailwind-variants";

const assistantMarkdown = tv({
  base: "prose prose-chat max-w-none",
  variants: {
    isMuted: { true: "prose-chat-muted" },
  },
  defaultVariants: {
    isMuted: false,
  },
});

export type AssistantAppLinks = {
  href: (target: AppLinkTarget) => string | null;
  open: (target: AppLinkTarget) => void;
};

export const AssistantAppLinksContext = createContext<AssistantAppLinks | null>(null);

type AssistantMarkdownProps = { text: string; isMuted?: boolean };

export function AssistantMarkdown({ text, isMuted = false }: AssistantMarkdownProps) {
  const appLinks = useContext(AssistantAppLinksContext);
  const html = useMemo(() => {
    const resolveAppLink = appLinks
      ? (raw: string) => {
          const target = parseAppLinkTarget(raw);
          return target && appLinks.href(target);
        }
      : undefined;
    return markdownToHtml(text, { resolveAppLink });
  }, [text, appLinks]);

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!appLinks || !(event.target instanceof Element)) return;
    // WHY: a modified or non-primary click keeps the browser's behavior, such as opening the href in a new tab.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = parseAppLinkTarget(event.target.closest<HTMLElement>("a[data-app-link]")?.dataset.appLink ?? "");
    if (!target) return;
    event.preventDefault();
    appLinks.open(target);
  };

  // WHY: the click reaches this container from a link inside the HTML; a keyboard Enter on that link fires the same
  // click, so the container itself needs no key handler.
  return (
    <div className={assistantMarkdown({ isMuted })} onClick={handleClick} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

// WHY: module-level so `AIChatMessage` / `AIToolActivity` see a stable
// `renderText` identity across streamed chunks and do not re-render
// untouched messages.
export function renderAssistantMarkdown(text: string) {
  return <AssistantMarkdown text={text} />;
}

export function renderAssistantReasoningMarkdown(text: string) {
  return <AssistantMarkdown text={text} isMuted />;
}
