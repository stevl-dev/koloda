import { queriesAtom } from "@koloda/core-react";
import { msg } from "@lingui/core/macro";
import type { Queries } from "@koloda/core-react";
import { act, renderHook } from "@testing-library/react";
import { createStore, Provider as JotaiProvider } from "jotai";
import type { PropsWithChildren } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createQueryClient } from "../../test/test-helpers";
import { assistantPromptAttachmentsAtom } from "../state/conversation-selectors";
import { useAssistantFileAttach } from "./assistant-prompt-attachments";
import type { InputStates } from "./conversation-files";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function renderAttach(inputs: InputStates, addAttachment: (data: { bytes: Uint8Array }) => Promise<unknown>) {
  const store = createStore();
  store.set(queriesAtom, {
    addConversationAttachmentMutation: () => ({ mutationFn: addAttachment }),
  } as unknown as Queries);
  const queryClient = createQueryClient();
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <JotaiProvider store={store}>{children}</JotaiProvider>
      </QueryClientProvider>
    );
  }
  const onConversationIdChange = vi.fn();
  const { result } = renderHook(() => useAssistantFileAttach({ inputs, onConversationIdChange }), {
    wrapper: Wrapper,
  });
  return { result, store, onConversationIdChange };
}

describe("useAssistantFileAttach", () => {
  it("attaches a text file to a model that takes neither images nor PDF, and refuses the others with reasons", async () => {
    const addAttachment = vi.fn(async () => ({ id: "c".repeat(64), mime: "text/plain" }));
    const { result, store } = renderAttach({ image: "unsupported", pdf: "unknown" }, addAttachment);

    await act(() =>
      result.current.attach([
        new File([PNG], "a.png", { type: "image/png" }),
        new File(["%PDF-1.7"], "b.pdf", { type: "application/pdf" }),
        new File(["word,translation"], "c.csv", { type: "text/csv" }),
      ]),
    );

    expect(addAttachment).toHaveBeenCalledTimes(1);
    expect(store.get(assistantPromptAttachmentsAtom)).toEqual([
      { url: `conversation-attachment:${"c".repeat(64)}`, mediaType: "text/plain", filename: "c.csv" },
    ]);
    expect(result.current.feedback.reasons).toEqual([msg`ai.chat.images.unsupported`, msg`ai.chat.pdf.unknown`]);
  });

  it("shows a format error for a file of no accepted kind, and skips an untyped one silently", async () => {
    const addAttachment = vi.fn();
    const { result } = renderAttach({ image: "enabled", pdf: "enabled" }, addAttachment);

    await act(() =>
      result.current.attach([
        new File(["x"], "a.docx", { type: "application/msword" }),
        new File(["x"], "scan", { type: "" }),
      ]),
    );

    expect(addAttachment).not.toHaveBeenCalled();
    expect(result.current.feedback.errors.map((error) => error.message)).toEqual([
      "validation.conversation-attachments.format",
    ]);
  });

  it("keeps a failed file's error when a later file of the same attach mints the conversation", async () => {
    vi.stubGlobal("createImageBitmap", async () => ({ width: 1, height: 1, close() {} }));
    const { result, onConversationIdChange } = renderAttach({ image: "enabled", pdf: "enabled" }, async () => ({
      id: "a".repeat(64),
      mime: "image/png",
    }));
    const notAnImage = new File([new TextEncoder().encode("plain text")], "a.png", { type: "image/png" });

    await act(() => result.current.attach([notAnImage, new File([PNG], "b.png", { type: "image/png" })]));

    expect(onConversationIdChange).toHaveBeenCalledTimes(1);
    expect(result.current.feedback.errors.map((error) => error.message)).toEqual(["validation.attachments.format"]);
    vi.unstubAllGlobals();
  });
});
