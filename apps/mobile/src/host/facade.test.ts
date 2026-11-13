import { AppError } from "@koloda/app";
import { read } from "./facade";

describe("read", () => {
  it("rebuilds the app error a façade call rejects with", async () => {
    const rejection = { tag: "App", inner: { code: "db.get", details: "no such table" } };

    const error = await read(() => Promise.reject(rejection)).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: "db.get", details: "no such table" });
  });

  it("reports any other failure as unknown, with its message", async () => {
    const error = await read(() => Promise.reject(new Error("JSI call failed"))).catch((e: unknown) => e);

    expect(error).toMatchObject({ code: "unknown", details: "JSI call failed" });
  });

  it("revives timestamp fields of a successful result", async () => {
    const result = await read<{ dueAt: Date }>(() => Promise.resolve('{"dueAt":"2026-11-13T10:00:00.000Z"}'));

    expect(result.dueAt).toEqual(new Date("2026-11-13T10:00:00.000Z"));
  });
});
