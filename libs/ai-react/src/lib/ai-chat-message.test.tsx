import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AIChatMessage } from "./ai-chat-message";

describe("AIChatMessage", () => {
  it("renders text parts and skips step-start parts", () => {
    const { container } = render(
      <AIChatMessage
        role="assistant"
        parts={[{ type: "step-start" } as never, { type: "text", text: "Hello world" }]}
      />,
    );
    expect(container.textContent).toBe("Hello world");
  });

  it("does not render reasoning parts as message text", () => {
    render(
      <AIChatMessage
        role="assistant"
        parts={[
          { type: "text", text: "Visible answer." },
          { type: "reasoning", text: "Quiet plan." },
        ]}
      />,
    );
    expect(screen.getByText("Visible answer.")).toBeDefined();
    expect(screen.queryByText("Quiet plan.")).toBeNull();
  });

  it("uses renderText for assistant text parts", () => {
    render(
      <AIChatMessage
        role="assistant"
        renderText={(text) => <div data-testid="custom-text">{text}</div>}
        parts={[{ type: "text", text: "**hi**" }]}
      />,
    );
    expect(screen.getByTestId("custom-text").textContent).toBe("**hi**");
  });

  it("keeps user text as a paragraph when renderText is passed", () => {
    render(
      <AIChatMessage
        role="user"
        renderText={(text) => <div data-testid="custom-text">{text}</div>}
        parts={[{ type: "text", text: "**hi**" }]}
      />,
    );
    expect(screen.queryByTestId("custom-text")).toBeNull();
    expect(screen.getByText("**hi**").tagName).toBe("P");
  });

  it("shows a mention in a user message as its title, not its token", () => {
    const { container } = render(
      <AIChatMessage
        role="user"
        parts={[{ type: "text", text: "Quiz me on @[Spanish verbs](deck:0b9e3c1a-6f2d-4e8b-9a71-3c5d2e8f1a40) today" }]}
      />,
    );
    expect(container.textContent).toBe("Quiz me on Spanish verbs today");
    expect(screen.getByText("Spanish verbs").tagName).toBe("SPAN");
  });

  it("leaves mention syntax in assistant text to the text renderer", () => {
    const text = "See @[Spanish verbs](deck:0b9e3c1a-6f2d-4e8b-9a71-3c5d2e8f1a40)";
    render(
      <AIChatMessage
        role="assistant"
        renderText={(value) => <div data-testid="custom-text">{value}</div>}
        parts={[{ type: "text", text }]}
      />,
    );
    expect(screen.getByTestId("custom-text").textContent).toBe(text);
  });
});
