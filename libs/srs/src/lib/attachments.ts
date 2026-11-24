import { z } from "zod";

export const ATTACHMENT_MAX_BYTES = 5_242_880;

export const ATTACHMENT_MIMES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"] as const;

export type AttachmentMime = (typeof ATTACHMENT_MIMES)[number];

// INVARIANT: the id is the lowercase hex SHA-256 of the bytes; nothing else is a ref.
export const ATTACHMENT_REF_PATTERN = /^attachment:([0-9a-f]{64})$/;

export const attachmentRowSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{64}$/),
  mime: z.enum(ATTACHMENT_MIMES),
  size: z.int().nonnegative(),
  width: z.int().positive().nullable(),
  height: z.int().positive().nullable(),
  createdAt: z.date(),
});

export type Attachment = z.infer<typeof attachmentRowSchema>;

export type AttachmentContent = Attachment & { bytes: Uint8Array<ArrayBuffer> };

export type SweepAttachmentsData = { createdBefore: Date };

function addSchemaChecking(getBytesError: (bytes: Uint8Array) => string | undefined) {
  return z.object({
    // WHY: Web Crypto and Blob take only ArrayBuffer-backed views, not shared memory.
    bytes: z
      .custom<Uint8Array<ArrayBuffer>>((value) => value instanceof Uint8Array && value.buffer instanceof ArrayBuffer)
      .superRefine((bytes, ctx) => {
        const code = getBytesError(bytes);
        if (code) ctx.addIssue({ code: "custom", message: code });
      }),
    width: z.int().positive().optional(),
    height: z.int().positive().optional(),
  });
}

export const addAttachmentSchema = addSchemaChecking(getAttachmentBytesError);

export type AddAttachmentData = z.infer<typeof addAttachmentSchema>;

// INVARIANT: the conversation store takes images under the card rules, plus PDF and text files
// (docs/decisions/MEDIA-STORAGE.md). Card attachments stay images only.
export const CONVERSATION_PDF_MAX_BYTES = 20_971_520;
export const CONVERSATION_TEXT_MAX_BYTES = 1_048_576;

const CONVERSATION_ATTACHMENT_MIMES = [...ATTACHMENT_MIMES, "application/pdf", "text/plain"] as const;

export type ConversationAttachmentMime = (typeof CONVERSATION_ATTACHMENT_MIMES)[number];

export const conversationAttachmentRowSchema = attachmentRowSchema.extend({
  mime: z.enum(CONVERSATION_ATTACHMENT_MIMES),
});

export type ConversationAttachment = z.infer<typeof conversationAttachmentRowSchema>;

export type ConversationAttachmentContent = ConversationAttachment & { bytes: Uint8Array<ArrayBuffer> };

export const addConversationAttachmentSchema = addSchemaChecking(getConversationAttachmentBytesError);

export function getConversationAttachmentBytesError(bytes: Uint8Array) {
  const mime = sniffConversationAttachmentMime(bytes);
  if (!mime) return "validation.conversation-attachments.format";
  if (mime === "application/pdf") {
    return bytes.byteLength > CONVERSATION_PDF_MAX_BYTES
      ? "validation.conversation-attachments.pdf-too-large"
      : undefined;
  }
  if (mime === "text/plain") {
    return bytes.byteLength > CONVERSATION_TEXT_MAX_BYTES
      ? "validation.conversation-attachments.text-too-large"
      : undefined;
  }
  return getAttachmentBytesError(bytes);
}

// WHY: text has no magic bytes. Any bytes that are not an image or a PDF count as text when they decode as UTF-8 and hold
// no NUL byte, which no text file has and most binary files do. An empty file is no file of any kind.
// Twin: `sniff_conversation_attachment_mime` in Rust.
export function sniffConversationAttachmentMime(bytes: Uint8Array): ConversationAttachmentMime | undefined {
  const imageMime = sniffImageMime(bytes);
  if (imageMime) return imageMime;
  if (isAscii(bytes, 0, "%PDF-")) return "application/pdf";
  if (bytes.byteLength === 0 || bytes.includes(0)) return undefined;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
  return "text/plain";
}

export function getAttachmentBytesError(bytes: Uint8Array) {
  if (bytes.byteLength > ATTACHMENT_MAX_BYTES) return "validation.attachments.too-large";
  if (!sniffImageMime(bytes)) return "validation.attachments.format";
  return undefined;
}

export function sniffImageMime(bytes: Uint8Array): AttachmentMime | undefined {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (isAscii(bytes, 0, "GIF87a") || isAscii(bytes, 0, "GIF89a")) return "image/gif";
  if (isAscii(bytes, 0, "RIFF") && isAscii(bytes, 8, "WEBP")) return "image/webp";
  if (isAvif(bytes)) return "image/avif";
  return undefined;
}

// WHY: AVIF shares the ISO-BMFF `ftyp` box with HEIC and other formats; only an
// `avif` or `avis` brand (major or compatible) marks it as AVIF.
function isAvif(bytes: Uint8Array) {
  if (bytes.byteLength < 16 || !isAscii(bytes, 4, "ftyp")) return false;
  const size = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0);
  if (size < 16 || size > bytes.byteLength) return false;
  const isAvifBrand = (offset: number) => isAscii(bytes, offset, "avif") || isAscii(bytes, offset, "avis");
  if (isAvifBrand(8)) return true;
  for (let offset = 16; offset + 4 <= size; offset += 4) {
    if (isAvifBrand(offset)) return true;
  }
  return false;
}

function startsWith(bytes: Uint8Array, prefix: number[]) {
  return bytes.byteLength >= prefix.length && prefix.every((byte, i) => bytes[i] === byte);
}

function isAscii(bytes: Uint8Array, offset: number, text: string) {
  if (bytes.byteLength < offset + text.length) return false;
  for (let i = 0; i < text.length; i++) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}
