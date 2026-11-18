import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { testId } from "../../test/test-helpers";
import { LessonCardFieldText } from "./lesson-card-field-text";

function renderTypeField({ value = "", userValue = "", isSubmitted = false, onSubmit = vi.fn() }) {
  render(
    <LessonCardFieldText
      value={value}
      operation="type"
      fieldId={testId(11)}
      fieldTitle="Answer"
      userValue={userValue}
      isSubmitted={isSubmitted}
      isFirstInput
      onFormChange={() => {}}
      onSubmit={onSubmit}
    />,
  );
}

// WHY: the default normalizer trims and collapses whitespace, which is the rule under test.
const asWritten = { normalizer: (text: string) => text };

describe("LessonCardFieldText", () => {
  it.each([
    { userValue: "paris", value: "Paris", isMatch: true },
    { userValue: "  PARIS \n", value: "Paris", isMatch: true },
    { userValue: "Paris", value: " Paris\n", isMatch: true },
    { userValue: "Lyon", value: "Paris", isMatch: false },
    { userValue: "Pari", value: "Paris", isMatch: false },
    { userValue: "Pa ris", value: "Paris", isMatch: false },
  ])("compares $userValue to $value ignoring outer whitespace and case: match $isMatch", (row) => {
    renderTypeField({ value: row.value, userValue: row.userValue, isSubmitted: true });

    expect(screen.getByText(row.userValue, asWritten)).toBeTruthy();
    expect(screen.queryByText(row.value, asWritten) !== null).toBe(!row.isMatch);
  });

  it("submits on a bare Enter and not on Shift+Enter", () => {
    const onSubmit = vi.fn();
    renderTypeField({ onSubmit });
    const input = screen.getByLabelText("Answer");

    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
