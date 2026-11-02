import { createFocusManager } from "@react-aria/focus";
import { setInteractionModality } from "@react-aria/interactions";

function dispatchTabNavigation(offset: 1 | -1) {
  const activeElement = document.activeElement as HTMLElement | null;
  if (!activeElement) return false;

  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key: "Tab",
    shiftKey: offset < 0,
  });

  activeElement.dispatchEvent(event);
  return event.defaultPrevented;
}

function focusByOffset(offset: 1 | -1) {
  setInteractionModality("keyboard");

  // WHY: Let composite widgets apply their own Tab behavior first (e.g. toolbars).
  if (dispatchTabNavigation(offset)) return;

  const root = document.body;
  if (!root) return;

  const focusManager = createFocusManager({ current: root }, { tabbable: true, wrap: true });
  const activeElement = document.activeElement;

  if (!activeElement || !root.contains(activeElement)) {
    if (offset > 0) {
      focusManager.focusFirst();
    } else {
      focusManager.focusLast();
    }
    return;
  }

  if (offset > 0) {
    focusManager.focusNext({ from: activeElement, wrap: true });
  } else {
    focusManager.focusPrevious({ from: activeElement, wrap: true });
  }
}

export function focusNext(e: KeyboardEvent) {
  e.preventDefault();
  focusByOffset(1);
}

export function focusPrev(e: KeyboardEvent) {
  e.preventDefault();
  focusByOffset(-1);
}

function dispatchArrowKey(item: HTMLElement, group: HTMLElement, offset: 1 | -1) {
  const orientation = group.getAttribute("aria-orientation") || group.getAttribute("data-orientation");
  const isVertical = orientation === "vertical";
  const key = offset > 0 ? (isVertical ? "ArrowDown" : "ArrowRight") : isVertical ? "ArrowUp" : "ArrowLeft";

  item.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

function moveFocusedTab(offset: 1 | -1) {
  const active = document.activeElement as HTMLElement | null;
  if (!active) return false;

  const tab = active.closest<HTMLElement>('[role="tab"]');
  const tabList = tab?.closest<HTMLElement>('[role="tablist"]');
  if (tab && tabList) {
    dispatchArrowKey(tab, tabList, offset);
    return true;
  }

  const radio = active.closest<HTMLElement>('[role="radio"]');
  const radioGroup = radio?.closest<HTMLElement>('[role="radiogroup"]');
  if (radio && radioGroup) {
    dispatchArrowKey(radio, radioGroup, offset);
    return true;
  }

  return false;
}

export function goToNextTab(e: KeyboardEvent) {
  if (moveFocusedTab(1)) e.preventDefault();
}

export function goToPrevTab(e: KeyboardEvent) {
  if (moveFocusedTab(-1)) e.preventDefault();
}
