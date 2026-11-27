import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppColors } from "../colors";

export type ChoiceGroupProps = {
  label: string;
  choices: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
};

export function ChoiceGroup({ label, choices, value, onChange }: ChoiceGroupProps) {
  const colors = useAppColors();

  return (
    <View style={styles.group}>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.choices}>
        {choices.map((choice) => {
          const isSelected = choice.value === value;
          return (
            <Pressable
              key={choice.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              onPress={() => {
                if (!isSelected) onChange(choice.value);
              }}
              style={[
                styles.choice,
                {
                  borderColor: isSelected ? colors.link : colors.border,
                  backgroundColor: isSelected ? colors.codeBackground : colors.surface,
                },
              ]}
            >
              <Text style={{ color: colors.text }}>{choice.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  label: { fontSize: 13 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  // WHY: each choice stays tall enough to tap.
  choice: { minHeight: 44, paddingHorizontal: 14, justifyContent: "center", borderWidth: 1, borderRadius: 10 },
});
