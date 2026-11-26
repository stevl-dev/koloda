import type { SyncState, SyncStatus } from "@koloda/app";
import { langAtom, useTimestampFormatter } from "@koloda/core-react";
import { msg, plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useAtomValue } from "jotai";
import { useCallback } from "react";

export const SYNC_STATE_LABELS = {
  notEnrolled: msg`settings.sync.state.not-enrolled`,
  importPending: msg`settings.sync.state.import-pending`,
  bootstrapping: msg`settings.sync.state.bootstrapping`,
  idle: msg`settings.sync.state.idle`,
  syncing: msg`settings.sync.state.syncing`,
  stopped: msg`settings.sync.state.stopped`,
} satisfies Record<SyncState["type"], unknown>;

export type SyncStatusLines = {
  downloadLeft: string | null;
  lastSync: string;
  pending: string | null;
  uploads: string | null;
  fetches: string | null;
};

export function useSyncStatusLines() {
  const { _ } = useLingui();
  const formatTimestamp = useTimestampFormatter();

  return useCallback(
    (status: SyncStatus): SyncStatusLines => {
      const { state, lastSuccessAt, uploads, fetches } = status;
      // WHY: changes the full space refused wait in a hold of their own; to the user they wait to upload all the same.
      const pending = status.pending + status.held;
      // WHY: the two lanes are an engine detail; the user sees one download.
      const left = (status.lagHot ?? 0) + (status.lagCold ?? 0);
      const lastSync = lastSuccessAt === null ? null : formatTimestamp(new Date(lastSuccessAt), "datetime");
      return {
        downloadLeft:
          state.type === "bootstrapping" && left > 0
            ? _(msg`${plural(left, { other: "settings.sync.download-left" })}`)
            : null,
        lastSync:
          lastSync === null ? _(msg`settings.sync.last-sync.none`) : _(msg`settings.sync.last-sync ${lastSync}`),
        pending: pending > 0 ? _(msg`${plural(pending, { other: "settings.sync.pending" })}`) : null,
        uploads: uploads > 0 ? _(msg`${plural(uploads, { other: "settings.sync.uploads" })}`) : null,
        fetches: fetches > 0 ? _(msg`${plural(fetches, { other: "settings.sync.fetches" })}`) : null,
      };
    },
    [_, formatTimestamp],
  );
}

const MB = 1_000_000;
const GB = 1_000 * MB;

export function useFormatBytes() {
  const locale = useAtomValue(langAtom);
  return useCallback(
    (bytes: number) =>
      new Intl.NumberFormat(locale, {
        style: "unit",
        unit: bytes >= GB ? "gigabyte" : "megabyte",
        maximumFractionDigits: 1,
      }).format(bytes / (bytes >= GB ? GB : MB)),
    [locale],
  );
}

export function useSyncStopMessage() {
  const { _ } = useLingui();
  const formatBytes = useFormatBytes();

  return useCallback(
    ({ state, skewMs }: SyncStatus): string | null => {
      if (state.type !== "stopped") return null;
      const { stop } = state;
      switch (stop.reason) {
        case "clockSkew": {
          const minutes = Math.max(1, Math.round(Math.abs(skewMs) / 60_000));
          return _(msg`${plural(minutes, { other: "settings.sync.stop.clock-skew" })}`);
        }
        case "revoked":
          return _(msg`settings.sync.left`);
        case "unknownDevice":
          return _(msg`settings.sync.stop.unknown-device`);
        case "restored":
          return _(msg`settings.sync.stop.pair-again`);
        case "authoritativeRestore":
          return _(msg`settings.sync.stop.authoritative-restore`);
        case "lowDisk": {
          const needed = formatBytes(stop.needed);
          const free = formatBytes(stop.free);
          return _(msg`settings.sync.stop.low-disk ${needed} ${free}`);
        }
        case "pushRefused": {
          const code = stop.code;
          return _(msg`settings.sync.stop.push-refused ${code}`);
        }
        case "unreachable":
          return _(msg`settings.sync.stop.unreachable`);
        case "updateRequired":
          return _(msg`settings.sync.stop.update-required`);
        // WHY: the engine's text is a developer's English diagnostic; Settings → Sync shows it as details.
        case "error":
          return _(msg`settings.sync.stop.error`);
      }
    },
    [_, formatBytes],
  );
}
