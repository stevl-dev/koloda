import { modelAcceptsImages, modelAcceptsPdf } from "@koloda/ai";
import type { AIModel, AIProfile } from "@koloda/ai";
import { AppError } from "@koloda/app";
import { readImageFile } from "@koloda/core-react";
import {
  ATTACHMENT_MIMES,
  CONVERSATION_PDF_MAX_BYTES,
  CONVERSATION_TEXT_MAX_BYTES,
  sniffConversationAttachmentMime,
  sniffImageMime,
} from "@koloda/srs";
import type { AddAttachmentData } from "@koloda/srs";

export type ConversationFileKind = "image" | "pdf" | "text";

/** A model's answer for one input kind (AI-MODEL-INPUT.md); text goes to every model, so it has none. */
export type InputState = "enabled" | "unsupported" | "unknown";

/** Per input kind; `null` when no model is selected, which hides the attach button. */
export type InputStates = Record<Exclude<ConversationFileKind, "text">, InputState> | null;

export function getInputStates(
  modelId: string,
  model: AIModel | undefined,
  profile: Pick<AIProfile, "imageInputModelIds" | "pdfInputModelIds"> | undefined,
): InputStates {
  if (!modelId) return null;
  // WHY: a selected model missing from the list (AI-PROVIDERS.md §Allowlist) says nothing, so it is unknown.
  const known = model ?? { id: modelId, name: modelId, context_length: 0 };
  const state = (isAccepted: boolean, providerAnswer: boolean | undefined): InputState => {
    if (isAccepted) return "enabled";
    return providerAnswer === false ? "unsupported" : "unknown";
  };
  return {
    image: state(modelAcceptsImages(known, profile?.imageInputModelIds), known.has_image_input),
    pdf: state(modelAcceptsPdf(known, profile?.pdfInputModelIds), known.has_pdf_input),
  };
}

const PDF_MIME = "application/pdf";
const TEXT_EXTENSIONS = [".txt", ".md", ".markdown", ".csv"];

/** What the file picker offers: every kind, so a refused one can say why instead of being hidden. */
export const ATTACHABLE_FILE_TYPES = [...ATTACHMENT_MIMES, PDF_MIME, "text/*", ...TEXT_EXTENSIONS];

// WHY: browsers type a picked or dropped file by its name, so an image without an image extension arrives with an
// empty or generic type. Its contents decide whether it is an image (MEDIA.md §Formats and Size).
const UNTYPED_FILE_TYPES = ["", "application/octet-stream"];

// WHY: the format sits in the first bytes; a large untyped file that is not an image is never read whole.
const SNIFF_SLICE_BYTES = 4096;

function hasExtension(file: File, extensions: readonly string[]) {
  const name = file.name.toLowerCase();
  return extensions.some((extension) => name.endsWith(extension));
}

/**
 * The kind a file claims by its type or name; `null` for a file of no accepted kind.
 * An untyped file with no known extension is an image only if its first bytes say so.
 */
export async function getConversationFileKind(file: File): Promise<ConversationFileKind | null> {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === PDF_MIME || hasExtension(file, [".pdf"])) return "pdf";
  if (file.type.startsWith("text/") || hasExtension(file, TEXT_EXTENSIONS)) return "text";
  if (!UNTYPED_FILE_TYPES.includes(file.type)) return null;
  return sniffImageMime(new Uint8Array(await file.slice(0, SNIFF_SLICE_BYTES).arrayBuffer())) ? "image" : null;
}

export function isUntypedFile(file: File) {
  return UNTYPED_FILE_TYPES.includes(file.type);
}

const KIND_LIMITS = {
  pdf: {
    maxBytes: CONVERSATION_PDF_MAX_BYTES,
    mime: PDF_MIME,
    tooLarge: "validation.conversation-attachments.pdf-too-large",
  },
  text: {
    maxBytes: CONVERSATION_TEXT_MAX_BYTES,
    mime: "text/plain",
    tooLarge: "validation.conversation-attachments.text-too-large",
  },
} as const;

// INVARIANT: the checks the repos run again on every add (docs/decisions/MEDIA-STORAGE.md), run here first for fast
// feedback. A file must also be the kind it claims: a `.pdf` that is text is refused, not stored as text.
export async function readConversationFile(file: File, kind: ConversationFileKind): Promise<AddAttachmentData> {
  if (kind === "image") return readImageFile(file);
  const { maxBytes, mime, tooLarge } = KIND_LIMITS[kind];
  if (file.size > maxBytes) throw new AppError(tooLarge);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (sniffConversationAttachmentMime(bytes) !== mime) throw new AppError("validation.conversation-attachments.format");
  return { bytes };
}

export function getConversationFileKindOfMime(mediaType: string): ConversationFileKind {
  if (mediaType.startsWith("image/")) return "image";
  return mediaType === PDF_MIME ? "pdf" : "text";
}
