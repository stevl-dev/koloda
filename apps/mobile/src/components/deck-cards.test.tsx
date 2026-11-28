import { fireEvent, screen } from "@testing-library/react-native";
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
    // WHY: the state filter names every state once; a second copy is the row's.
    expect(screen.getAllByText("New")).toHaveLength(2);
    expect(screen.getAllByText("Review")).toHaveLength(2);
    expect(screen.getAllByText("Learning")).toHaveLength(1);
    expect(screen.getAllByText(/^Due /)).toHaveLength(1);
  });

  it("says when the deck has no cards", async () => {
    await renderWithQueries(<DeckCards deckId={DECK_ID} />, { getCards: returning([]) });

    expect(await screen.findByText("No cards in this deck yet.")).toBeTruthy();
  });

  describe("search and the state filter", () => {
    const cards = [
      card("c1", "# Capital\n\n**Paris**", "France"),
      card("c2", "Berlin", "**Germany**", { state: 2, dueAt: "2026-02-01T10:00:00.000Z" }),
      card("c3", "Rome", "Italy", { state: 1, dueAt: "2026-02-01T10:00:00.000Z" }),
    ];

    async function renderSearchable() {
      await renderWithQueries(<DeckCards deckId={DECK_ID} />, {
        getCards: returning(cards),
        getTemplate: returning(template()),
      });
      await screen.findByText("Capital Paris");
    }

    it("finds a markdown field by the text it shows, not by its marks, ignoring case", async () => {
      await renderSearchable();

      await fireEvent.changeText(screen.getByLabelText("Search cards"), "capital PARIS");
      expect(screen.getByText("Capital Paris")).toBeTruthy();
      expect(screen.queryByText("Berlin")).toBeNull();

      await fireEvent.changeText(screen.getByLabelText("Search cards"), "**");
      expect(screen.getByText("**Germany**")).toBeTruthy();
      expect(screen.queryByText("Capital Paris")).toBeNull();
      expect(screen.queryByText("Rome")).toBeNull();
    });

    it("shows the cards in any chosen state, and all of them with none chosen", async () => {
      await renderSearchable();

      await fireEvent.press(screen.getByRole("checkbox", { name: "Review" }));
      await fireEvent.press(screen.getByRole("checkbox", { name: "Learning" }));
      expect(screen.queryByText("Capital Paris")).toBeNull();
      expect(screen.getByText("Berlin")).toBeTruthy();
      expect(screen.getByText("Rome")).toBeTruthy();

      await fireEvent.press(screen.getByRole("checkbox", { name: "Review" }));
      await fireEvent.press(screen.getByRole("checkbox", { name: "Learning" }));
      expect(screen.getByText("Capital Paris")).toBeTruthy();
    });

    it("applies the search and the filter together, and says when nothing matches", async () => {
      await renderSearchable();

      await fireEvent.press(screen.getByRole("checkbox", { name: "Review" }));
      await fireEvent.changeText(screen.getByLabelText("Search cards"), "rome");
      expect(screen.queryByText("Rome")).toBeNull();
      expect(screen.getByText("No cards match.")).toBeTruthy();
    });
  });
});
