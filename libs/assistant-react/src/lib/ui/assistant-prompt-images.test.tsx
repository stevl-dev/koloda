import type { AIModel } from "@koloda/ai";
import { queriesAtom } from "@koloda/core-react";
import { msg } from "@lingui/core/macro";
import type { Queries } from "@koloda/core-react";
import { act, renderHook } from "@testing-library/react";
import { createStore, Provider as JotaiProvider } from "jotai";
import type { PropsWithChildren } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createQueryClient } from "../../test/test-helpers";
import { getImageInputState, useAssistantImageAttach } from "./assistant-prompt-images";

function model(hasImageInput?: boolean): AIModel {
  return {
    id: "m",
    name: "m",
    context_length: 0,
    ...(hasImageInput === undefined ? {} : { has_image_input: hasImageInput }),
  };
}

describe("getImageInputState", () => {
  it.each([
    { name: "no model selected", modelId: "", model: undefined, ids: undefined, expected: "hidden" },
    { name: "a model that accepts images", modelId: "m", model: model(true), ids: undefined, expected: "enabled" },
    { name: "a model that does not", modelId: "m", model: model(false), ids: ["m"], expected: "unsupported" },
    { name: "an unknown model, switch off", modelId: "m", model: model(), ids: undefined, expected: "unknown" },
    { name: "an unknown model, switch on", modelId: "m", model: model(), ids: ["m"], expected: "enabled" },
    { name: "a selected model missing from the list", modelId: "m", model: undefined, ids: [], expected: "unknown" },
  ] as const)("$name is $expected", ({ modelId, model: selected, ids, expected }) => {
    expect(getImageInputState(modelId, selected, { imageInputModelIds: ids ? [...ids] : undefined })).toBe(expected);
  });
});

describe("useAssistantImageAttach", () => {
  it("shows the reason and stores nothing when the model does not take images", async () => {
    const addImage = vi.fn();
    const store = createStore();
    store.set(queriesAtom, {
      addConversationAttachmentMutation: () => ({ mutationFn: addImage }),
    } as unknown as Queries);
    const queryClient = createQueryClient();
    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={queryClient}>
          <JotaiProvider store={store}>{children}</JotaiProvider>
        </QueryClientProvider>
      );
    }
    const { result } = renderHook(
      () => useAssistantImageAttach({ imageInput: "unsupported", onConversationIdChange: vi.fn() }),
      { wrapper: Wrapper },
    );

    await act(() => result.current.attach([new File([new Uint8Array([0x89])], "a.png", { type: "image/png" })]));

    expect(addImage).not.toHaveBeenCalled();
    expect(result.current.feedback.reason).toEqual(msg`ai.chat.images.unsupported`);
  });

  it("keeps a failed file's error when a later file of the same attach mints the conversation", async () => {
    vi.stubGlobal("createImageBitmap", async () => ({ width: 1, height: 1, close() {} }));
    const store = createStore();
    store.set(queriesAtom, {
      addConversationAttachmentMutation: () => ({
        mutationFn: async () => ({ id: "a".repeat(64), mime: "image/png" }),
      }),
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
    const { result } = renderHook(() => useAssistantImageAttach({ imageInput: "enabled", onConversationIdChange }), {
      wrapper: Wrapper,
    });
    const notAnImage = new File([new TextEncoder().encode("plain text")], "a.png", { type: "image/png" });
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "b.png", {
      type: "image/png",
    });

    await act(() => result.current.attach([notAnImage, png]));

    expect(onConversationIdChange).toHaveBeenCalledTimes(1);
    expect(result.current.feedback.errors.map((error) => error.message)).toEqual(["validation.attachments.format"]);
    vi.unstubAllGlobals();
  });
});
