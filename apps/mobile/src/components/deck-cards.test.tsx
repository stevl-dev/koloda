import { screen } from "@testing-library/react-native";
import { card, DECK_ID, renderWithQueries, returning, template } from "../test/cards";
import { DeckCards } from "./deck-cards";

describe("DeckCards", () => {
  it("shows each card's first two fields as plain text with an image as a symbol, with its state and, once graded, its due time", async () => {
    const cards = [
      card("c1", `# Capital\n\n**Paris** ![map](attachment:${"ab".repeat(32)})`, "**not** markdown"),
      card("c2", "Berlin", "Germany", { state: 2, dueAt: "2026-02-01T10:00:00.000Z" }),
    ];
    const getCards = returning(cards);
    await renderWithQueries(<DeckCards deckId={DECK_ID} />, { getCards, getTemplate: returning(template()) });

    expect(await screen.findByText("Capital Paris 🖼️")).toBeTruthy();
    expect(JSON.parse(getCards.mock.calls[0][0] as string)).toEqual({ deckId: DECK_ID });
    expect(screen.getByText("**not** markdown")).toBeTruthy();
    expect(screen.getByText("New")).toBeTruthy();
    expect(screen.getByText("Review")).toBeTruthy();
    expect(screen.getAllByText(/^Due /)).toHaveLength(1);
  });

  it("says when the deck has no cards", async () => {
    await renderWithQueries(<DeckCards deckId={DECK_ID} />, { getCards: returning([]) });

    expect(await screen.findByText("No cards in this deck yet.")).toBeTruthy();
  });
});
