import { queryKeys } from "@koloda/core-react";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { card, DECK, DECK_ID, renderWithQueries, returning, template } from "../test/cards";
import { DeckDetails } from "./deck-details";

const OTHER_ALGORITHM = "01900000-0000-7000-8000-000000000302";
const OTHER_TEMPLATE = "01900000-0000-7000-8000-000000000202";
const SAVED_DECK = { ...DECK, notes: "Verbs first" };

type RenderOptions = {
  rejection?: unknown;
  decks?: unknown[];
  cards?: unknown[];
  deleteDeck?: jest.Mock;
};

async function renderDetails({ rejection, decks = [SAVED_DECK], cards = [], deleteDeck }: RenderOptions = {}) {
  // WHY: the decks refetch after a save reads what the save wrote, as the database would.
  let stored = decks;
  const updateDeck = jest.fn((data: string) => {
    if (rejection) return Promise.reject(rejection);
    const { id, values } = JSON.parse(data);
    const saved = { ...SAVED_DECK, ...values, id };
    stored = [saved];
    return Promise.resolve(JSON.stringify(saved));
  });
  const onDeleted = jest.fn();
  const { client } = await renderWithQueries(<DeckDetails deckId={DECK_ID} onDeleted={onDeleted} />, {
    getDecks: () => Promise.resolve(JSON.stringify(stored)),
    getCards: returning(cards),
    ...(deleteDeck && { deleteDeck }),
    getAlgorithms: returning([
      { id: DECK.algorithmId, title: "FSRS" },
      { id: OTHER_ALGORITHM, title: "Cramming" },
    ]),
    getTemplates: returning([template(), template({ id: OTHER_TEMPLATE, title: "Cloze" })]),
    updateDeck,
  });
  return { client, updateDeck, onDeleted };
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
    await renderDetails({ rejection: { tag: "App", inner: { code: "db.update" } } });

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
    await renderDetails({ decks: [] });

    expect(await screen.findByText("This deck no longer exists.")).toBeTruthy();
  });

  describe("delete", () => {
    async function renderDelete(options: RenderOptions) {
      const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
      const rendered = await renderDetails(options);
      await waitFor(() => expect(screen.getByRole("button", { name: "Delete deck" })).toBeEnabled());
      await fireEvent.press(screen.getByRole("button", { name: "Delete deck" }));
      return { ...rendered, alert };
    }

    function answer(alert: jest.SpyInstance, choice: "Cancel" | "Delete") {
      const buttons: { text: string; onPress?: () => void }[] = alert.mock.lastCall[2];
      return act(() => buttons.find(({ text }) => text === choice)!.onPress?.());
    }

    afterEach(() => jest.restoreAllMocks());

    it("counts the deck's cards, and deletes the deck once the dialog confirms", async () => {
      const deleteDeck = jest.fn((_data: string) => Promise.resolve());
      const { alert, onDeleted } = await renderDelete({
        cards: [card("c1", "uno", ""), card("c2", "dos", "")],
        deleteDeck,
      });

      expect(alert.mock.lastCall?.[1]).toBe(
        "The deck, its 2 cards, and their reviews are deleted on every device. This cannot be undone.",
      );
      expect(deleteDeck).not.toHaveBeenCalled();
      await answer(alert, "Delete");

      await waitFor(() => expect(onDeleted).toHaveBeenCalled());
      expect(JSON.parse(deleteDeck.mock.calls[0][0])).toEqual({ id: DECK_ID });
    });

    it("asks only about the deck when it has no cards", async () => {
      const { alert } = await renderDelete({});

      expect(alert.mock.lastCall?.[1]).toBe("The deck is deleted on every device. This cannot be undone.");
    });

    it("keeps the deck when the dialog is cancelled", async () => {
      const deleteDeck = jest.fn((_data: string) => Promise.resolve());
      const { alert, onDeleted } = await renderDelete({ deleteDeck });

      await answer(alert, "Cancel");

      expect(deleteDeck).not.toHaveBeenCalled();
      expect(onDeleted).not.toHaveBeenCalled();
    });

    it("shows a failed delete's error and stays", async () => {
      const deleteDeck = jest.fn((_data: string) => Promise.reject({ tag: "App", inner: { code: "db.delete" } }));
      const { alert, onDeleted } = await renderDelete({ deleteDeck });

      await answer(alert, "Delete");

      expect(await screen.findByRole("alert")).toBeTruthy();
      expect(onDeleted).not.toHaveBeenCalled();
    });
  });
});
