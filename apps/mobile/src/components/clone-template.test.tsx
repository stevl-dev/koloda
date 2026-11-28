import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithQueries, template, TEMPLATE_ID } from "../test/cards";
import { CloneTemplate } from "./clone-template";

describe("CloneTemplate", () => {
  it("clones the source under the new title and hands over the clone", async () => {
    const clone = template({ id: "01900000-0000-7000-8000-000000000204", title: "Copy", isLocked: false });
    const cloneTemplate = jest.fn((_data: string) => Promise.resolve(JSON.stringify(clone)));
    const onCloned = jest.fn();
    await renderWithQueries(<CloneTemplate sourceId={TEMPLATE_ID} onCloned={onCloned} />, { cloneTemplate });

    await fireEvent.changeText(screen.getByLabelText("Title"), "Copy");
    await fireEvent.press(screen.getByRole("button", { name: "Clone template" }));

    await waitFor(() => expect(onCloned).toHaveBeenCalledWith(expect.objectContaining({ id: clone.id })));
    expect(JSON.parse(cloneTemplate.mock.calls[0][0])).toEqual({ title: "Copy", sourceId: TEMPLATE_ID });
  });
});
