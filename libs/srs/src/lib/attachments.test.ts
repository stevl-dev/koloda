import { describe, expect, it } from "vitest";
import {
  addAttachmentSchema,
  addConversationAttachmentSchema,
  sniffConversationAttachmentMime,
  sniffImageMime,
} from "./attachments";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

function ftyp(major: string, compatible: string[]) {
  const size = 16 + 4 * compatible.length;
  return [0, 0, 0, size, ...ascii("ftyp"), ...ascii(major), 0, 0, 0, 0, ...compatible.flatMap(ascii)];
}

function pngOfLength(length: number) {
  const bytes = new Uint8Array(length);
  bytes.set(PNG_SIGNATURE);
  return bytes;
}

const truncatedBox = ftyp("avif", []);
truncatedBox[3] = 64;

describe("sniffImageMime", () => {
  it.each([
    ["png", [...PNG_SIGNATURE, 0, 0], "image/png"],
    ["jpeg", [0xff, 0xd8, 0xff, 0xe0], "image/jpeg"],
    ["gif87a", [...ascii("GIF87a"), 1, 0], "image/gif"],
    ["gif89a", [...ascii("GIF89a"), 1, 0], "image/gif"],
    ["webp", ascii("RIFF\0\0\0\0WEBPVP8 "), "image/webp"],
    ["avif major brand", ftyp("avif", ["mif1", "miaf"]), "image/avif"],
    ["avis compatible brand", ftyp("mif1", ["miaf", "avis"]), "image/avif"],
    ["heic", ftyp("heic", ["mif1", "heic"]), undefined],
    ["avif brand past the ftyp box", [...ftyp("mif1", ["miaf"]), ...ascii("avif")], undefined],
    ["ftyp box longer than the file", truncatedBox, undefined],
    ["riff wave", ascii("RIFF\0\0\0\0WAVEfmt "), undefined],
    ["svg", ascii('<svg xmlns="http://www.w3.org/2000/svg"/>'), undefined],
    ["png signature cut short", PNG_SIGNATURE.slice(0, 7), undefined],
    ["empty", [], undefined],
  ])("%s", (_, bytes, expected) => {
    expect(sniffImageMime(new Uint8Array(bytes))).toBe(expected);
  });
});

describe("addAttachmentSchema", () => {
  // WHY: literals, not the constant, so changing the cap on one host fails here instead of moving the boundary along.
  // The cap is a wire contract between the hosts and the sync protocol. Twin: `test_add_attachment_size_cap` in Rust.
  it("accepts an image at the size cap and rejects one byte past it", () => {
    expect(addAttachmentSchema.safeParse({ bytes: pngOfLength(5_242_880) }).success).toBe(true);

    const result = addAttachmentSchema.safeParse({ bytes: pngOfLength(5_242_881) });
    expect(result.error?.issues.map((issue) => issue.message)).toEqual(["validation.attachments.too-large"]);
  });

  it("rejects an unknown format with the format code", () => {
    const result = addAttachmentSchema.safeParse({ bytes: new Uint8Array(ascii("<svg/>")) });
    expect(result.error?.issues.map((issue) => issue.message)).toEqual(["validation.attachments.format"]);
  });
});

function filled(prefix: number[], length: number, fill: number) {
  const bytes = new Uint8Array(length).fill(fill);
  bytes.set(prefix);
  return bytes;
}

// Twin: `test_sniff_conversation_attachment_mime` in `crates/koloda/tests/domain/attachments_tests.rs`.
describe("sniffConversationAttachmentMime", () => {
  it.each([
    ["png", [...PNG_SIGNATURE, 0, 0], "image/png"],
    ["pdf", ascii("%PDF-1.7\n%\xe2"), "application/pdf"],
    ["pdf with a NUL byte", [...ascii("%PDF-1.4\n"), 0], "application/pdf"],
    ["ascii text", ascii("word,translation\n"), "text/plain"],
    ["multibyte utf-8", [...new TextEncoder().encode("Привет, мир\n")], "text/plain"],
    ["utf-8 with a byte order mark", [0xef, 0xbb, 0xbf, ...ascii("notes")], "text/plain"],
    ["svg is text", ascii("<svg/>"), "text/plain"],
    ["text with a NUL byte", ascii("a\0b"), undefined],
    ["invalid utf-8", [0x61, 0xc3, 0x28], undefined],
    ["utf-8 cut mid-character", [0x61, 0xd0], undefined],
    ["empty", [], undefined],
  ])("%s", (_, bytes, expected) => {
    expect(sniffConversationAttachmentMime(new Uint8Array(bytes))).toBe(expected);
  });
});

// WHY: literals, not the constants, so changing a cap on one host fails here instead of moving the boundary along.
// Twin: `test_add_conversation_attachment_caps` in Rust.
describe("addConversationAttachmentSchema", () => {
  const messages = (bytes: Uint8Array<ArrayBuffer>) =>
    addConversationAttachmentSchema.safeParse({ bytes }).error?.issues.map((issue) => issue.message) ?? [];

  it.each([
    ["pdf at the cap", filled(ascii("%PDF-"), 20_971_520, 0x20), []],
    [
      "pdf past the cap",
      filled(ascii("%PDF-"), 20_971_521, 0x20),
      ["validation.conversation-attachments.pdf-too-large"],
    ],
    ["text at the cap", filled([], 1_048_576, 0x61), []],
    ["text past the cap", filled([], 1_048_577, 0x61), ["validation.conversation-attachments.text-too-large"]],
    ["image at the card cap", pngOfLength(5_242_880), []],
    ["image past the card cap", pngOfLength(5_242_881), ["validation.attachments.too-large"]],
    ["binary bytes", new Uint8Array([0x61, 0, 0x62]), ["validation.conversation-attachments.format"]],
  ])("%s", (_, bytes, expected) => {
    expect(messages(bytes)).toEqual(expected);
  });
});
