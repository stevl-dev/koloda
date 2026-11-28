import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import type { Template } from "@koloda/srs";
import { Alert } from "react-native";
import { DECK, learningSettings, renderWithQueries, returning, template, TEMPLATE_ID } from "../test/cards";
import { DeleteTemplate } from "./delete-template";

const OTHER_TEMPLATE = "01900000-0000-7000-8000-000000000202";
const UNLOCKED = template({ isLocked: false });

type RenderOptions = {
  saved?: ReturnType<typeof template>;
  decks?: unknown[];
  defaultTemplate?: string;
  deleteTemplate?: jest.Mock;
};

async function renderDelete({
  saved = UNLOCKED,
  decks = [],
  defaultTemplate = OTHER_TEMPLATE,
  deleteTemplate = jest.fn((_data: string) => Promise.resolve()),
}: RenderOptions = {}) {
  const onDeleted = jest.fn();
  // WHY: the component takes the template as the query hands it over, after the wire revived its timestamps.
  const revived = { ...saved, createdAt: new Date(saved.createdAt) } as unknown as Template;
  await renderWithQueries(<DeleteTemplate template={revived} onDeleted={onDeleted} />, {
    getTemplateDecks: returning(decks),
    getSettings: returning(learningSettings({ algorithm: DECK.algorithmId, template: defaultTemplate })),
    deleteTemplate,
  });
  return { onDeleted, deleteTemplate };
}

function answer(alert: jest.SpyInstance, choice: "Cancel" | "Delete") {
  const buttons: { text: string; onPress?: () => void }[] = alert.mock.lastCall[2];
  return act(() => buttons.find(({ text }) => text === choice)!.onPress?.());
}

describe("DeleteTemplate", () => {
  afterEach(() => jest.restoreAllMocks());

  it("deletes the template once the dialog confirms", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { onDeleted, deleteTemplate } = await renderDelete();

    await waitFor(() => expect(screen.getByRole("button", { name: "Delete template" })).toBeEnabled());
    await fireEvent.press(screen.getByRole("button", { name: "Delete template" }));
    expect(deleteTemplate).not.toHaveBeenCalled();
    await answer(alert, "Delete");

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(JSON.parse(deleteTemplate.mock.calls[0][0])).toEqual({ id: TEMPLATE_ID });
  });

  it("keeps the template when the dialog is cancelled", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { onDeleted, deleteTemplate } = await renderDelete();

    await waitFor(() => expect(screen.getByRole("button", { name: "Delete template" })).toBeEnabled());
    await fireEvent.press(screen.getByRole("button", { name: "Delete template" }));
    await answer(alert, "Cancel");

    expect(deleteTemplate).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it.each([
    ["locked", { saved: template({ isLocked: true }) }, "Cards use this template, so it cannot be deleted."],
    ["the default", { defaultTemplate: TEMPLATE_ID }, "The default template for new decks cannot be deleted."],
    [
      "used by a deck",
      { decks: [{ id: DECK.id, title: "Spanish" }] },
      "A deck uses this template, so it cannot be deleted.",
    ],
  ])("offers no delete while the template is %s, and says why", async (_case, options, reason) => {
    await renderDelete(options);

    expect(await screen.findByText(reason)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete template" })).toBeDisabled();
  });

  it("shows a failed delete's error and stays", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { onDeleted } = await renderDelete({
      deleteTemplate: jest.fn((_data: string) => Promise.reject({ tag: "App", inner: { code: "db.delete" } })),
    });

    await waitFor(() => expect(screen.getByRole("button", { name: "Delete template" })).toBeEnabled());
    await fireEvent.press(screen.getByRole("button", { name: "Delete template" }));
    await answer(alert, "Delete");

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
