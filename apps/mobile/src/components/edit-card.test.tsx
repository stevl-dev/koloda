import { queryKeys } from "@koloda/core-react";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { fromWire } from "@koloda/native-host";
import { BACK, card, DECK_ID, FRONT, renderWithQueries, returning, template } from "../test/cards";
import { EditCard } from "./edit-card";

const CARD = card("c1", "Paris", "France");

async function renderEdit(
  updateCard = returning({ ...CARD, content: { [FRONT]: { text: "Lyon" }, [BACK]: { text: "France" } } }),
) {
  const onSaved = jest.fn();
  const { client } = await renderWithQueries(<EditCard deckId={DECK_ID} cardId="c1" onSaved={onSaved} />, {
    getCards: returning([CARD]),
    getTemplate: returning(template()),
    updateCard,
  });
  await screen.findByDisplayValue("Paris");
  return { client, onSaved, updateCard };
}

describe("EditCard", () => {
  it("saves the edited content, puts the saved card in its deck's list, and returns", async () => {
    const { client, onSaved, updateCard } = await renderEdit();

    await fireEvent.changeText(screen.getByLabelText("Front"), "Lyon");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(JSON.parse(updateCard.mock.calls[0][0] as string)).toEqual({
      id: "c1",
      values: { content: { [FRONT]: { text: "Lyon" }, [BACK]: { text: "France" } } },
    });
    const list = client.getQueryData<{ content: Record<string, { text: string }> }[]>(
      queryKeys.cards.deck({ deckId: DECK_ID }),
    );
    expect(list?.[0].content[FRONT].text).toBe("Lyon");
  });

  it("refuses a blank required field and shows why under it, without saving", async () => {
    const { onSaved, updateCard } = await renderEdit();

    await fireEvent.changeText(screen.getByLabelText("Front"), "");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("This field can't be empty")).toBeTruthy();
    expect(updateCard).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("shows a rejected save's error and stays on the form", async () => {
    const updateCard = jest.fn(() => Promise.reject({ tag: "App", inner: { code: "db.update" } }));
    const { onSaved } = await renderEdit(updateCard);

    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Failed to update data")).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Paris")).toBeTruthy();
  });

  it("takes a change synced from desktop into an untouched form", async () => {
    const { client } = await renderEdit();

    await act(async () => {
      client.setQueryData(queryKeys.cards.deck({ deckId: DECK_ID }), [fromWire(card("c1", "Paris, France", "France"))]);
    });

    expect(await screen.findByDisplayValue("Paris, France")).toBeTruthy();
  });
});
