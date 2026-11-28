import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { DECK, renderWithQueries, returning, TEMPLATE_ID, template } from "../test/cards";
import { AddDeck } from "./add-deck";

const DEFAULT_ALGORITHM = DECK.algorithmId;
const OTHER_ALGORITHM = "01900000-0000-7000-8000-000000000302";
const OTHER_TEMPLATE = "01900000-0000-7000-8000-000000000202";

const learning = {
  name: "learning",
  content: {
    defaults: { algorithm: DEFAULT_ALGORITHM, template: TEMPLATE_ID },
    dailyLimits: {
      total: 100,
      untouched: { value: 20, counts: true },
      learn: { value: null, counts: false },
      review: { value: 80, counts: true },
    },
    dayStartsAt: "04:00",
    learnAheadLimit: [0, 30],
  },
};

async function renderAddDeck() {
  const addDeck = jest.fn((data: string) =>
    Promise.resolve(JSON.stringify({ ...DECK, ...JSON.parse(data), id: "01900000-0000-7000-8000-000000000109" })),
  );
  const onAdded = jest.fn();
  await renderWithQueries(<AddDeck onAdded={onAdded} />, {
    getSettings: returning(learning),
    getAlgorithms: returning([
      { id: DEFAULT_ALGORITHM, title: "FSRS" },
      { id: OTHER_ALGORITHM, title: "Cramming" },
    ]),
    getTemplates: returning([template(), template({ id: OTHER_TEMPLATE, title: "Cloze" })]),
    addDeck,
  });
  await screen.findByRole("radio", { name: "Cramming" });
  return { addDeck, onAdded };
}

describe("AddDeck", () => {
  it("adds a deck with the default algorithm and template, and hands the new deck on", async () => {
    const { addDeck, onAdded } = await renderAddDeck();

    await fireEvent.changeText(screen.getByLabelText("Title"), "  Italian ");
    await fireEvent.press(screen.getByRole("button", { name: "Add deck" }));

    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(JSON.parse(addDeck.mock.calls[0][0])).toEqual({
      title: "Italian",
      algorithmId: DEFAULT_ALGORITHM,
      templateId: TEMPLATE_ID,
    });
    expect(onAdded.mock.calls[0][0].id).toBe("01900000-0000-7000-8000-000000000109");
  });

  it("adds a deck with the algorithm and template the user chose instead", async () => {
    const { addDeck } = await renderAddDeck();

    await fireEvent.changeText(screen.getByLabelText("Title"), "Italian");
    await fireEvent.press(screen.getByRole("radio", { name: "Cramming" }));
    await fireEvent.press(screen.getByRole("radio", { name: "Cloze" }));
    await fireEvent.press(screen.getByRole("button", { name: "Add deck" }));

    await waitFor(() => expect(addDeck).toHaveBeenCalled());
    expect(JSON.parse(addDeck.mock.calls[0][0])).toMatchObject({
      algorithmId: OTHER_ALGORITHM,
      templateId: OTHER_TEMPLATE,
    });
  });

  it("shows a blank title's error and adds nothing", async () => {
    const { addDeck, onAdded } = await renderAddDeck();

    await fireEvent.changeText(screen.getByLabelText("Title"), "   ");
    await fireEvent.press(screen.getByRole("button", { name: "Add deck" }));

    expect(await screen.findByText("Title can't be empty")).toBeTruthy();
    expect(addDeck).not.toHaveBeenCalled();
    expect(onAdded).not.toHaveBeenCalled();
  });

  it("shows a rejected add's error and stays on the form", async () => {
    const { addDeck, onAdded } = await renderAddDeck();
    addDeck.mockImplementation(() => Promise.reject({ tag: "App", inner: { code: "db.add" } }));

    await fireEvent.changeText(screen.getByLabelText("Title"), "Italian");
    await fireEvent.press(screen.getByRole("button", { name: "Add deck" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(onAdded).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Title").props.value).toBe("Italian");
  });
});
