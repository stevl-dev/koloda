import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { BACK, card, DECK, DECK_ID, FRONT, renderWithQueries, returning, TEMPLATE_ID, template } from "../test/cards";
import { AddCard } from "./add-card";

async function renderAdd(addCard = returning(card("c1", "Paris", "France"))) {
  await renderWithQueries(<AddCard deck={DECK} />, { getTemplate: returning(template()), addCard });
  await screen.findByLabelText("Front");
  return { addCard };
}

describe("AddCard", () => {
  it("adds a card with the deck's template, then clears the form for the next one", async () => {
    const { addCard } = await renderAdd();

    await fireEvent.changeText(screen.getByLabelText("Front"), "Paris");
    await fireEvent.changeText(screen.getByLabelText("Back"), "France");
    await fireEvent.press(screen.getByRole("button", { name: "Add a card" }));

    expect(await screen.findByText("Cards added: 1")).toBeTruthy();
    expect(JSON.parse(addCard.mock.calls[0][0] as string)).toEqual({
      deckId: DECK_ID,
      templateId: TEMPLATE_ID,
      content: { [FRONT]: { text: "Paris" }, [BACK]: { text: "France" } },
    });
    await waitFor(() => expect(screen.getByLabelText("Front").props.value).toBe(""));
    expect(screen.getByLabelText("Back").props.value).toBe("");
  });

  it("refuses a blank required field without adding, and keeps the draft", async () => {
    const { addCard } = await renderAdd();

    await fireEvent.changeText(screen.getByLabelText("Back"), "France");
    await fireEvent.press(screen.getByRole("button", { name: "Add a card" }));

    expect(await screen.findByText("This field can't be empty")).toBeTruthy();
    expect(addCard).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Back").props.value).toBe("France");
  });
});
