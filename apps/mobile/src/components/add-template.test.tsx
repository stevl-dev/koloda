import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { activateLanguage } from "../i18n";
import { renderWithQueries, template } from "../test/cards";
import { AddTemplate } from "./add-template";

const IDS = ["01900000-0000-7000-8000-000000000221", "01900000-0000-7000-8000-000000000222"];

async function renderAdd(addTemplate: jest.Mock) {
  const ids = [...IDS];
  const onAdded = jest.fn();
  await renderWithQueries(<AddTemplate onAdded={onAdded} />, { addTemplate, newId: () => ids.shift()! });
  return { onAdded };
}

describe("AddTemplate", () => {
  afterEach(() => act(() => activateLanguage("en")));

  it("adds the default fields named in the interface language, with ids of their own", async () => {
    const added = template({ id: "01900000-0000-7000-8000-000000000203", title: "Words" });
    const addTemplate = jest.fn((_data: string) => Promise.resolve(JSON.stringify(added)));
    const { onAdded } = await renderAdd(addTemplate);
    await act(() => activateLanguage("ru"));

    await fireEvent.changeText(screen.getByLabelText("Название"), "Words");
    await fireEvent.press(screen.getByRole("button", { name: "Добавить шаблон" }));

    await waitFor(() => expect(onAdded).toHaveBeenCalledWith(expect.objectContaining({ id: added.id })));
    expect(JSON.parse(addTemplate.mock.calls[0][0])).toEqual({
      title: "Words",
      content: {
        fields: [
          { id: IDS[0], title: "Лицо", type: "text", isRequired: true },
          { id: IDS[1], title: "Оборот", type: "text", isRequired: true },
        ],
        layout: [
          { field: IDS[0], operation: "display" },
          { field: IDS[1], operation: "type" },
        ],
      },
    });
  });

  it("shows a blank title's error under it and adds nothing", async () => {
    const addTemplate = jest.fn();
    const { onAdded } = await renderAdd(addTemplate);

    await fireEvent.changeText(screen.getByLabelText("Title"), "  ");
    await fireEvent.press(screen.getByRole("button", { name: "Add template" }));

    expect(await screen.findByText("Title can't be empty")).toBeTruthy();
    expect(addTemplate).not.toHaveBeenCalled();
    expect(onAdded).not.toHaveBeenCalled();
  });

  it("shows a refused add's error and stays on the form", async () => {
    const addTemplate = jest.fn((_data: string) => Promise.reject({ tag: "App", inner: { code: "db.add" } }));
    const { onAdded } = await renderAdd(addTemplate);

    await fireEvent.changeText(screen.getByLabelText("Title"), "Words");
    await fireEvent.press(screen.getByRole("button", { name: "Add template" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByDisplayValue("Words")).toBeTruthy();
    expect(onAdded).not.toHaveBeenCalled();
  });
});
