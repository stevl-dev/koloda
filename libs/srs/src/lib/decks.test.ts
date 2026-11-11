import { describe, expect, it } from "vitest";
import { deckValidation } from "./decks";

const ID = "01900000-0000-7000-8000-000000000001";

function validDeck() {
  return { id: ID, title: "German", algorithmId: ID, templateId: ID };
}

// Twin of `crates/koloda/tests/domain/decks_validation_tests.rs`: both sides report the
// dedicated `validation.decks.*` codes before any existence check runs.
describe("deckValidation references", () => {
  it("accepts well-formed uuid references", () => {
    expect(deckValidation.safeParse(validDeck()).success).toBe(true);
  });

  // WHY: Zod 4 `z.uuid()` accepts the nil and max literals, though neither has a version nibble.
  it("accepts the nil and max uuid literals", () => {
    const payload = {
      ...validDeck(),
      algorithmId: "00000000-0000-0000-0000-000000000000",
      templateId: "ffffffff-ffff-ffff-ffff-ffffffffffff",
    };
    expect(deckValidation.safeParse(payload).success).toBe(true);
  });

  it.each([
    {
      name: "malformed algorithmId",
      payload: { ...validDeck(), algorithmId: "not-a-uuid" },
      code: "validation.decks.algorithm",
    },
    {
      name: "non-uuid templateId",
      payload: { ...validDeck(), templateId: "simple" },
      code: "validation.decks.template",
    },
    {
      name: "hyphenless algorithmId",
      payload: { ...validDeck(), algorithmId: "01900000000070008000000000000001" },
      code: "validation.decks.algorithm",
    },
    { name: "empty templateId", payload: { ...validDeck(), templateId: "" }, code: "validation.decks.template" },
    {
      name: "version-0 algorithmId",
      payload: { ...validDeck(), algorithmId: "01a08376-dc00-0001-8000-000000000100" },
      code: "validation.decks.algorithm",
    },
    {
      name: "variant-0 templateId",
      payload: { ...validDeck(), templateId: "01a08376-dc00-7001-0000-000000000100" },
      code: "validation.decks.template",
    },
  ])("rejects $name with its code", ({ payload, code }) => {
    const result = deckValidation.safeParse(payload);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([code]);
  });
});
