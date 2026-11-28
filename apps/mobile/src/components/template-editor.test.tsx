import { queryKeys } from "@koloda/core-react";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { BACK, FRONT, renderWithQueries, template, TEMPLATE_ID } from "../test/cards";
import { TemplateEditor } from "./template-editor";

const ADDED = "01900000-0000-7000-8000-000000000213";

type RenderOptions = {
  saved?: ReturnType<typeof template> | null;
  rejection?: unknown;
};

async function renderEditor({ saved = template({ isLocked: false }), rejection }: RenderOptions = {}) {
  // WHY: the template refetch after a save reads what the save wrote, as the database would.
  let stored = saved;
  const updateTemplate = jest.fn((data: string) => {
    if (rejection) return Promise.reject(rejection);
    const { id, values } = JSON.parse(data);
    stored = { ...stored!, ...values, id };
    return Promise.resolve(JSON.stringify(stored));
  });
  const { client } = await renderWithQueries(<TemplateEditor templateId={TEMPLATE_ID} />, {
    getTemplate: () => Promise.resolve(JSON.stringify(stored)),
    updateTemplate,
    newId: () => ADDED,
  });
  return { client, updateTemplate };
}

// WHY: by label, not role: a View is no accessibility element unless it is `accessible`, so the role query skips it.
function choice(group: string, label: string) {
  return within(screen.getByLabelText(group)).getByRole("radio", { name: label });
}

async function save(updateTemplate: jest.Mock) {
  await fireEvent.press(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(updateTemplate).toHaveBeenCalled());
  return JSON.parse(updateTemplate.mock.calls[0][0]);
}

describe("TemplateEditor", () => {
  it("saves the title, notes, a field's type and required flag, and a layout operation together", async () => {
    const { updateTemplate } = await renderEditor();

    await fireEvent.changeText(await screen.findByLabelText("Title"), "Words");
    await fireEvent.changeText(screen.getByLabelText("Notes"), "Nouns first");
    await fireEvent.changeText(screen.getByLabelText("Field 2 title"), "Answer");
    await fireEvent.press(choice("Field 2 type", "Markdown"));
    await fireEvent(screen.getByLabelText("Field 2 required"), "valueChange", true);
    await fireEvent.press(choice("2. Answer", "Type"));

    expect(await save(updateTemplate)).toEqual({
      id: TEMPLATE_ID,
      values: {
        title: "Words",
        notes: "Nouns first",
        content: {
          fields: [
            { id: FRONT, title: "Front", type: "markdown", isRequired: true },
            { id: BACK, title: "Answer", type: "markdown", isRequired: true },
          ],
          layout: [
            { field: FRONT, operation: "display" },
            { field: BACK, operation: "type" },
          ],
        },
      },
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeDisabled());
    expect(screen.getByDisplayValue("Words")).toBeTruthy();
  });

  it("adds a field with its displayed layout item, and removing a field removes its layout item", async () => {
    const { updateTemplate } = await renderEditor();

    await fireEvent.press(await screen.findByRole("button", { name: "Add a field" }));
    await fireEvent.changeText(screen.getByLabelText("Field 3 title"), "Example");
    await fireEvent.press(screen.getByRole("button", { name: "Remove field 1" }));

    expect(screen.queryByLabelText("1. Front")).toBeNull();
    expect(screen.getByLabelText("2. Example")).toBeTruthy();
    const { values } = await save(updateTemplate);
    expect(values.content).toEqual({
      fields: [
        { id: BACK, title: "Back", type: "text", isRequired: false },
        { id: ADDED, title: "Example", type: "text", isRequired: true },
      ],
      layout: [
        { field: BACK, operation: "reveal" },
        { field: ADDED, operation: "display" },
      ],
    });
  });

  it("on a locked template, disables type and required and hides adding and removing fields", async () => {
    await renderEditor({ saved: template({ isLocked: true }) });

    expect(await screen.findByText(/^Locked/)).toBeTruthy();
    expect(choice("Field 1 type", "Text")).toBeDisabled();
    expect(screen.getByLabelText("Field 1 required")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Add a field" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Remove field/ })).toBeNull();
    expect(screen.getByLabelText("Field 1 title")).toBeEnabled();
    expect(choice("1. Front", "Reveal")).toBeEnabled();
  });

  it("hides removing the last field", async () => {
    await renderEditor({
      saved: template({
        isLocked: false,
        content: {
          fields: [{ id: FRONT, title: "Front", type: "text", isRequired: true }],
          layout: [{ field: FRONT, operation: "display" }],
        },
      }),
    });

    await screen.findByLabelText("Field 1 title");
    expect(screen.queryByRole("button", { name: "Remove field 1" })).toBeNull();
  });

  it("shows a blank title's error and saves nothing", async () => {
    const { updateTemplate } = await renderEditor();

    await fireEvent.changeText(await screen.findByLabelText("Title"), " ");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Title can't be empty")).toBeTruthy();
    expect(updateTemplate).not.toHaveBeenCalled();
  });

  it("shows a rejected save's error and keeps the edit", async () => {
    await renderEditor({ rejection: { tag: "App", inner: { code: "validation.templates.update-locked" } } });

    await fireEvent.press(await screen.findByRole("button", { name: "Remove field 2" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("Cards use this template, so its fields can't be removed or change type or required"),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Field 2 title")).toBeNull();
  });

  it("discards an edit back to the saved values", async () => {
    await renderEditor();

    await fireEvent.press(await screen.findByRole("button", { name: "Remove field 2" }));
    await fireEvent.changeText(screen.getByLabelText("Title"), "Words");
    await fireEvent.press(screen.getByRole("button", { name: "Discard" }));

    expect(screen.getByDisplayValue("Vocabulary")).toBeTruthy();
    expect(screen.getByLabelText("Field 2 title")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Discard" })).toBeDisabled();
  });

  it("takes a change synced from desktop into an untouched part and keeps the user's edit", async () => {
    const { client } = await renderEditor();

    await fireEvent.changeText(await screen.findByLabelText("Title"), "Words");
    const synced = template({ isLocked: false, title: "Vocab", notes: "Synced" });
    synced.content.fields[0].title = "Question";
    await act(async () => {
      client.setQueryData(queryKeys.templates.detail(TEMPLATE_ID), {
        ...synced,
        createdAt: new Date(synced.createdAt),
      });
    });

    expect(await screen.findByDisplayValue("Synced")).toBeTruthy();
    expect(screen.getByDisplayValue("Question")).toBeTruthy();
    expect(screen.getByDisplayValue("Words")).toBeTruthy();
  });

  it("says a template deleted elsewhere no longer exists", async () => {
    await renderEditor({ saved: null });

    expect(await screen.findByText("This template no longer exists.")).toBeTruthy();
  });
});
