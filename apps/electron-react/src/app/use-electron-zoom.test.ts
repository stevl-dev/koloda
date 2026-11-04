// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useElectronZoom } from "./use-electron-zoom";

function stubZoomApi() {
  const api = {
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    zoomReset: vi.fn(),
    getZoomLevel: vi.fn(() => 0),
    setZoomLevel: vi.fn(),
    onZoomFactorChanged: vi.fn((_callback: () => void) => () => {}),
  };
  (window as unknown as { electronAPI: typeof api }).electronAPI = api;
  return api;
}

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
  localStorage.clear();
});

describe("useElectronZoom", () => {
  it.each([
    ["scrolling up zooms in", { deltaY: -1 }, "in"],
    ["scrolling down zooms out", { deltaY: 1 }, "out"],
    ["a sideways scroll keeps the zoom", { deltaX: 1 }, "none"],
  ] as const)("with Ctrl, %s", (_name, delta, expected) => {
    const api = stubZoomApi();
    const { unmount } = renderHook(() => useElectronZoom());

    window.dispatchEvent(new WheelEvent("wheel", { ctrlKey: true, cancelable: true, ...delta }));

    expect({ in: api.zoomIn.mock.calls.length, out: api.zoomOut.mock.calls.length }).toEqual({
      in: expected === "in" ? 1 : 0,
      out: expected === "out" ? 1 : 0,
    });
    unmount();
  });

  it.each([
    ["a stored level is applied", "1.5", [[1.5]]],
    ["no stored level keeps the default", null, []],
  ] as const)("at mount, %s", (_name, stored, expected) => {
    if (stored !== null) localStorage.setItem("zoom-level", stored);
    const api = stubZoomApi();
    const { unmount } = renderHook(() => useElectronZoom());

    expect(api.setZoomLevel.mock.calls).toEqual(expected);
    unmount();
  });

  it("remembers the level after each zoom change", () => {
    const api = stubZoomApi();
    api.getZoomLevel.mockReturnValue(2);
    const { unmount } = renderHook(() => useElectronZoom());

    api.onZoomFactorChanged.mock.calls[0][0]();

    expect(localStorage.getItem("zoom-level")).toBe("2");
    unmount();
  });

  it.each([
    ["Ctrl with = zooms in", { key: "=", ctrlKey: true }, "in"],
    ["Ctrl with + zooms in", { key: "+", ctrlKey: true }, "in"],
    ["Ctrl with - zooms out", { key: "-", ctrlKey: true }, "out"],
    ["Ctrl with 0 resets", { key: "0", ctrlKey: true }, "reset"],
    ["Cmd with = zooms in", { key: "=", metaKey: true }, "in"],
    ["= alone keeps the zoom", { key: "=" }, "none"],
  ] as const)("from a focused text field, %s", (_name, init, expected) => {
    const api = stubZoomApi();
    const { unmount } = renderHook(() => useElectronZoom());
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();

    input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));

    expect({
      in: api.zoomIn.mock.calls.length,
      out: api.zoomOut.mock.calls.length,
      reset: api.zoomReset.mock.calls.length,
    }).toEqual({
      in: expected === "in" ? 1 : 0,
      out: expected === "out" ? 1 : 0,
      reset: expected === "reset" ? 1 : 0,
    });
    input.remove();
    unmount();
  });
});
