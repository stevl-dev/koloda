import { fireEvent, screen } from "@testing-library/react-native";
import { renderWithQueries, returning, template } from "../test/cards";
import { TemplatesList } from "./templates-list";

const CLOZE = template({ id: "01900000-0000-7000-8000-000000000202", title: "Cloze" });

describe("TemplatesList", () => {
  it("lists the templates in the order the library returns them, and opens the tapped one", async () => {
    const onOpenTemplate = jest.fn();
    await renderWithQueries(<TemplatesList onOpenTemplate={onOpenTemplate} onAdd={jest.fn()} />, {
      getTemplates: returning([template(), CLOZE]),
    });

    await screen.findByText("Vocabulary");
    expect(screen.getAllByText(/^(Vocabulary|Cloze)$/).map((title) => title.props.children)).toEqual([
      "Vocabulary",
      "Cloze",
    ]);
    await fireEvent.press(screen.getByRole("link", { name: "Cloze" }));
    expect(onOpenTemplate).toHaveBeenCalledWith(CLOZE.id);
  });
});
