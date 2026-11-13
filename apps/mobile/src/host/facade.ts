import { AppError } from "@koloda/app";
import type { ErrorCode } from "@koloda/app";
import type { KolodaMobileLike } from "@koloda/mobile-native";
import { fromWire, toWire } from "./wire";

// WHY: type-only, so the screens and their Jest tests never load the native module; `open-facade.ts` does.
export type KolodaFacade = KolodaMobileLike;

type MobileErrorShape = { tag: "App"; inner: { code: string; details?: string } };

function isMobileError(error: unknown): error is MobileErrorShape {
  if (typeof error !== "object" || error === null) return false;
  const { tag, inner } = error as Partial<MobileErrorShape>;
  return tag === "App" && typeof inner?.code === "string";
}

export function toAppError(error: unknown): AppError {
  if (isMobileError(error)) return new AppError(error.inner.code as ErrorCode, error.inner.details);
  return new AppError("unknown", error instanceof Error ? error.message : String(error));
}

export function wireArgs(args: unknown): string {
  return JSON.stringify(toWire(args));
}

export async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toAppError(error);
  }
}

export async function read<T>(run: () => Promise<string>): Promise<T> {
  const json = await call(run);
  return fromWire<T>(JSON.parse(json));
}
