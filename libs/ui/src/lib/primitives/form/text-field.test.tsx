import { TextField } from "@koloda/ui";
import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

function mockTextAreaMetrics(textarea: HTMLTextAreaElement, scrollHeight: number) {
  Object.defineProperty(textarea, "scrollHeight", { configurable: true, get: () => scrollHeight });
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    borderBottomWidth: "0px",
    borderTopWidth: "0px",
    fontSize: "16px",
    lineHeight: "20px",
    maxHeight: "none",
    minHeight: "0px",
    paddingBottom: "8px",
    paddingTop: "8px",
  } as CSSStyleDeclaration);
}

describe("TextField", () => {
  it("grows the textarea height to match scrollHeight when under maxRows", () => {
    render(
      <TextField aria-label="Prompt">
        <TextField.TextArea canAutoResize maxRows={8} />
      </TextField>,
    );

    const textarea = screen.getByRole("textbox", { name: "Prompt" }) as HTMLTextAreaElement;
    mockTextAreaMetrics(textarea, 64);

    fireEvent.input(textarea, { target: { value: "short" } });

    expect(textarea.style.height).toBe("64px");
    expect(textarea.style.overflowY).toBe("hidden");
  });

  it("clamps auto-resize height to maxRows and enables overflow", () => {
    render(
      <TextField aria-label="Prompt">
        <TextField.TextArea canAutoResize maxRows={4} />
      </TextField>,
    );

    const textarea = screen.getByRole("textbox", { name: "Prompt" }) as HTMLTextAreaElement;
    // maxRows * lineHeight + paddingTop + paddingBottom + borders = 4*20 + 8 + 8 + 0
    mockTextAreaMetrics(textarea, 200);

    fireEvent.input(textarea, { target: { value: "line1\nline2\nline3\nline4\nline5" } });

    expect(textarea.style.height).toBe("96px");
    expect(textarea.style.overflowY).toBe("auto");
  });

  it("resizes when the parent field's value changes without typing", () => {
    const { rerender } = render(
      <TextField aria-label="Prompt" value="line1">
        <TextField.TextArea canAutoResize maxRows={8} />
      </TextField>,
    );
    const textarea = screen.getByRole("textbox", { name: "Prompt" }) as HTMLTextAreaElement;
    mockTextAreaMetrics(textarea, 64);

    rerender(
      <TextField aria-label="Prompt" value={"line1\nline2\nline3"}>
        <TextField.TextArea canAutoResize maxRows={8} />
      </TextField>,
    );

    expect(textarea.style.height).toBe("64px");
  });
});
