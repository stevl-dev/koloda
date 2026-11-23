import { describe, expect, it } from "vitest";
import type { AIModel } from "./models";
import { modelAcceptsImages } from "./models";

function model(hasImageInput?: boolean): AIModel {
  return {
    id: "m",
    name: "m",
    context_length: 0,
    ...(hasImageInput === undefined ? {} : { has_image_input: hasImageInput }),
  };
}

describe("modelAcceptsImages", () => {
  it.each([
    { name: "provider says yes, list silent", hasImageInput: true, ids: undefined, expected: true },
    { name: "provider says no, though the list names it", hasImageInput: false, ids: ["m"], expected: false },
    { name: "unknown, and the list names it", hasImageInput: undefined, ids: ["m"], expected: true },
    { name: "unknown, and the list names another model", hasImageInput: undefined, ids: ["other"], expected: false },
    { name: "unknown, and no list", hasImageInput: undefined, ids: undefined, expected: false },
  ])("$name", ({ hasImageInput, ids, expected }) => {
    expect(modelAcceptsImages(model(hasImageInput), ids)).toBe(expected);
  });
});
