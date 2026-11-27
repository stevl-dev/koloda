import { useTimestampFormatter } from "@koloda/core-react";
import type { SyncQueries } from "@koloda/core-react";
import { AlertIcon, Button, RefreshIcon, SuccessIcon, Tooltip } from "@koloda/ui";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useQuery } from "@tanstack/react-query";
import { tv } from "tailwind-variants";
import { useSyncStopMessage } from "./sync-messages";
import { isSyncIndicatorShown, needsSyncAttention } from "./sync-rules";

const indicatorIcon = tv({
  base: "size-5 min-w-5",
  variants: {
    isSpinning: { true: "motion:animate-spin" },
  },
  defaultVariants: {
    isSpinning: false,
  },
});

export type SyncIndicatorProps = { sync: SyncQueries; onOpen: () => void };

export function SyncIndicator({ sync, onOpen }: SyncIndicatorProps) {
  const { _ } = useLingui();
  const formatTimestamp = useTimestampFormatter();
  const stopMessage = useSyncStopMessage();
  const { data: status } = useQuery(sync.getStatusQuery());

  if (!status || !isSyncIndicatorShown(status)) return null;

  const { state, lastSuccessAt, hold, isOverQuota } = status;
  const isAttention = needsSyncAttention(status);
  const isBusy = state.type === "syncing" || state.type === "bootstrapping";
  const lastSync = lastSuccessAt === null ? null : formatTimestamp(new Date(lastSuccessAt), "datetime");
  const label =
    stopMessage(status) ??
    (state.type === "importPending"
      ? _(msg`settings.sync.indicator.choice`)
      : hold !== null
        ? _(msg`settings.sync.indicator.held`)
        : isOverQuota
          ? _(msg`settings.sync.over-quota`)
          : state.type === "syncing"
            ? _(msg`settings.sync.state.syncing`)
            : state.type === "bootstrapping"
              ? _(msg`settings.sync.state.bootstrapping`)
              : lastSync === null
                ? _(msg`settings.sync.state.idle`)
                : _(msg`settings.sync.last-sync ${lastSync}`));
  const Icon = isAttention ? AlertIcon : isBusy ? RefreshIcon : SuccessIcon;

  return (
    <Tooltip content={label}>
      <Button variants={{ style: "ghost", size: "smallIcon" }} aria-label={label} onPress={onOpen}>
        <Icon className={indicatorIcon({ isSpinning: isBusy && !isAttention })} strokeWidth={1.75} aria-hidden="true" />
      </Button>
    </Tooltip>
  );
}
