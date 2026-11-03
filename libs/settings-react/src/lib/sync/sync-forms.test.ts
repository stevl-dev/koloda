import { describe, expect, it } from "vitest";
import { createSpaceSchema } from "./sync-forms";

function spaceNameIssues(spaceName: string) {
  const result = createSpaceSchema.safeParse({
    serverUrl: "https://s.test",
    setupToken: "t",
    spaceName,
    deviceName: "Laptop",
  });
  return result.success
    ? []
    : result.error.issues.map((issue) => ({
        message: issue.message,
        maximum: "maximum" in issue ? issue.maximum : undefined,
      }));
}

// WHY: the error catalog renders the limit from `maximum`; without it the message reads "NaN characters".
const TOO_LONG = { message: "validation.sync.name.too-long", maximum: 100 };

describe("sync name rule", () => {
  it.each([
    ["100 characters outside the BMP", "😀".repeat(100), []],
    ["101 characters outside the BMP", "😀".repeat(101), [TOO_LONG]],
    ["100 plain characters", "a".repeat(100), []],
    ["101 plain characters", "a".repeat(101), [TOO_LONG]],
  ])("counts characters as the server does: %s", (_case, name, issues) => {
    expect(spaceNameIssues(name)).toEqual(issues);
  });
});
