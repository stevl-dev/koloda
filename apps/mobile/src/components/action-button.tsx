import { Pressable, StyleSheet, Text } from "react-native";
import { useAppColors } from "../colors";

export type ActionButtonProps = {
  label: string;
  isDisabled?: boolean;
  onPress: () => void;
};

export function ActionButton({ label, isDisabled = false, onPress }: ActionButtonProps) {
  const colors = useAppColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={[styles.action, { borderColor: colors.border, backgroundColor: colors.surface }]}
    >
      <Text style={{ color: isDisabled ? colors.muted : colors.text }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // WHY: each action stays tall enough to tap.
  action: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 10 },
});
