import { getAppPlatform } from "@koloda/app";
import {
  WINDOW_MAXIMIZE_CHANNEL,
  WINDOW_SET_TITLE_BAR_OVERLAY_CHANNEL,
  WINDOW_SET_WINDOW_BUTTON_POSITION_CHANNEL,
} from "@koloda/native-ipc";
import type { TitlebarOverlayOptions, WindowButtonPositionOptions } from "@koloda/native-ipc";
import { syncQueriesAtom } from "@koloda/core-react";
import { SyncIndicator } from "@koloda/settings-react";
import { Titlebar as TitlebarContent } from "@koloda/ui";
import { useNavigate } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { useEffect, useRef } from "react";

const platform = getAppPlatform();

// WHY: macOS traffic lights sit at a fixed spot on the left (main's trafficLightPosition).
// Elsewhere the window controls overlay reports its free area as titlebar-area-* env
// variables. Linux places the controls by the desktop's layout (left, right, or only a
// close button on GNOME), so a fixed right inset would overlap them or leave a gap.
// The fallbacks apply when the overlay is hidden, e.g. in fullscreen.
const titlebarContent =
  platform === "macos"
    ? "flex items-center h-full w-full pl-[64px]"
    : "flex items-center h-full ml-[env(titlebar-area-x,0px)] w-[env(titlebar-area-width,100%)]";

const titlebar = [
  "relative flex flex-col shrink-0",
  "h-(--titlebar-height) w-full border-b-2 border-main bg-level-1",
  "box-content select-none [-webkit-user-select:none]",
].join(" ");

export function Titlebar() {
  const sync = useAtomValue(syncQueriesAtom);
  const navigate = useNavigate();
  const titlebarRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<TitlebarOverlayOptions | undefined>(undefined);
  const windowButtonPositionRef = useRef<WindowButtonPositionOptions | undefined>(undefined);

  useEffect(() => {
    let rafId = 0;

    function scheduleUpdateWindowControls() {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        updateWindowControls();
      });
    }

    function updateWindowControls() {
      const el = titlebarRef.current;
      if (!el) return;

      if (platform === "macos") updateWindowButtonPosition(el);
      // WHY: also on macOS, which has no overlay: the message carries the native window background, which main
      // applies and saves for the next start.
      updateOverlay(el);
    }

    function updateWindowButtonPosition(el: HTMLElement) {
      const nextPosition = { titlebarHeight: getTitlebarNativeContentHeight(el) };
      const currentPosition = windowButtonPositionRef.current;
      if (currentPosition?.titlebarHeight === nextPosition.titlebarHeight) return;

      windowButtonPositionRef.current = nextPosition;
      void window.electronAPI.invoke(WINDOW_SET_WINDOW_BUTTON_POSITION_CHANNEL, nextPosition);
    }

    function updateOverlay(el: HTMLElement) {
      const rootStyle = getComputedStyle(document.documentElement);
      // WHY: Electron titleBarOverlay only accepts rgba/hsla/hex — use dedicated hex tokens. Each theme bakes them in
      // as hex (agents/ADD-COLOR-THEME.md §4), so a missing or non-hex token skips the update instead of sampling.
      const color = toHexColor(rootStyle.getPropertyValue("--titlebar-overlay-color").trim());
      const symbolColor = toHexColor(rootStyle.getPropertyValue("--titlebar-overlay-symbol-color").trim());
      const height = getTitlebarNativeContentHeight(el);

      if (!color || !symbolColor) return;

      const nextOverlay = { color, symbolColor, height };
      const currentOverlay = overlayRef.current;
      if (
        currentOverlay &&
        currentOverlay.color === nextOverlay.color &&
        currentOverlay.symbolColor === nextOverlay.symbolColor &&
        currentOverlay.height === nextOverlay.height
      ) {
        return;
      }

      overlayRef.current = nextOverlay;
      void window.electronAPI.invoke(WINDOW_SET_TITLE_BAR_OVERLAY_CHANNEL, nextOverlay);
    }

    const classObserver = new MutationObserver(scheduleUpdateWindowControls);
    classObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-light-theme", "data-dark-theme"],
    });

    const resizeObserver = new ResizeObserver(scheduleUpdateWindowControls);
    const el = titlebarRef.current;
    if (el) resizeObserver.observe(el);

    window.addEventListener("resize", scheduleUpdateWindowControls);
    const unsubscribeZoomFactorChanged = window.electronAPI.onZoomFactorChanged(scheduleUpdateWindowControls);

    scheduleUpdateWindowControls();

    return () => {
      cancelAnimationFrame(rafId);
      classObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleUpdateWindowControls);
      unsubscribeZoomFactorChanged();
    };
  }, []);

  // WHY: handled on the bar itself, not on a full-size overlay. Since Electron 44 an overlay
  // over the bar counts as drag area on top of the no-drag buttons, and they stop taking clicks.
  const handleDragDoubleClick = (event: React.MouseEvent) => {
    if (event.target instanceof Element && event.target.closest("button")) return;
    void window.electronAPI.invoke(WINDOW_MAXIMIZE_CHANNEL);
  };

  return (
    <div
      className={titlebar}
      data-react-aria-top-layer
      style={{ appRegion: "drag" } as React.CSSProperties}
      ref={titlebarRef}
      onDoubleClick={handleDragDoubleClick}
    >
      <div className={titlebarContent}>
        <TitlebarContent />
        {sync && (
          <div className="relative z-100 pr-3 [-webkit-app-region:no-drag]">
            <SyncIndicator sync={sync} onOpen={() => navigate({ to: "/settings/sync" })} />
          </div>
        )}
      </div>
    </div>
  );
}

function getTitlebarNativeContentHeight(el: HTMLElement) {
  const contentHeight = parseFloat(getComputedStyle(el).height);
  const height = Number.isNaN(contentHeight) ? el.clientHeight : contentHeight;
  return Math.round(height * window.electronAPI.getZoomFactor());
}

function toHexColor(value: string) {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    const [, r, g, b] = value;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return "";
}
