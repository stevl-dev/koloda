import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createAppStoreWrapper } from "../test/test-helpers";
import { AIChatPromptInput } from "./ai-chat-prompt-input";

vi.mock("@lingui/react", () => ({
  useLingui: () => ({
    _: (message: { toString(): string }) => message.toString(),
  }),
}));

function placeCaretAtEnd(input: HTMLElement) {
  input.focus();
  const range = document.createRange();
  range.selectNodeContents(input);
  range.collapse(false);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
}

function fireInput(input: HTMLElement, inputType: string, data?: string) {
  placeCaretAtEnd(input);
  const event = new InputEvent("beforeinput", { inputType, data, bubbles: true, cancelable: true });
  // WORKAROUND: jsdom's InputEvent has no `getTargetRanges`; an empty list makes RAC read the window selection.
  Object.assign(event, { getTargetRanges: () => [] });
  act(() => {
    input.dispatchEvent(event);
  });
}

function renderInput(value: string) {
  const onChange = vi.fn();
  const onSubmit = vi.fn();
  const view = render(<AIChatPromptInput value={value} onChange={onChange} onSubmit={onSubmit} />, {
    wrapper: createAppStoreWrapper(),
  });
  const input = screen.getByRole("textbox", { name: "ai.chat.input.label" });
  return { ...view, input, onChange, onSubmit };
}

describe("AIChatPromptInput", () => {
  it("submits on Enter without changing the text", () => {
    const { input, onChange, onSubmit } = renderInput("Make cards");

    fireInput(input, "insertParagraph");

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("inserts a newline on Shift+Enter instead of submitting", () => {
    const { input, onChange, onSubmit } = renderInput("Make cards");

    fireInput(input, "insertLineBreak");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith("Make cards\n");
  });

  it("shows text the parent sets, such as a reverted prompt", () => {
    const { input, rerender, onChange, onSubmit } = renderInput("Make cards");

    rerender(<AIChatPromptInput value="Earlier prompt" onChange={onChange} onSubmit={onSubmit} />);

    expect(input.textContent).toBe("Earlier prompt");
  });

  it("keeps typed text while the parent has not echoed it yet", () => {
    const { input, onChange } = renderInput("Make");

    fireInput(input, "insertText", "s");

    expect(onChange).toHaveBeenLastCalledWith("Makes");
    expect(input.textContent).toBe("Makes");
  });
});
