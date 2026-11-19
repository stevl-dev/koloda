import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAutoScroll } from "./use-auto-scroll";

const SCROLL_HEIGHT = 1000;
const CLIENT_HEIGHT = 200;
const BOTTOM = SCROLL_HEIGHT - CLIENT_HEIGHT;

function renderAutoScroll() {
  const viewport = document.createElement("div");
  Object.defineProperty(viewport, "scrollHeight", { configurable: true, value: SCROLL_HEIGHT });
  Object.defineProperty(viewport, "clientHeight", { configurable: true, value: CLIENT_HEIGHT });
  Object.defineProperty(viewport, "scrollTop", { configurable: true, writable: true, value: BOTTOM });
  const scrollTo = vi.fn();
  viewport.scrollTo = scrollTo as typeof viewport.scrollTo;

  const hook = renderHook((props) => useAutoScroll(props), {
    initialProps: { messages: ["Hi"] as unknown[], isLoading: false },
  });
  hook.result.current.scrollViewportRef.current = viewport;

  const fireScroll = (distanceFromBottom: number) => {
    viewport.scrollTop = BOTTOM - distanceFromBottom;
    act(() => hook.result.current.handleScroll());
  };
  return { ...hook, viewport, scrollTo, fireScroll };
}

describe("useAutoScroll", () => {
  it("counts 80 pixels from the bottom as near and hides the jump button only there", () => {
    const { result, fireScroll } = renderAutoScroll();

    fireScroll(81);
    expect(result.current.showJumpToLatest).toBe(true);

    fireScroll(80);
    expect(result.current.showJumpToLatest).toBe(false);
  });

  it("ignores scroll events while a jump to the latest message is still scrolling", () => {
    const { result, fireScroll } = renderAutoScroll();
    fireScroll(500);
    expect(result.current.showJumpToLatest).toBe(true);

    act(() => result.current.handleScrollToLatest());
    // The smooth scroll passes through positions far from the bottom.
    fireScroll(300);
    expect(result.current.showJumpToLatest).toBe(false);

    // Once it arrives, the user's own scrolling counts again.
    fireScroll(0);
    fireScroll(300);
    expect(result.current.showJumpToLatest).toBe(true);
  });

  it.each([
    { distanceFromBottom: 80, isFollowing: true },
    { distanceFromBottom: 81, isFollowing: false },
  ])(
    "follows the next message after a submit $distanceFromBottom pixels from the bottom: $isFollowing",
    ({ distanceFromBottom, isFollowing }) => {
      const { result, rerender, viewport, scrollTo } = renderAutoScroll();
      viewport.scrollTop = BOTTOM - distanceFromBottom;

      let isFollowingAtSubmit = false;
      act(() => {
        isFollowingAtSubmit = result.current.prepareSubmit();
      });
      scrollTo.mockClear();
      rerender({ messages: ["Hi", "Hello"], isLoading: true });

      expect(isFollowingAtSubmit).toBe(isFollowing);
      expect(scrollTo).toHaveBeenCalledTimes(isFollowing ? 1 : 0);
    },
  );
});
