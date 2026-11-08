import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { NumberField } from "./number-field";

// WORKAROUND: NumberFlow (the display layer) calls custom-element methods jsdom lacks on every update.
vi.mock("@number-flow/react", async () => {
  const { createElement } = await import("react");
  return {
    default: ({ value, className }: { value?: unknown; className?: string }) =>
      createElement("span", { "data-testid": "display", className }, String(value)),
  };
});

function Controlled({ onChange }: { onChange: (value: number) => void }) {
  const [value, setValue] = useState(5);

  return (
    <NumberField
      aria-label="Steps"
      minValue={1}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    >
      <NumberField.Group />
    </NumberField>
  );
}

describe("NumberField", () => {
  it("commits a cleared field as NaN when it loses focus, not its minValue, and shows no number", () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const input = screen.getByRole("textbox", { name: "Steps" }) as HTMLInputElement;

    input.focus();
    fireEvent.change(input, { target: { value: "" } });
    input.blur();

    expect(onChange.mock.calls.map(([value]) => value)).toEqual([Number.NaN]);
    expect(input.value).toBe("");
    expect(screen.getByTestId("display").className).toContain("invisible");
  });
});
