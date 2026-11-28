import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { algorithm, DECK, renderWithQueries } from "../test/cards";
import { ClonePreset } from "./clone-preset";

describe("ClonePreset", () => {
  it("clones the source under the new title and hands over the clone", async () => {
    const clone = algorithm({ id: "01900000-0000-7000-8000-000000000304", title: "Copy" });
    const cloneAlgorithm = jest.fn((_data: string) => Promise.resolve(JSON.stringify(clone)));
    const onCloned = jest.fn();
    await renderWithQueries(<ClonePreset sourceId={DECK.algorithmId} onCloned={onCloned} />, { cloneAlgorithm });

    await fireEvent.changeText(screen.getByLabelText("Title"), "Copy");
    await fireEvent.press(screen.getByRole("button", { name: "Clone preset" }));

    await waitFor(() => expect(onCloned).toHaveBeenCalledWith(expect.objectContaining({ id: clone.id })));
    expect(JSON.parse(cloneAlgorithm.mock.calls[0][0])).toEqual({ title: "Copy", sourceId: DECK.algorithmId });
  });
});
