import { AppError, formatAppError } from "@koloda/app";
import type { ErrorCode } from "@koloda/app";
import { getUpdateCardSchema } from "@koloda/srs";
import type { Card, Template } from "@koloda/srs";
import { CARD_SYNC_GROUPS } from "@koloda/srs-react/cards";
import { useRefreshPristineFields } from "@koloda/ui/form-state";
import { useLingui } from "@lingui/react";
import { useForm } from "@tanstack/react-form";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppColors } from "../colors";
import { ActionButton } from "./action-button";

type CardContent = Card["content"];

// WHY: errors group by the field id in their path, so each shows under its field; "form" holds the ones the save
// itself returned.
type ErrorsByField = Record<string, string[]>;

export type CardFormProps = {
  template: Template;
  content: CardContent;
  submitLabel: string;
  // INVARIANT: resolves to the content the form shows next, or rejects with the save's error.
  onSubmit: (content: CardContent) => Promise<CardContent>;
};

export function CardForm({ template, content, submitLabel, onSubmit }: CardFormProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const [errors, setErrors] = useState<ErrorsByField>({});
  const messageOf = (code: string) => formatAppError(new AppError(code as ErrorCode), _).message;

  const form = useForm({
    defaultValues: { content },
    onSubmit: async ({ formApi, value }) => {
      const parsed = getUpdateCardSchema(template).safeParse(value);
      if (!parsed.success) {
        const next: ErrorsByField = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path[1] === undefined ? "form" : String(issue.path[1]);
          next[key] = [...(next[key] ?? []), messageOf(issue.message)];
        }
        setErrors(next);
        return;
      }
      let saved: CardContent;
      try {
        saved = await onSubmit(value.content);
      } catch (error) {
        setErrors({ form: [formatAppError(error, _).message] });
        return;
      }
      setErrors({});
      // WHY: reset must receive the next values; a bare reset() restores the values from before the save.
      formApi.reset({ content: saved });
    },
  });
  const latest = useMemo(() => ({ content }), [content]);
  useRefreshPristineFields(form, latest, CARD_SYNC_GROUPS);

  const errorText = (key: string) =>
    errors[key]?.map((message) => (
      <Text key={message} accessibilityRole="alert" style={{ color: colors.danger }}>
        {message}
      </Text>
    ));

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {template.content.fields.map(({ id, title }) => (
          <View key={id} style={styles.field}>
            <Text style={{ color: colors.muted }}>{title}</Text>
            <form.Field name={`content.${id}`}>
              {(field) => (
                <TextInput
                  accessibilityLabel={title}
                  multiline
                  value={field.state.value?.text ?? ""}
                  onChangeText={(text) => field.handleChange({ text })}
                  style={[
                    styles.input,
                    { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
                  ]}
                />
              )}
            </form.Field>
            {errorText(id)}
          </View>
        ))}
      </ScrollView>
      <View style={styles.actions}>
        {errorText("form")}
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <ActionButton label={submitLabel} isDisabled={isSubmitting} onPress={() => void form.handleSubmit()} />
          )}
        </form.Subscribe>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 20 },
  field: { gap: 6 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  actions: { padding: 16, gap: 8 },
});
