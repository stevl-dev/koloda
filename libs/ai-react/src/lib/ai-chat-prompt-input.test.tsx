import type { Mention } from "@koloda/ai";
import { useAppHotkey } from "@koloda/core-react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createAppStoreWrapper } from "../test/test-helpers";
import { AIChatPromptInput } from "./ai-chat-prompt-input";

vi.mock("@lingui/react", () => ({
  useLingui: () => ({
    _: (message: { toString(): string }) => message.toString(),
    i18n: { locale: "en" },
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

const deckId = "0b9e3c1a-6f2d-4e8b-9a71-3c5d2e8f1a40";
const mentions: Mention[] = [
  { kind: "template", id: "6d1f0a52-2b8e-4c3a-9f17-5e4b3a2c1d00", title: "Vocabulary" },
  { kind: "deck", id: deckId, title: "Spanish verbs" },
  { kind: "algorithm", id: "9c2e7b14-0d3f-4a6b-8e51-7f6a5b4c3d00", title: "Intensive" },
];

function renderInput(value: string) {
  const onChange = vi.fn();
  const onSubmit = vi.fn();
  const view = render(<AIChatPromptInput value={value} onChange={onChange} onSubmit={onSubmit} mentions={mentions} />, {
    wrapper: createAppStoreWrapper(),
  });
  const input = screen.getByRole("textbox", { name: "ai.chat.input.label" });
  return { ...view, input, onChange, onSubmit };
}

type HotkeyProbeProps = { onSingleKey: () => void; onChord: () => void };

function HotkeyProbe({ onSingleKey, onChord }: HotkeyProbeProps) {
  useAppHotkey(["D"], onSingleKey, "");
  useAppHotkey(["Mod+E"], onChord, "", { ignoreInputs: false });
  return null;
}

function renderWithHotkeys() {
  const onSingleKey = vi.fn();
  const onChord = vi.fn();
  render(
    <>
      <HotkeyProbe onSingleKey={onSingleKey} onChord={onChord} />
      <AIChatPromptInput value="" onChange={vi.fn()} onSubmit={vi.fn()} mentions={mentions} />
    </>,
    { wrapper: createAppStoreWrapper() },
  );
  const input = screen.getByRole("textbox", { name: "ai.chat.input.label" });
  return { input, onSingleKey, onChord };
}

type ListHotkeyProbeProps = { onFocusNext: () => void; onClose: () => void };

function ListHotkeyProbe({ onFocusNext, onClose }: ListHotkeyProbeProps) {
  useAppHotkey(["Alt+J"], onFocusNext, "", { ignoreInputs: false });
  useAppHotkey(["Alt+C"], onClose, "", { ignoreInputs: false });
  return null;
}

function renderWithListHotkeys() {
  const onChange = vi.fn();
  const onFocusNext = vi.fn();
  const onClose = vi.fn();
  render(
    <>
      <ListHotkeyProbe onFocusNext={onFocusNext} onClose={onClose} />
      <AIChatPromptInput value="" onChange={onChange} onSubmit={vi.fn()} mentions={mentions} />
    </>,
    { wrapper: createAppStoreWrapper() },
  );
  const input = screen.getByRole("textbox", { name: "ai.chat.input.label" });
  return { input, onChange, onFocusNext, onClose };
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

  it("lists every mention source by title after @, and filters by the text after it", () => {
    const { input } = renderInput("Quiz me on");

    fireInput(input, "insertText", " @");
    const menu = screen.getByRole("menu", { name: "ai.chat.mention.list.label" });
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Intensiveai.chat.mention.kind.algorithm",
      "Spanish verbsai.chat.mention.kind.deck",
      "Vocabularyai.chat.mention.kind.template",
    ]);

    fireInput(input, "insertText", "VER");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["Spanish verbsai.chat.mention.kind.deck"]);
  });

  it("does not open the list for an @ inside a word", () => {
    const { input } = renderInput("mail me");

    fireInput(input, "insertText", "@");

    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes the list when nothing matches", () => {
    const { input } = renderInput("");

    fireInput(input, "insertText", "@zzz");

    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("replaces @ and the filter with the picked mention's token", () => {
    const { input, onChange } = renderInput("Quiz me on ");

    fireInput(input, "insertText", "@spa");
    fireEvent.click(screen.getByRole("menuitem", { name: /Spanish verbs/ }));

    expect(onChange).toHaveBeenLastCalledWith(`Quiz me on @[Spanish verbs](deck:${deckId}) `);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("picks the first match on Enter and keeps the Enter from submitting", () => {
    const { input, onChange } = renderInput("");

    fireInput(input, "insertText", "@in");
    expect(input.hasAttribute("aria-activedescendant")).toBe(false);
    // WHY: a prevented keydown fires no `beforeinput`, so the browser never sends the Enter to `onSubmit`.
    const isEnterLeftToBrowser = fireEvent.keyDown(input, { key: "Enter" });

    expect(isEnterLeftToBrowser).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith(`@[Intensive](algorithm:${mentions[2].id}) `);
  });

  it("picks the highlighted match on Enter", () => {
    const { input, onChange } = renderInput("");

    fireInput(input, "insertText", "@");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const isEnterLeftToBrowser = fireEvent.keyDown(input, { key: "Enter" });

    expect(isEnterLeftToBrowser).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith(`@[Spanish verbs](deck:${deckId}) `);
  });

  it("closes the list on Escape until a new @ is typed", () => {
    const { input } = renderInput("");

    fireInput(input, "insertText", "@");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();

    fireInput(input, "insertText", "s");
    expect(screen.queryByRole("menu")).toBeNull();

    fireInput(input, "insertText", " @");
    expect(screen.getByRole("menu")).toBeTruthy();
  });

  it("opens the list for an @ typed again where a dismissed one was deleted", () => {
    const { input } = renderInput("");

    fireInput(input, "insertText", "@");
    fireEvent.keyDown(input, { key: "Escape" });
    fireInput(input, "deleteContentBackward");
    fireInput(input, "insertText", "@");

    expect(screen.getByRole("menu")).toBeTruthy();
  });

  it("shows a stored mention as a chip with its title", () => {
    const { input } = renderInput(`Quiz me on @[Spanish verbs](deck:${deckId})`);

    expect(input.textContent).toBe("Quiz me on \u200bSpanish verbs\u200b");
  });

  it("lets a chord hotkey fire while typing in the prompt", () => {
    const { input, onChord } = renderWithHotkeys();

    // WHY: jsdom reports a non-Mac platform, so `Mod` is Control.
    fireEvent.keyDown(input, { key: "e", code: "KeyE", ctrlKey: true });
    expect(onChord).toHaveBeenCalledTimes(1);
  });

  it("keeps keys typed while the list is open from single-key hotkeys", () => {
    const { input, onSingleKey } = renderWithHotkeys();

    fireInput(input, "insertText", "@");
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.keyDown(input, { key: "d", code: "KeyD" });

    expect(onSingleKey).not.toHaveBeenCalled();
  });

  it("moves the highlight with Focus forward and backward, and keeps those keys from the app", () => {
    const { input, onChange, onFocusNext } = renderWithListHotkeys();

    fireInput(input, "insertText", "@");
    const isKeyLeftToBrowser = fireEvent.keyDown(input, { key: "j", code: "KeyJ", altKey: true });
    fireEvent.keyDown(input, { key: "j", code: "KeyJ", altKey: true });
    fireEvent.keyDown(input, { key: "j", code: "KeyJ", altKey: true });
    fireEvent.keyDown(input, { key: "k", code: "KeyK", altKey: true });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(isKeyLeftToBrowser).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith(`@[Spanish verbs](deck:${deckId}) `);
    expect(onFocusNext).not.toHaveBeenCalled();
  });

  it("closes the list with Close popover and keeps the key from the app", () => {
    const { input, onClose } = renderWithListHotkeys();

    fireInput(input, "insertText", "@");
    fireEvent.keyDown(input, { key: "c", code: "KeyC", altKey: true });

    expect(screen.queryByRole("menu")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("types a letter Focus forward is bound to instead of moving the highlight", () => {
    render(<AIChatPromptInput value="" onChange={vi.fn()} onSubmit={vi.fn()} mentions={mentions} />, {
      wrapper: createAppStoreWrapper({ hotkeys: { ui: { focusNext: ["J"] } } }),
    });
    const input = screen.getByRole("textbox", { name: "ai.chat.input.label" });

    fireInput(input, "insertText", "@");
    const isKeyLeftToBrowser = fireEvent.keyDown(input, { key: "j", code: "KeyJ" });

    expect(isKeyLeftToBrowser).toBe(true);
    expect(input.hasAttribute("aria-activedescendant")).toBe(false);
  });
});
