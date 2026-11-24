import type { AIModel } from "@koloda/ai";
import { describe, expect, it } from "vitest";
import { getConversationFileKind, getInputStates, readConversationFile } from "./conversation-files";

function model(hasImageInput?: boolean, hasPdfInput?: boolean): AIModel {
  return {
    id: "m",
    name: "m",
    context_length: 0,
    ...(hasImageInput === undefined ? {} : { has_image_input: hasImageInput }),
    ...(hasPdfInput === undefined ? {} : { has_pdf_input: hasPdfInput }),
  };
}

describe("getInputStates", () => {
  it.each([
    { name: "no model selected", modelId: "", selected: undefined, profile: {}, expected: null },
    {
      name: "a model that accepts both",
      modelId: "m",
      selected: model(true, true),
      profile: {},
      expected: { image: "enabled", pdf: "enabled" },
    },
    {
      name: "a model that accepts neither, though the switches name it",
      modelId: "m",
      selected: model(false, false),
      profile: { imageInputModelIds: ["m"], pdfInputModelIds: ["m"] },
      expected: { image: "unsupported", pdf: "unsupported" },
    },
    {
      name: "an unknown model with only the PDF switch on",
      modelId: "m",
      selected: model(),
      profile: { pdfInputModelIds: ["m"] },
      expected: { image: "unknown", pdf: "enabled" },
    },
    {
      name: "a selected model missing from the list",
      modelId: "m",
      selected: undefined,
      profile: {},
      expected: { image: "unknown", pdf: "unknown" },
    },
  ])("$name", ({ modelId, selected, profile, expected }) => {
    expect(getInputStates(modelId, selected, profile)).toEqual(expected);
  });
});

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe("getConversationFileKind", () => {
  it.each([
    { name: "a typed image", file: new File([""], "a.png", { type: "image/png" }), expected: "image" },
    { name: "a PDF by type", file: new File([""], "a", { type: "application/pdf" }), expected: "pdf" },
    { name: "a PDF by name", file: new File([""], "Chapter.PDF", { type: "" }), expected: "pdf" },
    { name: "text by type", file: new File([""], "a", { type: "text/csv" }), expected: "text" },
    { name: "markdown typed as nothing", file: new File([""], "notes.md", { type: "" }), expected: "text" },
    { name: "an untyped image", file: new File([new Uint8Array(PNG)], "scan", { type: "" }), expected: "image" },
    { name: "an untyped file of no kind", file: new File(["hello"], "scan", { type: "" }), expected: null },
    { name: "a typed file of no kind", file: new File([""], "a.docx", { type: "application/msword" }), expected: null },
  ])("$name is $expected", async ({ file, expected }) => {
    expect(await getConversationFileKind(file)).toBe(expected);
  });
});

describe("readConversationFile", () => {
  it("reads a text file as its bytes", async () => {
    const { bytes } = await readConversationFile(new File(["слово"], "a.txt", { type: "text/plain" }), "text");
    expect(new TextDecoder().decode(bytes)).toBe("слово");
  });

  it.each([
    {
      name: "a PDF whose bytes are text",
      file: new File(["plain"], "a.pdf", { type: "application/pdf" }),
      kind: "pdf" as const,
      code: "validation.conversation-attachments.format",
    },
    {
      name: "a text file whose bytes are binary",
      file: new File([new Uint8Array([0x61, 0, 0x62])], "a.txt", { type: "text/plain" }),
      kind: "text" as const,
      code: "validation.conversation-attachments.format",
    },
    {
      name: "a text file past its cap",
      file: new File([new Uint8Array(1_048_577).fill(0x61)], "a.txt", { type: "text/plain" }),
      kind: "text" as const,
      code: "validation.conversation-attachments.text-too-large",
    },
  ])("refuses $name", async ({ file, kind, code }) => {
    await expect(readConversationFile(file, kind)).rejects.toMatchObject({ code });
  });
});
