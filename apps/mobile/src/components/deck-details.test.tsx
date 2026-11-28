import { queryKeys } from "@koloda/core-react";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { DECK, DECK_ID, renderWithQueries, returning, template } from "../test/cards";
import { DeckDetails } from "./deck-details";

const OTHER_ALGORITHM = "01900000-0000-7000-8000-000000000302";
const OTHER_TEMPLATE = "01900000-0000-7000-8000-000000000202";
const SAVED_DECK = { ...DECK, notes: "Verbs first" };

async function renderDetails(rejection?: unknown, decks: unknown[] = [SAVED_DECK]) {
  // WHY: the decks refetch after a save reads what the save wrote, as the database would.
  let stored = decks;
  const updateDeck = jest.fn((data: string) => {
    if (rejection) return Promise.reject(rejection);
    const { id, values } = JSON.parse(data);
    const saved = { ...SAVED_DECK, ...values, id };
    stored = [saved];
    return Promise.resolve(JSON.stringify(saved));
  });
  const { client } = await renderWithQueries(<DeckDetails deckId={DECK_ID} />, {
    getDecks: () => Promise.resolve(JSON.stringify(stored)),
    getAlgorithms: returning([
      { id: DECK.algorithmId, title: "FSRS" },
      { id: OTHER_ALGORITHM, title: "Cramming" },
    ]),
    getTemplates: returning([template(), template({ id: OTHER_TEMPLATE, title: "Cloze" })]),
    updateDeck,
  });
  return { client, updateDeck };
}

describe("DeckDetails", () => {
  it("saves the title, notes, algorithm, and template together", async () => {
    const { updateDeck } = await renderDetails();
    await screen.findByRole("radio", { name: "Cramming" });

    await fireEvent.changeText(screen.getByLabelText("Title"), "Italian");
    await fireEvent.changeText(screen.getByLabelText("Notes"), "Nouns first");
    await fireEvent.press(screen.getByRole("radio", { name: "Cramming" }));
    await fireEvent.press(screen.getByRole("radio", { name: "Cloze" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateDeck).toHaveBeenCalled());
    expect(JSON.parse(updateDeck.mock.calls[0][0])).toEqual({
      id: DECK_ID,
      values: { title: "Italian", notes: "Nouns first", algorithmId: OTHER_ALGORITHM, templateId: OTHER_TEMPLATE },
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeDisabled());
    expect(screen.getByDisplayValue("Italian")).toBeTruthy();
  });

  it("shows a blank title's error and saves nothing", async () => {
    const { updateDeck } = await renderDetails();

    await fireEvent.changeText(await screen.findByLabelText("Title"), " ");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Title can't be empty")).toBeTruthy();
    expect(updateDeck).not.toHaveBeenCalled();
  });

  it("shows a rejected save's error and keeps the edit", async () => {
    await renderDetails({ tag: "App", inner: { code: "db.update" } });

    await fireEvent.changeText(await screen.findByLabelText("Title"), "Italian");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByDisplayValue("Italian")).toBeTruthy();
  });

  it("discards an edit back to the saved values", async () => {
    await renderDetails();

    await fireEvent.changeText(await screen.findByLabelText("Title"), "Italian");
    await fireEvent.press(screen.getByRole("button", { name: "Discard" }));

    expect(screen.getByDisplayValue("Spanish")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Discard" })).toBeDisabled();
  });

  it("takes a change synced from desktop into an untouched field and keeps the user's edit", async () => {
    const { client } = await renderDetails();

    await fireEvent.changeText(await screen.findByLabelText("Title"), "Italian");
    await act(async () => {
      client.setQueryData(queryKeys.decks.all(), [{ ...SAVED_DECK, title: "Español", notes: "Nouns first" }]);
    });

    expect(await screen.findByDisplayValue("Nouns first")).toBeTruthy();
    expect(screen.getByDisplayValue("Italian")).toBeTruthy();
  });

  it("says a deck deleted elsewhere no longer exists", async () => {
    await renderDetails(undefined, []);

    expect(await screen.findByText("This deck no longer exists.")).toBeTruthy();
  });
});
