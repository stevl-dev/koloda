import type { SyncDevice, SyncStatus } from "@koloda/app";
import { atom } from "jotai";
import { useEffect, useState } from "react";

const CODE_GROUP = /(.{5})(?=.)/g;

// WHY: the join's probe count reaches the choice through here: the join dialog closes once the status says the choice
// waits. It exists only in the session that joined; a choice shown after a restart has none.
export const syncKnownIdsAtom = atom<number | null>(null);

// WHY: a device that never joined a space, or that left one, chose not to sync; every other state shows an indicator,
// so a stop that needs the user is seen outside Settings.
export function isSyncIndicatorShown({ state }: SyncStatus) {
  return state.type !== "notEnrolled" && !(state.type === "stopped" && state.stop.reason === "revoked");
}

export function needsSyncAttention({ state, hold, isOverQuota }: SyncStatus) {
  return state.type === "stopped" || state.type === "importPending" || hold !== null || isOverQuota;
}

// WHY: the file is detached, so only a join brings it back: it left, another device removed it, or a restore left it
// out.
export function hasLeftSpace({ state }: SyncStatus) {
  return state.type === "stopped" && (state.stop.reason === "revoked" || state.stop.reason === "restored");
}

// WHY: the server no longer knows this device, but the file stays attached, and an attached file cannot join;
// leaving works all the same, since the engine takes that answer as a revocation (PROTOCOL.md §Devices).
export function isUnknownDevice({ state }: SyncStatus) {
  return state.type === "stopped" && state.stop.reason === "unknownDevice";
}

// WHY: the space already holds some of this device's items, so its data looks like a copy of the space's.
export function isCopyJoin(knownIds: number | null) {
  return (knownIds ?? 0) > 0;
}

// INVARIANT: offered, never removed on their own. A copy is often the device in use, whose stale old record is the
// one being removed, and a retired device invited the others; only a stolen one makes them suspect.
export function relatedDevices(device: SyncDevice, devices: SyncDevice[]) {
  return devices.filter(
    (other) =>
      !other.isRevoked && !other.isSelf && (other.forkedFromId === device.id || other.pairedById === device.id),
  );
}

export function formatPairingCode(code: string) {
  return code.replace(CODE_GROUP, "$1-");
}

export function pairingSecondsLeft(expiresAt: number, now: number) {
  return Math.max(0, Math.ceil((expiresAt - now) / 1000));
}

export function formatTimeLeft(secondsLeft: number) {
  return `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;
}

export function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
