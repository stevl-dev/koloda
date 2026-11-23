import { AppError } from "@koloda/app";
import type { AddAttachmentData } from "@koloda/srs";
import { ATTACHMENT_MAX_BYTES, getAttachmentBytesError, sniffImageMime } from "@koloda/srs";

// INVARIANT: the checks the repos run again on every add (docs/decisions/MEDIA-STORAGE.md), run here first for fast
// feedback, plus a decode only the browser can do. Shared by the card editor and the assistant composer.
export async function readImageFile(file: File): Promise<AddAttachmentData> {
  if (file.size > ATTACHMENT_MAX_BYTES) throw new AppError("validation.attachments.too-large");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const code = getAttachmentBytesError(bytes);
  if (code) throw new AppError(code);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new AppError("validation.attachments.format");
  }
  const { width, height } = bitmap;
  bitmap.close();
  return { bytes, width, height };
}

export function getImageFiles(files: FileList | null) {
  return Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
}

// WHY: browsers type a dropped or picked file by its name, so an image without an image extension arrives with an
// empty or generic type. Its contents decide whether it is an image (MEDIA.md §Formats and Size).
const UNTYPED_FILE_TYPES = ["", "application/octet-stream"];

// WHY: the format sits in the first bytes; a large untyped file that is not an image is never read whole.
const SNIFF_SLICE_BYTES = 4096;

export function isDroppableFileType(type: string) {
  return type.startsWith("image/") || UNTYPED_FILE_TYPES.includes(type);
}

export async function shouldInsertDroppedFile(file: File) {
  if (!UNTYPED_FILE_TYPES.includes(file.type)) return true;
  return !!sniffImageMime(new Uint8Array(await file.slice(0, SNIFF_SLICE_BYTES).arrayBuffer()));
}
