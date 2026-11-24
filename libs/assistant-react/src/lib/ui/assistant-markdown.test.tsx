import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssistantAppLinksContext, AssistantMarkdown } from "./assistant-markdown";
import type { AssistantAppLinks } from "./assistant-markdown";

const LEARNING_LINK = "Open [Learning](koloda:settings/learning) settings.";

function renderWithAppLinks(text: string, appLinks: AssistantAppLinks) {
  return render(
    <AssistantAppLinksContext.Provider value={appLinks}>
      <AssistantMarkdown text={text} />
    </AssistantAppLinksContext.Provider>,
  );
}

describe("AssistantMarkdown", () => {
  it("renders headings and emphasis instead of markdown source", () => {
    render(<AssistantMarkdown text={"## Title\n\n**bold**"} />);

    expect(screen.getByRole("heading", { level: 2, name: "Title" })).toBeDefined();
    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.queryByText("## Title")).toBeNull();
  });

  it("does not throw on incomplete streamed markdown", () => {
    expect(() => render(<AssistantMarkdown text={"**bo"} />)).not.toThrow();
  });
});

describe("AssistantMarkdown app links", () => {
  it("opens the parsed target on a primary click instead of following the href", () => {
    const open = vi.fn();
    renderWithAppLinks(LEARNING_LINK, { href: () => "#/settings/learning", open });
    const link = screen.getByRole("link", { name: "Learning" });

    const isNotPrevented = fireEvent.click(link, { button: 0 });

    expect(isNotPrevented).toBe(false);
    expect(open).toHaveBeenCalledWith({ kind: "screen", screen: "settings/learning" });
  });

  it.each([
    ["ctrl", { ctrlKey: true }],
    ["meta", { metaKey: true }],
    ["shift", { shiftKey: true }],
  ])("leaves a %s-click to the browser", (_case, modifier) => {
    const open = vi.fn();
    renderWithAppLinks(LEARNING_LINK, { href: () => "#/settings/learning", open });

    const isNotPrevented = fireEvent.click(screen.getByRole("link", { name: "Learning" }), { button: 0, ...modifier });

    expect(isNotPrevented).toBe(true);
    expect(open).not.toHaveBeenCalled();
  });

  it("shows a link the host cannot open as text", () => {
    renderWithAppLinks("[Sync](koloda:settings/sync)", { href: () => null, open: vi.fn() });

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Sync")).toBeDefined();
  });

  it("shows a target outside the closed set as text without asking the host", () => {
    const href = vi.fn(() => "#/elsewhere");
    renderWithAppLinks("[Elsewhere](koloda:settings/sounds)", { href, open: vi.fn() });

    expect(screen.queryByRole("link")).toBeNull();
    expect(href).not.toHaveBeenCalled();
  });

  it("shows app links as text without a host", () => {
    render(<AssistantMarkdown text={LEARNING_LINK} />);

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(/Learning/)).toBeDefined();
  });
});
