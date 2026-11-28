import { fireEvent, screen } from "@testing-library/react-native";
import { algorithm, renderWithQueries, returning } from "../test/cards";
import { PresetsList } from "./presets-list";

const CRAMMING = algorithm({ id: "01900000-0000-7000-8000-000000000302", title: "Cramming" });

describe("PresetsList", () => {
  it("lists the presets in the order the library returns them, and opens the tapped one", async () => {
    const onOpenPreset = jest.fn();
    await renderWithQueries(<PresetsList onOpenPreset={onOpenPreset} />, {
      getAlgorithms: returning([algorithm(), CRAMMING]),
    });

    await screen.findByText("FSRS");
    expect(screen.getAllByText(/^(FSRS|Cramming)$/).map((title) => title.props.children)).toEqual(["FSRS", "Cramming"]);
    await fireEvent.press(screen.getByRole("link", { name: "Cramming" }));
    expect(onOpenPreset).toHaveBeenCalledWith(CRAMMING.id);
  });
});
