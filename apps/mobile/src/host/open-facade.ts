import { KolodaMobile } from "@koloda/mobile-native";
import { Directory, File, Paths } from "expo-file-system";
import type { KolodaFacade } from "./facade";
import { toAppError } from "./facade";

// WHY: Rust works on filesystem paths, and expo-file-system names locations as `file://` URIs.
function toPath(uri: string): string {
  return decodeURI(uri.replace(/^file:\/\//, ""));
}

export function imageCacheDir(): string {
  return toPath(new Directory(Paths.cache, "card-images").uri);
}

export function openFacade(): KolodaFacade {
  try {
    return new KolodaMobile(toPath(new File(Paths.document, "koloda.db").uri));
  } catch (error) {
    throw toAppError(error);
  }
}
