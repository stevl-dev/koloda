import { describe, expect, it } from "vitest";
import type { AIModel } from "./models";
import { modelAcceptsImages, modelAcceptsPdf } from "./models";

describe.each([
  { fn: modelAcceptsImages, field: "has_image_input" as const },
  { fn: modelAcceptsPdf, field: "has_pdf_input" as const },
])("$fn.name", ({ fn, field }) => {
  function model(providerAnswer?: boolean): AIModel {
    return {
      id: "m",
      name: "m",
      context_length: 0,
      ...(providerAnswer === undefined ? {} : { [field]: providerAnswer }),
    };
  }

  it.each([
    { name: "provider says yes, list silent", providerAnswer: true, ids: undefined, expected: true },
    { name: "provider says no, though the list names it", providerAnswer: false, ids: ["m"], expected: false },
    { name: "unknown, and the list names it", providerAnswer: undefined, ids: ["m"], expected: true },
    { name: "unknown, and the list names another model", providerAnswer: undefined, ids: ["other"], expected: false },
    { name: "unknown, and no list", providerAnswer: undefined, ids: undefined, expected: false },
  ])("$name", ({ providerAnswer, ids, expected }) => {
    expect(fn(model(providerAnswer), ids)).toBe(expected);
  });
});
