import type { AIRuntime } from "@koloda/ai";
import { atom } from "jotai";

// INVARIANT: every host sets this before the first render, so readers never see the empty value.
// WHY: typed as `AIRuntime`, not `null!`: `never` fits Jotai's read-function overload and makes a read-only atom.
export const aiRuntimeAtom = atom(null as unknown as AIRuntime);
