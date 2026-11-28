import { fireEvent, screen } from "@testing-library/react-native";
import { DECK, renderWithQueries, returning } from "../test/cards";
import { DecksList } from "./decks-list";

const CHEMISTRY = { ...DECK, id: "01900000-0000-7000-8000-000000000102", title: "Chemistry" };

describe("DecksList", () => {
  it("lists the decks in the order the library returns them, and opens the tapped one", async () => {
    const onOpenDeck = jest.fn();
    await renderWithQueries(<DecksList onOpenDeck={onOpenDeck} />, { getDecks: returning([DECK, CHEMISTRY]) });

    await screen.findByText("Spanish");
    expect(screen.getAllByText(/^(Spanish|Chemistry)$/).map((title) => title.props.children)).toEqual([
      "Spanish",
      "Chemistry",
    ]);
    await fireEvent.press(screen.getByRole("link", { name: "Chemistry" }));
    expect(onOpenDeck).toHaveBeenCalledWith(CHEMISTRY.id);
  });

  it("says a library with no decks has none", async () => {
    await renderWithQueries(<DecksList onOpenDeck={jest.fn()} />, { getDecks: returning([]) });

    expect(await screen.findByText(/^No decks yet\./)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
