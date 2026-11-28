import { StyleSheet, Text, TextInput, View } from "react-native";
import { useAppColors } from "../colors";

export type NumberInputProps = {
  label: string;
  max?: number;
  isEditable?: boolean;
  value: number;
  onChange: (value: number) => void;
};

export function NumberInput({ label, max, isEditable = true, value, onChange }: NumberInputProps) {
  const colors = useAppColors();

  return (
    <View style={styles.field}>
      <Text style={{ color: colors.muted }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType="number-pad"
        selectTextOnFocus
        editable={isEditable}
        value={`${value}`}
        // WHY: a cleared field parses to NaN and keeps the last number, as desktop's number field does; the
        // number pad lets a pasted sign through, so the value is held to its range here.
        onChangeText={(text) => {
          const next = Number.parseInt(text, 10);
          if (!Number.isNaN(next)) onChange(Math.max(0, max === undefined ? next : Math.min(next, max)));
        }}
        style={[
          styles.input,
          {
            color: isEditable ? colors.text : colors.muted,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 4 },
  input: { minHeight: 44, minWidth: 88, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 17 },
});
