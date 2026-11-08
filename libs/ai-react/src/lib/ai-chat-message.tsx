import type { UIMessage, UIMessagePart } from "ai";
import { memo } from "react";
import type { PropsWithChildren, ReactNode } from "react";
import { tv } from "tailwind-variants";

export type AIChatMessageProps = {
  role: UIMessage["role"];
  parts: UIMessagePart<any, any>[];
  renderText?: (text: string) => ReactNode;
};

// WHY: memoized on props identity — immer keeps untouched messages' parts
// references stable, so streamed chunks skip this message's text. It covers the
// text only; a caller that adds rows around it memoizes the whole turn.
export const AIChatMessage = memo(function AIChatMessage({ role, parts, renderText }: AIChatMessageProps) {
  const textRenderer = role === "user" ? undefined : renderText;

  return (
    <AIChatMessageLayout role={role}>
      {parts.map((part, index) => (
        <MessagePart key={index} part={part} renderText={textRenderer} />
      ))}
    </AIChatMessageLayout>
  );
});

const aiChatMessage = tv({
  base: "flex flex-col gap-4 px-3",
  variants: {
    isUser: {
      true: "self-end max-w-5/6 py-2 mx-2 border-2 rounded-xl bg-chat-message border-chat-message",
      false: "self-start w-full",
    },
  },
});

type AIChatMessageLayoutProps = PropsWithChildren & {
  role: UIMessage["role"];
};

export function AIChatMessageLayout({ role, children }: AIChatMessageLayoutProps) {
  return (
    <div className={aiChatMessage({ isUser: role === "user" })}>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

type MessagePartProps = {
  part: UIMessagePart<any, any>;
  renderText?: (text: string) => ReactNode;
};

function MessagePart({ part, renderText }: MessagePartProps) {
  // WHY: the app stores only text parts. Reasoning and tool calls render as
  // activity rows on the run, not as message parts.
  if (part.type !== "text") return null;
  if (renderText) return renderText(part.text);
  return <p className="whitespace-pre-wrap leading-6">{part.text}</p>;
}
