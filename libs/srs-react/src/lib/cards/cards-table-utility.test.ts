import type { Template } from "@koloda/srs";
import { describe, expect, it } from "vitest";
import { getCardsTableContentColumns } from "./cards-table-utility";

function uuid(n: number) {
  return `01900000-0000-7000-8000-${n.toString(16).padStart(12, "0")}`;
}

// WHY: field ids come from the template number, so two templates never share a field id
// and a lookup that ignores its template resolves the wrong one.
function createTemplate(n: number, fields: Array<{ title: string }>): Template {
  return {
    id: uuid(n),
    title: `Template ${n}`,
    content: {
      fields: fields.map((f, i) => ({
        id: uuid(n * 100 + i + 1),
        title: f.title,
        type: "text" as const,
        isRequired: true,
      })),
      layout: [],
    },
    isLocked: false,
    createdAt: new Date(),
    updatedAt: null,
  };
}

describe("getCardsTableContentColumns", () => {
  it.each([
    { case: "no templates", templates: [], headers: [] },
    {
      case: "one template",
      templates: [createTemplate(1, [{ title: "Front" }, { title: "Back" }])],
      headers: ["Front", "Back"],
    },
    {
      case: "templates sharing each title",
      templates: [
        createTemplate(1, [{ title: "Front" }, { title: "Back" }]),
        createTemplate(2, [{ title: "Front" }, { title: "Back" }]),
      ],
      headers: ["Front", "Back"],
    },
    {
      case: "templates with different titles at a position",
      templates: [
        createTemplate(1, [{ title: "Front" }, { title: "Back" }]),
        createTemplate(2, [{ title: "Question" }, { title: "Answer" }]),
      ],
      headers: ["#1", "#2"],
    },
    {
      case: "templates of different lengths",
      templates: [
        createTemplate(1, [{ title: "Front" }]),
        createTemplate(2, [{ title: "A" }, { title: "B" }, { title: "C" }]),
      ],
      headers: ["#1", "B", "C"],
    },
  ])("names the columns for $case", ({ templates, headers }) => {
    expect(getCardsTableContentColumns(templates).map((column) => column.header)).toEqual(headers);
  });
});
