import { Button, Tooltip } from "@koloda/ui";
import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

async function openTooltipOnFocus(name: string) {
  const trigger = screen.getByRole("button", { name });
  trigger.focus();
  fireEvent.focus(trigger);
  return screen.findByRole("tooltip");
}

describe("Tooltip", () => {
  it("opens on focus and closes on blur", async () => {
    render(
      <div>
        <Tooltip content="Focused tip" delay={0} closeDelay={0}>
          <Button>Hint</Button>
        </Tooltip>
        <Button>Away</Button>
      </div>,
    );

    const trigger = screen.getByRole("button", { name: "Hint" });
    expect((await openTooltipOnFocus("Hint")).textContent).toContain("Focused tip");

    screen.getByRole("button", { name: "Away" }).focus();
    fireEvent.blur(trigger);

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("renders content when controlled open", () => {
    render(
      <Tooltip content="Open tip" isOpen delay={0} closeDelay={0}>
        <Button>Hint</Button>
      </Tooltip>,
    );

    expect(screen.getByRole("tooltip").textContent).toContain("Open tip");
  });

  it("closes on Escape while open", async () => {
    render(
      <Tooltip content="More info" delay={0} closeDelay={0}>
        <Button>Help</Button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "Help" });
    expect((await openTooltipOnFocus("Help")).textContent).toContain("More info");

    fireEvent.keyDown(trigger, { key: "Escape" });

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("runs the trigger's own key handler and lets the key reach app hotkeys", () => {
    const onKeyDown = vi.fn();
    const onDocumentKeyDown = vi.fn();
    document.addEventListener("keydown", onDocumentKeyDown);
    render(
      <Tooltip content="Save tip" delay={0} closeDelay={0}>
        <Button onKeyDown={onKeyDown}>Save</Button>
      </Tooltip>,
    );

    fireEvent.keyDown(screen.getByRole("button", { name: "Save" }), { key: "s", ctrlKey: true });
    document.removeEventListener("keydown", onDocumentKeyDown);

    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onDocumentKeyDown).toHaveBeenCalledTimes(1);
  });

  it("supports Tooltip.Trigger as the focusable child", async () => {
    render(
      <Tooltip content="Compound tip" delay={0} closeDelay={0}>
        <Tooltip.Trigger>Compound</Tooltip.Trigger>
      </Tooltip>,
    );

    expect((await openTooltipOnFocus("Compound")).textContent).toContain("Compound tip");
  });
});
