import type { ErrorCode } from "@koloda/app";
import { AppError } from "@koloda/app";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QueryError } from "./query-error";

vi.mock("@lingui/react", () => ({
  useLingui: () => ({
    _: (message: { toString(): string }) => message.toString(),
  }),
}));

describe("QueryError", () => {
  it("falls back to unknown when the error code is missing from the catalog", () => {
    const error = new AppError("not-in-catalog" as ErrorCode);

    render(<QueryError error={error} />);

    expect(screen.getByText("unknown")).toBeTruthy();
  });

  it("shows the catalog message and keeps AppError details behind the details control", () => {
    render(<QueryError error={new AppError("db.get", "SQLITE_BUSY")} />);

    expect(screen.getByText("db.get")).toBeTruthy();
    expect(screen.queryByText("SQLITE_BUSY")).toBeNull();
    expect(screen.getByRole("button", { name: "error.details" })).toBeTruthy();
  });

  it("does not offer details when AppError has none", () => {
    render(<QueryError error={new AppError("db.get")} />);

    expect(screen.getByText("db.get")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "error.details" })).toBeNull();
  });

  it("resolves unlisted ai.http codes through the shared descriptor instead of unknown", () => {
    render(<QueryError error={new AppError("ai.http.418" as ErrorCode)} />);

    expect(screen.getByText("ai.http 418")).toBeTruthy();
    expect(screen.queryByText("unknown")).toBeNull();
  });

  it("treats a plain Error message as technical details, not the headline", () => {
    render(<QueryError error={new Error("network down")} />);

    expect(screen.getByText("query-error.message")).toBeTruthy();
    expect(screen.queryByText("network down")).toBeNull();
    expect(screen.getByRole("button", { name: "error.details" })).toBeTruthy();
  });

  it("ignores presses while a retry runs and accepts one again after it settles", async () => {
    vi.useFakeTimers();
    let settleRetry = () => {};
    const onRetry = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          settleRetry = resolve;
        }),
    );
    render(<QueryError error={new AppError("db.get")} onRetry={onRetry} />);
    const retry = screen.getByRole("button", { name: "query-error.retry" });

    fireEvent.click(retry);
    await act(() => vi.advanceTimersByTimeAsync(125));
    expect(onRetry).toHaveBeenCalledTimes(1);

    fireEvent.click(retry);
    await act(() => vi.advanceTimersByTimeAsync(125));
    expect(onRetry).toHaveBeenCalledTimes(1);

    await act(async () => settleRetry());
    fireEvent.click(retry);
    await act(() => vi.advanceTimersByTimeAsync(125));
    expect(onRetry).toHaveBeenCalledTimes(2);
  });
});
