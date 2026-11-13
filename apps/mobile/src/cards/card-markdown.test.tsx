import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Linking } from "react-native";
import type { KolodaFacade } from "../host/facade";
import { createMobileQueries } from "../host/queries";
import { MobileQueriesContext } from "../host/queries-context";
import { CardMarkdown } from "./card-markdown";

const IMAGE_ID = "a".repeat(64);

function facadeWith(attachmentFile: KolodaFacade["attachmentFile"]): KolodaFacade {
  const unexpected = () => Promise.reject(new Error("not stubbed"));
  return {
    getDbStatus: unexpected,
    getDecks: unexpected,
    addDeck: unexpected,
    addCards: unexpected,
    addAttachment: unexpected,
    attachmentFile,
    getLessons: unexpected,
    getLessonData: unexpected,
    seedDb: unexpected,
    submitLessonResult: unexpected,
  };
}

async function renderCard(text: string, attachmentFile: KolodaFacade["attachmentFile"] = jest.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <MobileQueriesContext.Provider value={createMobileQueries(facadeWith(attachmentFile), "/cache")}>
        <CardMarkdown text={text} />
      </MobileQueriesContext.Provider>
    </QueryClientProvider>,
  );
}

describe("CardMarkdown", () => {
  it("renders each block and inline token kind as native text", async () => {
    await renderCard(
      [
        "# Title",
        "",
        "Some *em*, **strong**, ~~gone~~, and `code` with an \\*escape\\* &amp; entity.",
        "",
        "- first",
        "- [x] done",
        "  1. nested",
        "",
        "> quoted",
        "",
        "| Word | Meaning |",
        "| --- | --- |",
        "| uno | one |",
        "",
        "---",
        "",
        "```",
        "block code",
        "```",
      ].join("\n"),
    );

    expect(screen.getByText("Title")).toBeTruthy();
    expect(screen.getByText("em")).toBeTruthy();
    expect(screen.getByText("strong")).toBeTruthy();
    expect(screen.getByText("gone")).toBeTruthy();
    expect(screen.getByText("code")).toBeTruthy();
    expect(screen.getByText(/with an \*escape\* & entity\./)).toBeTruthy();
    expect(screen.getByText("•")).toBeTruthy();
    expect(screen.getByText("first")).toBeTruthy();
    expect(screen.getByText("☑")).toBeTruthy();
    expect(screen.getByText("done")).toBeTruthy();
    expect(screen.getByText("1.")).toBeTruthy();
    expect(screen.getByText("nested")).toBeTruthy();
    expect(screen.getByText("quoted")).toBeTruthy();
    expect(screen.getByText("Meaning")).toBeTruthy();
    expect(screen.getByText("uno")).toBeTruthy();
    expect(screen.getByTestId("markdown-rule")).toBeTruthy();
    expect(screen.getByText("block code")).toBeTruthy();
  });

  it("opens a web link in the system browser only when tapped, and leaves other links inert", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    await renderCard("[site](https://example.com) and [mail](mailto:a@b.c)");

    expect(openURL).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText("site"));
    expect(openURL).toHaveBeenCalledWith("https://example.com");

    fireEvent.press(screen.getByText("mail"));
    expect(openURL).toHaveBeenCalledTimes(1);
    openURL.mockRestore();
  });

  it("shows a card image from its cache file", async () => {
    const attachmentFile = jest.fn((_id: string, _cacheDir: string) => Promise.resolve(`/cache/${IMAGE_ID}.png`));
    await renderCard(`Before\n\n![a cat](attachment:${IMAGE_ID})`, attachmentFile);

    const image = await screen.findByTestId("card-image");
    expect(image.props.source).toEqual([expect.objectContaining({ uri: `file:///cache/${IMAGE_ID}.png` })]);
    expect(attachmentFile).toHaveBeenCalledWith(IMAGE_ID, "/cache");
  });

  it("shows the alt text of a card image the database lacks", async () => {
    await renderCard(`![a missing cat](attachment:${IMAGE_ID})`, () => Promise.resolve(undefined));

    expect(await screen.findByText("a missing cat")).toBeTruthy();
    expect(screen.queryByTestId("card-image")).toBeNull();
  });

  it("never loads a remote or embedded image, and shows its alt text", async () => {
    const attachmentFile = jest.fn();
    await renderCard("![remote](https://example.com/cat.png) ![embedded](data:image/png;base64,AAAA)", attachmentFile);

    expect(screen.getByText(/remote/)).toBeTruthy();
    expect(screen.getByText(/embedded/)).toBeTruthy();
    expect(screen.queryByTestId("card-image")).toBeNull();
    expect(attachmentFile).not.toHaveBeenCalled();
  });

  it("drops raw HTML tags and shows their text", async () => {
    await renderCard("Inline <b>bold</b> tag.\n\n<div>Block <i>html</i></div>\n");

    expect(screen.getByText("Inline bold tag.")).toBeTruthy();
    expect(screen.getByText("Block html")).toBeTruthy();
  });
});
