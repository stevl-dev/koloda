import { describe, expect, it } from "vitest";
import { AppError } from "@koloda/app";
import { AIError } from "./error";
import { formatGenerateError, toAIAppError } from "./error-ai";

describe("ai-error", () => {
  const translate = ((message: string) => message) as Parameters<typeof formatGenerateError>[1];

  it("keeps an AI error's message as details only when it says more than the code", () => {
    const bare = toAIAppError(new AIError("ai.network"));
    expect(bare).toMatchObject({ code: "ai.network" });
    expect((bare as AppError).details).toBeUndefined();
    expect(toAIAppError(new AIError("ai.network", "network down"))).toMatchObject({
      code: "ai.network",
      details: "network down",
    });
  });

  it("translates a stored generate error code and keeps details separate", () => {
    expect(formatGenerateError({ message: "ai.http.401", details: "Unauthorized" }, translate)).toEqual({
      message: "ai.http.401",
      details: "Unauthorized",
    });
  });

  it("treats a legacy flattened display string as details behind unknown", () => {
    expect(formatGenerateError({ message: "Provider aborted the request" }, translate)).toEqual({
      message: "unknown",
      details: "Provider aborted the request",
    });
  });

  it("does not promote unknown AppError details into the headline", () => {
    expect(formatGenerateError(new AppError("unknown", "SQLITE_BUSY"), translate)).toEqual({
      message: "unknown",
      details: "SQLITE_BUSY",
    });
  });
});
