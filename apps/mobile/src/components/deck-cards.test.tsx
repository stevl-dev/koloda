import type { Card } from "@koloda/srs";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { useState } from "react";
import { Alert } from "react-native";
import { card, DECK, DECK_ID, renderWithQueries, returning, template } from "../test/cards";
import { DeckCards } from "./deck-cards";

type DeckCardsHostProps = {
  onOpenCard?: (cardId: Card["id"]) => void;
  onAdd?: () => void;
};

// WHY: the route owns the selection; this host holds it as the route does.
function DeckCardsHost({ onOpenCard = jest.fn(), onAdd = jest.fn() }: DeckCardsHostProps) {
  const [selection, setSelection] = useState<Card["id"][] | null>(null);
  return (
    <DeckCards
      deck={DECK}
      onOpenCard={onOpenCard}
      onAdd={onAdd}
      selection={selection}
      onSelectionChange={setSelection}
    />
  );
}

describe("DeckCards", () => {
  it("shows each card's first two fields as plain text with an image as a symbol, with its state and, once graded, its due time", async () => {
    const cards = [
      card("c1", `# Capital\n\n**Paris** ![map](attachment:${"ab".repeat(32)})`, "**not** markdown"),
      card("c2", "Berlin", "Germany", { state: 2, dueAt: "2026-02-01T10:00:00.000Z" }),
    ];
    const getCards = returning(cards);
    await renderWithQueries(<DeckCardsHost />, {
      getCards,
      getTemplate: returning(template()),
    });

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
    await renderWithQueries(<DeckCardsHost />, {
      getCards: returning([]),
      getTemplate: returning(template()),
    });

    expect(await screen.findByText("No cards in this deck yet.")).toBeTruthy();
  });

  describe("search and the state filter", () => {
    const cards = [
      card("c1", "# Capital\n\n**Paris**", "France"),
      card("c2", "Berlin", "**Germany**", { state: 2, dueAt: "2026-02-01T10:00:00.000Z" }),
      card("c3", "Rome", "Italy", { state: 1, dueAt: "2026-02-01T10:00:00.000Z" }),
    ];

    async function renderSearchable() {
      await renderWithQueries(<DeckCardsHost />, {
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

  it("offers no Add when the deck's template is missing, and says why", async () => {
    const onAdd = jest.fn();
    await renderWithQueries(<DeckCardsHost onAdd={onAdd} />, {
      getCards: returning([]),
      getTemplate: returning(null),
    });

    expect(await screen.findByText("This deck's template is missing, so no card can be added to it.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add a card" })).toBeNull();
  });

  describe("selecting and deleting cards", () => {
    const cards = [card("c1", "Paris", "France"), card("c2", "Berlin", "Germany"), card("c3", "Rome", "Italy")];

    async function renderSelectable(overrides = {}) {
      const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
      const onOpenCard = jest.fn();
      await renderWithQueries(<DeckCardsHost onOpenCard={onOpenCard} />, {
        getCards: returning(cards),
        getTemplate: returning(template()),
        ...overrides,
      });
      await screen.findByText("Paris");
      return { alert, onOpenCard };
    }

    function confirm(alert: jest.SpyInstance) {
      const buttons: { text: string; onPress?: () => void }[] = alert.mock.lastCall[2];
      return act(() => buttons.find(({ text }) => text === "Delete cards")!.onPress?.());
    }

    afterEach(() => jest.restoreAllMocks());

    it("starts selecting on a long press, then toggles cards with taps instead of opening them", async () => {
      const { onOpenCard } = await renderSelectable();

      await fireEvent(screen.getByText("Paris"), "longPress");
      expect(screen.getByText("Selected: 1")).toBeTruthy();
      await fireEvent.press(screen.getByText("Berlin"));
      await fireEvent.press(screen.getByText("Paris"));
      expect(screen.getByText("Selected: 1")).toBeTruthy();
      expect(onOpenCard).not.toHaveBeenCalled();

      await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
      await fireEvent.press(screen.getByText("Berlin"));
      expect(onOpenCard).toHaveBeenCalledWith("c2");
    });

    it("counts and deletes only the selected cards the search shows, keeping the hidden ones selected", async () => {
      const deleteCards = jest.fn((_data: string) => Promise.resolve());
      const { alert } = await renderSelectable({ deleteCards });

      await fireEvent(screen.getByText("Paris"), "longPress");
      await fireEvent.press(screen.getByText("Berlin"));
      await fireEvent.changeText(screen.getByLabelText("Search cards"), "berlin");
      expect(screen.getByText("Selected: 1")).toBeTruthy();

      await fireEvent.changeText(screen.getByLabelText("Search cards"), "rome");
      expect(screen.getByText("Selected: 0")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Delete" }).props.accessibilityState.disabled).toBe(true);

      await fireEvent.changeText(screen.getByLabelText("Search cards"), "");
      expect(screen.getByText("Selected: 2")).toBeTruthy();
      await fireEvent.changeText(screen.getByLabelText("Search cards"), "berlin");
      await fireEvent.press(screen.getByRole("button", { name: "Delete" }));
      expect(deleteCards).not.toHaveBeenCalled();
      await confirm(alert);

      await waitFor(() => expect(deleteCards).toHaveBeenCalled());
      expect(JSON.parse(deleteCards.mock.calls[0][0])).toEqual({ ids: ["c2"] });
      await waitFor(() => expect(screen.queryByText(/^Selected/)).toBeNull());
    });
  });
});
