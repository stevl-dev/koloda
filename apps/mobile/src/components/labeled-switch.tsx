import { StyleSheet, Switch, Text, View } from "react-native";
import { useAppColors } from "../colors";

export type LabeledSwitchProps = {
  text: string;
  accessibilityLabel: string;
  value: boolean;
  isDisabled?: boolean;
  onChange: (value: boolean) => void;
};

export function LabeledSwitch({ text, accessibilityLabel, value, isDisabled = false, onChange }: LabeledSwitchProps) {
  const colors = useAppColors();

  return (
    <View style={styles.switchRow}>
      <Switch
        accessibilityLabel={accessibilityLabel}
        value={value}
        disabled={isDisabled}
        accessibilityState={{ disabled: isDisabled }}
        onValueChange={onChange}
        trackColor={{ true: colors.link, false: colors.border }}
      />
      <Text
        style={[styles.switchLabel, { color: isDisabled ? colors.muted : colors.text }]}
        importantForAccessibility="no"
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, flexShrink: 1 },
  switchLabel: { flexShrink: 1 },
});
