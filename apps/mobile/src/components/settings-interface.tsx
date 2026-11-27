import { ERROR_MESSAGES, formatAppError, SCHEMES } from "@koloda/app";
import { schemeAtom } from "@koloda/core-react";
import { useInterfaceSettingWriteError, useInterfaceSettingWriteWith } from "@koloda/settings-react/interface-settings";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useAtomValue } from "jotai";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useAppColors } from "../colors";
import { useMobileQueries } from "../host/queries-context";
import { ChoiceGroup } from "./choice-group";

export function SettingsInterface() {
  const { _ } = useLingui();
  const colors = useAppColors();
  const { patchSettingsMutation } = useMobileQueries();
  const write = useInterfaceSettingWriteWith(patchSettingsMutation);
  const writeError = useInterfaceSettingWriteError();
  const scheme = useAtomValue(schemeAtom);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      {writeError && (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {formatAppError(writeError, _, ERROR_MESSAGES["db.update"]).message}
        </Text>
      )}
      <ChoiceGroup
        label={_(msg`mobile.settings.interface.scheme`)}
        choices={Object.entries(SCHEMES).map(([value, label]) => ({ value, label: _(label) }))}
        value={scheme}
        onChange={(value) => write("scheme", value)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 24 },
});
