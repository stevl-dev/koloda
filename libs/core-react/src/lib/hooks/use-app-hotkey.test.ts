// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { createElement } from "react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAppHotkey } from "./use-app-hotkey";
import { useHotkeyScope } from "./use-hotkeys-status";
import type { HotkeyScopeHold, RuntimeScope } from "./use-hotkeys-status";

// WHY: the hotkey manager is a process singleton; unmount every registration between tests.
afterEach(cleanup);

type ScopeOwnerProps = { scope: RuntimeScope; hold: HotkeyScopeHold; isActive: boolean };

function setup() {
  const store = createStore();
  const wrapper = ({ children }: PropsWithChildren) => createElement(Provider, { store }, children);
  const callback = vi.fn();

  renderHook(() => useAppHotkey(["H"], callback, "form"), { wrapper });

  const own = (props: ScopeOwnerProps) =>
    renderHook((current: ScopeOwnerProps) => useHotkeyScope(current.scope, current.hold, current.isActive), {
      wrapper,
      initialProps: props,
    });

  return { callback, own };
}

function pressH() {
  act(() => {
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "h", code: "KeyH", bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent("keyup", { key: "h", code: "KeyH", bubbles: true }));
  });
}

describe("useAppHotkey with scope holds", () => {
  it("stays silent while its scope has no owner", () => {
    const { callback, own } = setup();

    pressH();
    expect(callback).not.toHaveBeenCalled();

    own({ scope: "form", hold: "enable", isActive: true });
    pressH();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("keeps a scope on until its last owner releases it", () => {
    const { callback, own } = setup();

    // An exiting form unmounts after the form that replaced it mounted.
    const exiting = own({ scope: "form", hold: "enable", isActive: true });
    const entering = own({ scope: "form", hold: "enable", isActive: true });
    exiting.unmount();

    pressH();
    expect(callback).toHaveBeenCalledTimes(1);

    entering.unmount();
    pressH();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("holds a scope off while blocked, and gives it back on release or unmount", () => {
    const { callback, own } = setup();
    own({ scope: "form", hold: "enable", isActive: true });
    const block = own({ scope: "form", hold: "block", isActive: true });

    pressH();
    expect(callback).not.toHaveBeenCalled();

    block.rerender({ scope: "form", hold: "block", isActive: false });
    pressH();
    expect(callback).toHaveBeenCalledTimes(1);

    // An inactive blocker that mounts does not switch the scope on or off.
    own({ scope: "form", hold: "block", isActive: false });
    pressH();
    expect(callback).toHaveBeenCalledTimes(2);

    // A blocker that unmounts while active, such as an open Select list, releases its hold.
    block.rerender({ scope: "form", hold: "block", isActive: true });
    pressH();
    expect(callback).toHaveBeenCalledTimes(2);

    block.unmount();
    pressH();
    expect(callback).toHaveBeenCalledTimes(3);
  });
});

describe("useAppHotkey in a text field", () => {
  function pressInTextarea(init: KeyboardEventInit) {
    const textarea = document.createElement("textarea");
    document.body.append(textarea);
    textarea.focus();
    let isNotPrevented = true;
    act(() => {
      isNotPrevented = textarea.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }),
      );
      textarea.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, cancelable: true, ...init }));
    });
    textarea.remove();
    return isNotPrevented;
  }

  it.each([
    { binding: "N", ignoreInputs: false, init: { key: "n", code: "KeyN" }, fires: false },
    { binding: "Mod+N", ignoreInputs: false, init: { key: "n", code: "KeyN", ctrlKey: true }, fires: true },
    { binding: "Alt+N", ignoreInputs: false, init: { key: "n", code: "KeyN", altKey: true }, fires: true },
    { binding: "Escape", ignoreInputs: false, init: { key: "Escape", code: "Escape" }, fires: true },
    { binding: "Mod+H", ignoreInputs: true, init: { key: "h", code: "KeyH", ctrlKey: true }, fires: false },
  ])("$binding with ignoreInputs $ignoreInputs fires: $fires", ({ binding, ignoreInputs, init, fires }) => {
    const callback = vi.fn();
    renderHook(() => useAppHotkey([binding], callback, "", { ignoreInputs }));

    const isNotPrevented = pressInTextarea(init);

    expect(callback).toHaveBeenCalledTimes(fires ? 1 : 0);
    // A hotkey that does not fire leaves the key to the text field.
    expect(isNotPrevented).toBe(!fires);
  });
});
