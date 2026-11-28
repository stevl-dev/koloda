import { Pressable, StyleSheet, Text } from "react-native";
import { useAppColors } from "../colors";

export type ActionButtonProps = {
  label: string;
  isDisabled?: boolean;
  isDanger?: boolean;
  onPress: () => void;
};

export function ActionButton({ label, isDisabled = false, isDanger = false, onPress }: ActionButtonProps) {
  const colors = useAppColors();
  const color = isDisabled ? colors.muted : isDanger ? colors.danger : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={[styles.action, { borderColor: colors.border, backgroundColor: colors.surface }]}
    >
      <Text style={{ color }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // WHY: each action stays tall enough to tap.
  action: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 10 },
});
