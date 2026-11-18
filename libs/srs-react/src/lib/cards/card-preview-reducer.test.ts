import { SEED_TEMPLATE_TYPE_BACK_FIELD_ID } from "@koloda/app";
import { describe, expect, it } from "vitest";
import { createCard, createTemplate } from "../../test/test-helpers";
import { cardPreviewReducer, cardPreviewReducerDefault } from "./card-preview-reducer";

type CardPreviewAction = Parameters<typeof cardPreviewReducer>[1];

function reducePreview(actions: CardPreviewAction[]) {
  return actions.reduce(
    (state, action) => cardPreviewReducer(state, action),
    structuredClone(cardPreviewReducerDefault),
  );
}

describe("cardPreviewReducer", () => {
  it("builds lesson-style preview content once both card and template are available", () => {
    const card = createCard();
    const template = createTemplate();
    const state = reducePreview([
      ["templateUpdated", template],
      ["cardUpdated", card],
    ]);

    expect(state.content?.card).toEqual(card);
    expect(state.content?.template.layout[0]?.field?.title).toBe("Front");
    expect(state.content?.form.firstInputFieldId).toBe(SEED_TEMPLATE_TYPE_BACK_FIELD_ID);
    expect(state.content?.form.isSubmitted).toBe(false);
  });

  it("tracks preview form changes and submission", () => {
    let state = reducePreview([
      ["templateUpdated", createTemplate()],
      ["cardUpdated", createCard()],
    ]);

    state = cardPreviewReducer(state, [
      "cardFormUpdated",
      { key: SEED_TEMPLATE_TYPE_BACK_FIELD_ID, value: "typed preview" },
    ]);
    state = cardPreviewReducer(state, ["cardSubmitted"]);

    expect(state.content?.form.data[SEED_TEMPLATE_TYPE_BACK_FIELD_ID]).toBe("typed preview");
    expect(state.content?.form.isSubmitted).toBe(true);
  });
});
