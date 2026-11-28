import { queryKeys } from "@koloda/core-react";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { algorithm, DECK, renderWithQueries } from "../test/cards";
import { PresetEditor } from "./preset-editor";

const ID = DECK.algorithmId;

type RenderOptions = {
  saved?: ReturnType<typeof algorithm> | null;
  rejection?: unknown;
};

async function renderEditor({ saved = algorithm(), rejection }: RenderOptions = {}) {
  // WHY: the algorithm refetch after a save reads what the save wrote, as the database would.
  let stored = saved;
  const updateAlgorithm = jest.fn((data: string) => {
    if (rejection) return Promise.reject(rejection);
    const { id, values } = JSON.parse(data);
    stored = { ...stored!, ...values, id };
    return Promise.resolve(JSON.stringify(stored));
  });
  const { client } = await renderWithQueries(<PresetEditor algorithmId={ID} onClone={jest.fn()} />, {
    getAlgorithm: () => Promise.resolve(JSON.stringify(stored)),
    updateAlgorithm,
  });
  return { client, updateAlgorithm };
}

async function save(updateAlgorithm: jest.Mock) {
  await fireEvent.press(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(updateAlgorithm).toHaveBeenCalled());
  return JSON.parse(updateAlgorithm.mock.calls[0][0]);
}

describe("PresetEditor", () => {
  it("saves the title, notes, and every parameter together", async () => {
    const { updateAlgorithm } = await renderEditor();

    await fireEvent.changeText(await screen.findByLabelText("Title"), "Cramming");
    await fireEvent.changeText(screen.getByLabelText("Notes"), "Short steps");
    await fireEvent.changeText(screen.getByLabelText("Retention, %"), "85");
    await fireEvent(screen.getByLabelText("Apply fuzz factor"), "valueChange", false);
    await fireEvent.changeText(screen.getByLabelText("Weights"), algorithm().content.weights.replace("0.1104", "0.2"));
    await fireEvent.changeText(screen.getByLabelText("Learning step 2"), "30");
    await fireEvent.press(
      within(screen.getByLabelText("Learning step 2 unit")).getByRole("radio", { name: "seconds" }),
    );
    await fireEvent.changeText(screen.getByLabelText("Maximum interval, days"), "365");

    const { values } = await save(updateAlgorithm);
    expect(values).toEqual({
      title: "Cramming",
      notes: "Short steps",
      content: {
        ...algorithm().content,
        retention: 85,
        isFuzzEnabled: false,
        weights: algorithm().content.weights.replace("0.1104", "0.2"),
        learningSteps: [
          [1, "m"],
          [30, "s"],
        ],
        maximumInterval: 365,
      },
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeDisabled());
  });

  it("adds a step that copies the last one, or the default first step to an empty list, and removes one", async () => {
    const { updateAlgorithm } = await renderEditor({
      saved: algorithm({ content: { ...algorithm().content, relearningSteps: [] } }),
    });

    await fireEvent.press(await screen.findByRole("button", { name: "Add a learning step" }));
    await fireEvent.press(screen.getByRole("button", { name: "Add a relearning step" }));
    await fireEvent.press(screen.getByRole("button", { name: "Remove learning step 1" }));

    const { values } = await save(updateAlgorithm);
    expect(values.content.learningSteps).toEqual([
      [10, "m"],
      [10, "m"],
    ]);
    expect(values.content.relearningSteps).toEqual([[10, "m"]]);
  });

  it("shows invalid weights' error under them and saves nothing", async () => {
    const { updateAlgorithm } = await renderEditor();

    await fireEvent.changeText(await screen.findByLabelText("Weights"), "1, 2, 3");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Invalid FSRS weights")).toBeTruthy();
    expect(updateAlgorithm).not.toHaveBeenCalled();
  });

  it("shows a blank title's error and saves nothing", async () => {
    const { updateAlgorithm } = await renderEditor();

    await fireEvent.changeText(await screen.findByLabelText("Title"), " ");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Title can't be empty")).toBeTruthy();
    expect(updateAlgorithm).not.toHaveBeenCalled();
  });

  it("shows a rejected save's error and keeps the edit", async () => {
    await renderEditor({ rejection: { tag: "App", inner: { code: "db.update" } } });

    await fireEvent.changeText(await screen.findByLabelText("Title"), "Cramming");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByDisplayValue("Cramming")).toBeTruthy();
  });

  it("discards an edit back to the saved values", async () => {
    await renderEditor();

    await fireEvent.changeText(await screen.findByLabelText("Retention, %"), "80");
    await fireEvent.press(screen.getByRole("button", { name: "Remove learning step 1" }));
    await fireEvent.press(screen.getByRole("button", { name: "Discard" }));

    expect(screen.getByLabelText("Retention, %").props.value).toBe("90");
    expect(screen.getByLabelText("Learning step 2")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Discard" })).toBeDisabled();
  });

  it("takes a change synced from desktop into an untouched part and keeps the user's edit", async () => {
    const { client } = await renderEditor();

    await fireEvent.changeText(await screen.findByLabelText("Title"), "Cramming");
    const synced = algorithm({ title: "Desktop", notes: "Synced", content: { ...algorithm().content, retention: 95 } });
    await act(async () => {
      client.setQueryData(queryKeys.algorithms.detail(ID), { ...synced, createdAt: new Date(synced.createdAt) });
    });

    expect(await screen.findByDisplayValue("Synced")).toBeTruthy();
    expect(screen.getByLabelText("Retention, %").props.value).toBe("95");
    expect(screen.getByDisplayValue("Cramming")).toBeTruthy();
  });

  it("says a preset deleted elsewhere no longer exists", async () => {
    await renderEditor({ saved: null });

    expect(await screen.findByText("This preset no longer exists.")).toBeTruthy();
  });
});
