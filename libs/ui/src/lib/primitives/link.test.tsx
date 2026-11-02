import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { Link } from "./link";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ activeProps: _activeProps, ...props }: ComponentProps<"a"> & { activeProps?: unknown }) => (
    <a href="#" {...props} />
  ),
}));

describe("Link", () => {
  it("runs the caller's key handler once per key press", () => {
    const onKeyDown = vi.fn();
    render(<Link onKeyDown={onKeyDown}>Decks</Link>);

    fireEvent.keyDown(screen.getByRole("link", { name: "Decks" }), { key: "Enter" });

    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it("follows the link on Space unless the caller prevented it", () => {
    const onClick = vi.fn();
    const { rerender } = render(<Link onClick={onClick}>Decks</Link>);
    const link = screen.getByRole("link", { name: "Decks" });

    fireEvent.keyDown(link, { key: " " });
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Link onClick={onClick} onKeyDown={(event) => event.preventDefault()}>
        Decks
      </Link>,
    );
    fireEvent.keyDown(link, { key: " " });
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
