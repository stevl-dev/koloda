import { KolodaMobile } from "@koloda/mobile-native";
import { File, Paths } from "expo-file-system";
import type { KolodaFacade } from "./facade";
import { toAppError } from "./facade";

// WHY: Rust opens a filesystem path, and expo-file-system names locations as `file://` URIs.
function documentPath(name: string): string {
  return decodeURI(new File(Paths.document, name).uri.replace(/^file:\/\//, ""));
}

export function openFacade(): KolodaFacade {
  try {
    return new KolodaMobile(documentPath("koloda.db"));
  } catch (error) {
    throw toAppError(error);
  }
}
