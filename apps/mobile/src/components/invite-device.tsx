import { formatAppError } from "@koloda/app";
import type { IssuedPairing } from "@koloda/app";
import { formatPairingCode, formatTimeLeft, pairingSecondsLeft, useNow } from "@koloda/settings-react/sync-status";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useMutation } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import { useAppColors } from "../colors";
import { useMobileQueries } from "../host/queries-context";

// INVARIANT: hiding the code does not cancel it; it still expires on its own (SYNC.md §Inviting a Device).
export function InviteDevice() {
  const { _ } = useLingui();
  const colors = useAppColors();
  const { sync } = useMobileQueries();
  const [isOpen, setIsOpen] = useState(false);
  const { mutate, data, error, isPending, reset } = useMutation(sync.issuePairingMutation());

  if (!isOpen) {
    return (
      <Button
        title={_(msg`mobile.sync.invite`)}
        onPress={() => {
          setIsOpen(true);
          mutate();
        }}
      />
    );
  }

  return (
    <View style={styles.panel}>
      {error && <Text style={{ color: colors.danger }}>{formatAppError(error, _).message}</Text>}
      {error && <Button title={_(msg`mobile.sync.invite.new-code`)} disabled={isPending} onPress={() => mutate()} />}
      {data && <Pairing pairing={data} isPending={isPending} onNewCode={() => mutate()} />}
      <Button
        title={_(msg`mobile.sync.invite.done`)}
        onPress={() => {
          setIsOpen(false);
          reset();
        }}
      />
    </View>
  );
}

type PairingProps = { pairing: IssuedPairing; isPending: boolean; onNewCode: () => void };

function Pairing({ pairing, isPending, onNewCode }: PairingProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const secondsLeft = pairingSecondsLeft(pairing.expiresAt, useNow());
  const muted = { color: colors.muted };

  if (secondsLeft === 0) {
    return (
      <>
        <Text style={muted}>{_(msg`mobile.sync.invite.expired`)}</Text>
        <Button title={_(msg`mobile.sync.invite.new-code`)} disabled={isPending} onPress={onNewCode} />
      </>
    );
  }

  const timeLeft = formatTimeLeft(secondsLeft);
  return (
    <>
      <Text style={muted}>{_(msg`mobile.sync.invite.message`)}</Text>
      <CopyRow
        label={_(msg`mobile.sync.invite.code`)}
        value={formatPairingCode(pairing.code)}
        copyLabel={_(msg`mobile.sync.invite.copy-code`)}
      />
      <CopyRow
        label={_(msg`mobile.sync.server-url`)}
        value={pairing.serverUrl}
        copyLabel={_(msg`mobile.sync.invite.copy-server-url`)}
      />
      <Text style={muted}>{_(msg`mobile.sync.invite.expires-in ${timeLeft}`)}</Text>
    </>
  );
}

type CopyRowProps = { label: string; value: string; copyLabel: string };

function CopyRow({ label, value, copyLabel }: CopyRowProps) {
  const { _ } = useLingui();
  const colors = useAppColors();

  return (
    <View style={styles.row}>
      <View style={styles.value}>
        <Text style={{ color: colors.muted }}>{label}</Text>
        <Text selectable style={[styles.code, { color: colors.text }]}>
          {value}
        </Text>
      </View>
      <Button
        title={_(msg`mobile.sync.invite.copy`)}
        accessibilityLabel={copyLabel}
        onPress={() => void Clipboard.setStringAsync(value)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  value: { flex: 1, gap: 2 },
  code: { fontFamily: "monospace", fontSize: 18 },
});
