import { isTypedAnswerCorrect } from "@koloda/srs";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useAppColors } from "../colors";

export type TypedAnswerProps = {
  fieldTitle: string;
  value: string;
  userValue: string;
  isSubmitted: boolean;
  isFirstInput: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function TypedAnswer({
  fieldTitle,
  value,
  userValue,
  isSubmitted,
  isFirstInput,
  onChange,
  onSubmit,
}: TypedAnswerProps) {
  const colors = useAppColors();

  if (isSubmitted) {
    const isCorrect = isTypedAnswerCorrect(userValue, value);
    return (
      <View style={styles.answer}>
        <Text style={[styles.text, { color: isCorrect ? colors.success : colors.danger }]}>{userValue}</Text>
        {!isCorrect && <Text style={[styles.text, { color: colors.text }]}>{value}</Text>}
      </View>
    );
  }

  return (
    <TextInput
      accessibilityLabel={fieldTitle}
      placeholder={fieldTitle}
      placeholderTextColor={colors.muted}
      value={userValue}
      onChangeText={onChange}
      autoFocus={isFirstInput}
      autoCapitalize="none"
      autoCorrect={false}
      returnKeyType="done"
      onSubmitEditing={onSubmit}
      style={[styles.input, styles.text, { color: colors.text, borderColor: colors.border }]}
    />
  );
}

const styles = StyleSheet.create({
  answer: { gap: 8 },
  text: { fontSize: 17 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
});
