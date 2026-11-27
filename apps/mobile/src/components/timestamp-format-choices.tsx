import { AppError, formatAppError } from "@koloda/app";
import type { TimestampKind } from "@koloda/app";
import {
  CUSTOM_OPTION,
  DATE_FORMAT_PRESETS,
  LOCALE_OPTION,
  TIME_FORMAT_PRESETS,
  useTimestampFormat,
} from "@koloda/settings-react/interface-settings";
import type { InterfaceField } from "@koloda/settings-react/interface-settings";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useAppColors } from "../colors";
import { ChoiceGroup } from "./choice-group";

export type TimestampFormatChoicesProps = {
  kind: TimestampKind;
  write: (field: InterfaceField, value: string) => void;
};

export function TimestampFormatChoices({ kind, write }: TimestampFormatChoicesProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const isDate = kind === "date";
  const presets = isDate ? DATE_FORMAT_PRESETS : TIME_FORMAT_PRESETS;
  const { selection, pattern, setPattern, error, select, commit, previewValue } = useTimestampFormat({
    kind,
    presets,
    allowsCustom: isDate,
    write,
  });
  const choices = [
    { value: LOCALE_OPTION, label: _(msg`mobile.settings.interface.timestamp-format.locale`) },
    ...presets.map((preset) => ({ value: preset.value, label: preset.label ? _(preset.label) : preset.value })),
    ...(isDate ? [{ value: CUSTOM_OPTION, label: _(msg`mobile.settings.interface.date-format.custom`) }] : []),
  ];

  return (
    <View style={styles.section}>
      <ChoiceGroup
        label={isDate ? _(msg`mobile.settings.interface.date-format`) : _(msg`mobile.settings.interface.time-format`)}
        choices={choices}
        value={selection}
        onChange={select}
      />
      {selection === CUSTOM_OPTION && (
        <TextInput
          accessibilityLabel={_(msg`mobile.settings.interface.date-format.custom`)}
          value={pattern}
          onChangeText={setPattern}
          onBlur={commit}
          onSubmitEditing={commit}
          placeholder={presets[0]!.value}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.input,
            { borderColor: error ? colors.danger : colors.border, color: colors.text, backgroundColor: colors.surface },
          ]}
        />
      )}
      {error && <Text style={{ color: colors.danger }}>{formatAppError(new AppError(error), _).message}</Text>}
      <Text style={{ color: colors.muted }}>
        {_(msg`mobile.settings.interface.timestamp-format.preview ${previewValue}`)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
});
