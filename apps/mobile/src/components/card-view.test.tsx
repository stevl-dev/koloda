import { screen } from "@testing-library/react-native";
import { card, DECK_ID, renderWithQueries, returning, template } from "../test/cards";
import { CardView } from "./card-view";

const GRADED = card("c2", "**Berlin**", "Germany", {
  state: 2,
  dueAt: "2026-02-01T10:00:00.000Z",
  stability: 12.345,
  difficulty: 5.5,
  lapses: 3,
  updatedAt: "2026-01-05T00:00:00.000Z",
});

function review(id: string, rating: number, createdAt: string) {
  return { id, cardId: "c2", rating, state: 2, createdAt };
}

describe("CardView", () => {
  it("shows an untouched card's fields, a markdown one rendered, with its state and no scheduling", async () => {
    await renderWithQueries(<CardView deckId={DECK_ID} cardId="c1" onEdit={jest.fn()} />, {
      getCards: returning([card("c1", "**Paris**", "*France*")]),
      getTemplate: returning(template()),
    });

    expect(await screen.findByText("Paris")).toBeTruthy();
    expect(screen.getByText("*France*")).toBeTruthy();
    expect(screen.getByText("New")).toBeTruthy();
    expect(screen.getByText("Created")).toBeTruthy();
    expect(screen.queryByText("Stability")).toBeNull();
    expect(screen.queryByText("Reviews")).toBeNull();
    expect(screen.queryByText("Updated")).toBeNull();
  });

  it("shows a graded card's scheduling numbers and its reviews, oldest first", async () => {
    const getReviews = returning([
      review("r1", 1, "2026-01-03T09:00:00.000Z"),
      review("r2", 3, "2026-01-04T09:00:00.000Z"),
    ]);
    await renderWithQueries(<CardView deckId={DECK_ID} cardId="c2" onEdit={jest.fn()} />, {
      getCards: returning([GRADED]),
      getTemplate: returning(template()),
      getReviews,
    });

    expect(await screen.findByText("Again")).toBeTruthy();
    expect(JSON.parse(getReviews.mock.calls[0][0] as string)).toEqual({ cardId: "c2" });
    expect(screen.getByText("12.35")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("Due")).toBeTruthy();
    expect(screen.getByText("Updated")).toBeTruthy();
    const grades = screen.getAllByText(/^(Again|Good)$/).map((node) => node.props.children);
    expect(grades).toEqual(["Again", "Good"]);
  });

  it("says so when the card is gone from its deck", async () => {
    await renderWithQueries(<CardView deckId={DECK_ID} cardId="c9" onEdit={jest.fn()} />, {
      getCards: returning([GRADED]),
    });

    expect(await screen.findByText("This card no longer exists.")).toBeTruthy();
  });
});
