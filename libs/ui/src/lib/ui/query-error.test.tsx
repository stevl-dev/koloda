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
  it("shows the catalog message for an AppError", () => {
    render(<QueryError error={new AppError("db.get")} />);

    expect(screen.getByText("db.get")).toBeTruthy();
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
