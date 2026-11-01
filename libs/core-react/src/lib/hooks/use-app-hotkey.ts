import type { HotkeyEntry } from "@koloda/app";
import { getHotkeyManager, parseHotkey, rawHotkeyToParsedHotkey } from "@tanstack/react-hotkeys";
import type {
  HotkeyCallback,
  HotkeyOptions,
  HotkeyRegistrationHandle,
  RegisterableHotkey,
} from "@tanstack/react-hotkeys";
import { useAtomValue } from "jotai";
import { useEffect, useEffectEvent, useRef } from "react";
import type { AppHotkeyScope, RuntimeScope } from "./use-hotkeys-status";
import { hotkeysScopesAtom } from "./use-hotkeys-status";

export function useAppHotkey(
  hotkeys: HotkeyEntry,
  callback: HotkeyCallback,
  scope: AppHotkeyScope,
  options?: HotkeyOptions,
) {
  const hotkeyManager = getHotkeyManager();
  const scopes = useAtomValue(hotkeysScopesAtom);
  const handles = useRef<Registration[]>([]);

  const onHotkeysChange = useEffectEvent((updated: HotkeyEntry) => {
    handles.current.forEach(({ handle }) => handle.unregister());
    handles.current = updated.map((hotkey) => ({
      hotkey,
      handle: hotkeyManager.register(hotkey, callback, getOptions(hotkey, options, scope, scopes)),
    }));
  });

  const onCallbackChange = useEffectEvent((updated: HotkeyCallback) => {
    handles.current.forEach(({ handle }) => (handle.callback = updated));
  });

  const onOptionsChange = useEffectEvent((updated?: HotkeyOptions) => {
    setHandlesOptions(handles.current, updated, scope, scopes);
  });

  const onScopeChange = useEffectEvent((updated: AppHotkeyScope) => {
    setHandlesOptions(handles.current, options, updated, scopes);
  });

  const onScopesChange = useEffectEvent((updated: Record<RuntimeScope, boolean>) => {
    setHandlesOptions(handles.current, options, scope, updated);
  });

  useEffect(() => {
    onHotkeysChange(hotkeys);
  }, [hotkeys]);

  useEffect(() => {
    onCallbackChange(callback);
  }, [callback]);

  useEffect(() => {
    onOptionsChange(options);
  }, [options]);

  useEffect(() => {
    onScopeChange(scope);
  }, [scope]);

  useEffect(() => {
    onScopesChange(scopes);
  }, [scopes]);

  useEffect(() => {
    return () => {
      handles.current.forEach(({ handle }) => {
        handle.unregister();
      });
      handles.current = [];
    };
  }, []);

  return null;
}

type Registration = { hotkey: RegisterableHotkey; handle: HotkeyRegistrationHandle };

function setHandlesOptions(
  handles: Registration[],
  options: HotkeyOptions | undefined,
  scope: AppHotkeyScope,
  scopes: Record<RuntimeScope, boolean>,
) {
  handles.forEach(({ hotkey, handle }) => handle.setOptions(getOptions(hotkey, options, scope, scopes)));
}

function getOptions(
  hotkey: RegisterableHotkey,
  options: HotkeyOptions | undefined,
  scope: AppHotkeyScope,
  scopes: Record<RuntimeScope, boolean>,
) {
  const { enabled = true, ignoreInputs } = options || {};
  // WHY: a hotkey meant to work in a text field still must not take a typed character, so it fires there only
  // through a chord; a user who binds it to a single letter keeps typing that letter (HOTKEYS.md (§Key Bindings)).
  const resolved = { ...options, ignoreInputs: ignoreInputs === false && !isChord(hotkey) ? true : ignoreInputs };
  if (!scope) return { ...resolved, enabled };
  return { ...resolved, enabled: enabled && !!scopes[scope] };
}

function isChord(hotkey: RegisterableHotkey) {
  const parsed = typeof hotkey === "string" ? parseHotkey(hotkey) : rawHotkeyToParsedHotkey(hotkey);
  return parsed.ctrl || parsed.alt || parsed.meta || parsed.key === "Escape";
}
