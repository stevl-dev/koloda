import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { DEFAULT_FSRS_ALGORITHM } from "@koloda/srs";
import { algorithm, renderWithQueries } from "../test/cards";
import { AddPreset } from "./add-preset";

describe("AddPreset", () => {
  it("adds a preset with the built-in FSRS defaults", async () => {
    const added = algorithm({ id: "01900000-0000-7000-8000-000000000303", title: "Cramming" });
    const addAlgorithm = jest.fn((_data: string) => Promise.resolve(JSON.stringify(added)));
    const onAdded = jest.fn();
    await renderWithQueries(<AddPreset onAdded={onAdded} />, { addAlgorithm });

    await fireEvent.changeText(screen.getByLabelText("Title"), "Cramming");
    await fireEvent.press(screen.getByRole("button", { name: "Add preset" }));

    await waitFor(() => expect(onAdded).toHaveBeenCalledWith(expect.objectContaining({ id: added.id })));
    expect(JSON.parse(addAlgorithm.mock.calls[0][0])).toEqual({ title: "Cramming", content: DEFAULT_FSRS_ALGORITHM });
  });
});
