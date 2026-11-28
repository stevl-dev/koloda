import type { Algorithm } from "@koloda/srs";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { Alert } from "react-native";
import { algorithm, DECK, learningSettings, renderWithQueries, returning, TEMPLATE_ID } from "../test/cards";
import { DeletePreset } from "./delete-preset";

const DELETED = algorithm({ id: "01900000-0000-7000-8000-000000000302", title: "Cramming" });
const FIRST_OTHER = algorithm();
const SECOND_OTHER = algorithm({ id: "01900000-0000-7000-8000-000000000303", title: "Slow" });

type RenderOptions = {
  decks?: unknown[];
  algorithms?: unknown[];
  defaultAlgorithm?: string;
  deleteAlgorithm?: jest.Mock;
};

async function renderDelete({
  decks = [],
  algorithms = [FIRST_OTHER, DELETED, SECOND_OTHER],
  defaultAlgorithm = FIRST_OTHER.id,
  deleteAlgorithm = jest.fn((_data: string) => Promise.resolve()),
}: RenderOptions = {}) {
  const onDeleted = jest.fn();
  // WHY: the component takes the algorithm as the query hands it over, after the wire revived its timestamps.
  const revived = { ...DELETED, createdAt: new Date(DELETED.createdAt) } as unknown as Algorithm;
  await renderWithQueries(<DeletePreset algorithm={revived} onDeleted={onDeleted} />, {
    getAlgorithmDecks: returning(decks),
    getAlgorithms: returning(algorithms),
    getSettings: returning(learningSettings({ algorithm: defaultAlgorithm, template: TEMPLATE_ID })),
    deleteAlgorithm,
  });
  return { onDeleted, deleteAlgorithm };
}

async function pressDelete() {
  await waitFor(() => expect(screen.getByRole("button", { name: "Delete preset" })).toBeEnabled());
  await fireEvent.press(screen.getByRole("button", { name: "Delete preset" }));
}

function answer(alert: jest.SpyInstance, choice: "Cancel" | "Delete") {
  const buttons: { text: string; onPress?: () => void }[] = alert.mock.lastCall[2];
  return act(() => buttons.find(({ text }) => text === choice)!.onPress?.());
}

describe("DeletePreset", () => {
  afterEach(() => jest.restoreAllMocks());

  it("deletes a preset no deck uses once the dialog confirms, with no successor to choose", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { onDeleted, deleteAlgorithm } = await renderDelete();

    await pressDelete();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(alert.mock.lastCall?.[1]).toBe("The preset is deleted on every device. This cannot be undone.");
    await answer(alert, "Delete");

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(JSON.parse(deleteAlgorithm.mock.calls[0][0]).id).toBe(DELETED.id);
  });

  it("moves the decks to the chosen successor, which starts on the first other preset", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { onDeleted, deleteAlgorithm } = await renderDelete({
      decks: [
        { id: DECK.id, title: "Spanish" },
        { id: "01900000-0000-7000-8000-000000000102", title: "Chemistry" },
      ],
    });

    const successor = await screen.findByLabelText("2 decks use this preset. They move to:");
    expect(within(successor).getByRole("radio", { name: "FSRS" })).toBeSelected();
    expect(within(successor).queryByRole("radio", { name: "Cramming" })).toBeNull();
    await fireEvent.press(within(successor).getByRole("radio", { name: "Slow" }));
    await pressDelete();
    expect(alert.mock.lastCall?.[1]).toBe(
      "The preset is deleted on every device, and its 2 decks move to the preset you chose. This cannot be undone.",
    );
    await answer(alert, "Delete");

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(JSON.parse(deleteAlgorithm.mock.calls[0][0])).toEqual({ id: DELETED.id, successorId: SECOND_OTHER.id });
  });

  it("keeps the preset when the dialog is cancelled", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { onDeleted, deleteAlgorithm } = await renderDelete();

    await pressDelete();
    await answer(alert, "Cancel");

    expect(deleteAlgorithm).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it.each([
    ["the default", { defaultAlgorithm: DELETED.id }, "The default preset for new decks cannot be deleted."],
    ["the last one left", { algorithms: [DELETED] }, "The only preset left cannot be deleted."],
  ])("offers no delete while the preset is %s, and says why", async (_case, options, reason) => {
    await renderDelete(options);

    expect(await screen.findByText(reason)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete preset" })).toBeDisabled();
  });

  it("shows a failed delete's error and stays", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { onDeleted } = await renderDelete({
      deleteAlgorithm: jest.fn((_data: string) => Promise.reject({ tag: "App", inner: { code: "db.delete" } })),
    });

    await pressDelete();
    await answer(alert, "Delete");

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
