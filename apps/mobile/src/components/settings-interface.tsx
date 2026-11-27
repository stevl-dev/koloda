import { DARK_THEMES, ERROR_MESSAGES, formatAppError, LANGUAGES, LIGHT_THEMES, SCHEMES } from "@koloda/app";
import { darkThemeAtom, langAtom, lightThemeAtom, schemeAtom } from "@koloda/core-react";
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
  const language = useAtomValue(langAtom);
  const scheme = useAtomValue(schemeAtom);
  const lightTheme = useAtomValue(lightThemeAtom);
  const darkTheme = useAtomValue(darkThemeAtom);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      {writeError && (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {formatAppError(writeError, _, ERROR_MESSAGES["db.update"]).message}
        </Text>
      )}
      <ChoiceGroup
        label={_(msg`mobile.settings.interface.language`)}
        choices={LANGUAGES.map(({ id, value }) => ({ value: id, label: value }))}
        value={language}
        onChange={(value) => write("language", value)}
      />
      <ChoiceGroup
        label={_(msg`mobile.settings.interface.scheme`)}
        choices={Object.entries(SCHEMES).map(([value, label]) => ({ value, label: _(label) }))}
        value={scheme}
        onChange={(value) => write("scheme", value)}
      />
      <ChoiceGroup
        label={_(msg`mobile.settings.interface.light-theme`)}
        choices={Object.entries(LIGHT_THEMES).map(([value, label]) => ({ value, label }))}
        value={lightTheme}
        onChange={(value) => write("lightTheme", value)}
      />
      <ChoiceGroup
        label={_(msg`mobile.settings.interface.dark-theme`)}
        choices={Object.entries(DARK_THEMES).map(([value, label]) => ({ value, label }))}
        value={darkTheme}
        onChange={(value) => write("darkTheme", value)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 24 },
});
