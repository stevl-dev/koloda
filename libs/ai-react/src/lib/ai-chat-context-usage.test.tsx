import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createAppStoreWrapper } from "../test/test-helpers";
import { AIChatContextUsage } from "./ai-chat-context-usage";

vi.mock("@lingui/react", () => ({
  useLingui: () => ({
    _: (message: { toString(): string }) => message.toString(),
  }),
}));

function renderUsage(totalTokens: number, contextLength: number) {
  return render(
    <AIChatContextUsage
      usage={{ promptTokens: totalTokens, completionTokens: 0, totalTokens }}
      contextLength={contextLength}
    />,
    { wrapper: createAppStoreWrapper() },
  );
}

async function openUsageTooltip() {
  const trigger = screen.getByRole("button");
  trigger.focus();
  fireEvent.focus(trigger);
  return (await screen.findByRole("tooltip")).textContent;
}

describe("AIChatContextUsage", () => {
  it("shows usage past the context window as 100%", async () => {
    renderUsage(1500, 1000);

    expect(await openUsageTooltip()).toContain("100.0%");
  });

  it("treats a context length of 0 as unknown: tokens only, and an empty ring", async () => {
    const { container } = renderUsage(1500, 0);

    expect(await openUsageTooltip()).not.toContain("%");
    expect(container.querySelectorAll("circle")[1]?.getAttribute("stroke-dashoffset")).toBe("100");
  });
});
