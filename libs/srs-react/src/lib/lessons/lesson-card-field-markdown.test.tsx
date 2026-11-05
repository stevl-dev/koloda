import { queriesAtom } from "@koloda/core-react";
import type { Queries } from "@koloda/core-react";
import type { AttachmentContent } from "@koloda/srs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { createStore, Provider as JotaiProvider } from "jotai";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LessonCardFieldMarkdown } from "./lesson-card-field-markdown";
import type { FieldComponentProps } from "./lesson-card-field-types";

const IMAGE_ID = "2".repeat(64);

const image: AttachmentContent = {
  id: IMAGE_ID,
  mime: "image/png",
  size: 1,
  width: 10,
  height: 20,
  createdAt: new Date(0),
  bytes: new Uint8Array([1]),
};

const props: FieldComponentProps = {
  value: `![cat](attachment:${IMAGE_ID})`,
  operation: "display",
  fieldId: "field",
  fieldTitle: "Front",
  userValue: "",
  isSubmitted: false,
  isFirstInput: false,
  onFormChange: () => {},
  onSubmit: () => {},
};

describe("LessonCardFieldMarkdown", () => {
  beforeEach(() => {
    // WHY: jsdom implements neither object URL function.
    Object.assign(URL, { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: vi.fn() });
  });

  afterEach(() => {
    Reflect.deleteProperty(URL, "createObjectURL");
    Reflect.deleteProperty(URL, "revokeObjectURL");
  });

  it("keeps a loaded image when it re-renders with the same value", async () => {
    const store = createStore();
    store.set(queriesAtom, {
      getAttachmentQuery: (id: string) => ({
        queryKey: ["attachments", id],
        queryFn: async () => (id === IMAGE_ID ? image : null),
      }),
    } as unknown as Queries);
    const queryClient = new QueryClient();
    const wrap = (node: ReactNode) => (
      <QueryClientProvider client={queryClient}>
        <JotaiProvider store={store}>{node}</JotaiProvider>
      </QueryClientProvider>
    );

    const { container, rerender } = render(wrap(<LessonCardFieldMarkdown {...props} />));
    const img = await waitFor(() => {
      const loaded = container.querySelector("img");
      expect(loaded?.getAttribute("src")).toBe("blob:test");
      return loaded;
    });

    rerender(wrap(<LessonCardFieldMarkdown {...props} />));

    expect(container.querySelector("img")).toBe(img);
    expect(img?.getAttribute("src")).toBe("blob:test");
  });
});
