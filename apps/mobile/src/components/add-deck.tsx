import { AppError, DEFAULT_LEARNING_SETTINGS, formatAppError, learningSettingsValidation } from "@koloda/app";
import type { ErrorCode } from "@koloda/app";
import { useWriteMutation } from "@koloda/core-react";
import { insertDeckSchema } from "@koloda/srs";
import type { Deck, InsertDeckData } from "@koloda/srs";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppColors } from "../colors";
import { useMobileQueries } from "../host/queries-context";
import { ActionButton } from "./action-button";
import { AlgorithmChoice, TemplateChoice } from "./deck-choices";

// WHY: errors group by the first segment of their path, so each shows under its field; "form" holds the ones the save
// itself returned.
type ErrorsByField = Partial<Record<keyof InsertDeckData | "form", string[]>>;

export type AddDeckProps = {
  onAdded: (deck: Deck) => void;
};

export function AddDeck({ onAdded }: AddDeckProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const { getSettingsQuery } = useMobileQueries();
  const { data, error, isSuccess } = useQuery(getSettingsQuery("learning"));

  if (error) {
    return <Text style={[styles.message, { color: colors.danger }]}>{_(msg`mobile.settings.learning.error`)}</Text>;
  }
  if (!isSuccess) return null;
  // INVARIANT: the choices start on the learning settings' defaults (LEARNING-SETTINGS.md §Defaults).
  const { defaults } = learningSettingsValidation.parse(data?.content ?? DEFAULT_LEARNING_SETTINGS);
  return (
    <AddDeckForm
      values={{ title: "", algorithmId: defaults.algorithm, templateId: defaults.template }}
      onAdded={onAdded}
    />
  );
}

type AddDeckFormProps = {
  values: InsertDeckData;
  onAdded: (deck: Deck) => void;
};

function AddDeckForm({ values, onAdded }: AddDeckFormProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const { addDeckMutation } = useMobileQueries();
  const { mutateAsync } = useWriteMutation(addDeckMutation(), ["decks"]);
  const [errors, setErrors] = useState<ErrorsByField>({});
  const messageOf = (code: string) => formatAppError(new AppError(code as ErrorCode), _).message;

  const form = useForm({
    defaultValues: values,
    onSubmit: async ({ value }) => {
      const parsed = insertDeckSchema.safeParse(value);
      if (!parsed.success) {
        const next: ErrorsByField = {};
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0]) as keyof ErrorsByField;
          next[key] = [...(next[key] ?? []), messageOf(issue.message)];
        }
        setErrors(next);
        return;
      }
      let deck: Deck;
      try {
        deck = await mutateAsync(parsed.data);
      } catch (error) {
        setErrors({ form: [formatAppError(error, _).message] });
        return;
      }
      onAdded(deck);
    },
  });

  const errorText = (key: keyof ErrorsByField) =>
    errors[key]?.map((message) => (
      <Text key={message} accessibilityRole="alert" style={{ color: colors.danger }}>
        {message}
      </Text>
    ));

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={{ color: colors.muted }}>{_(msg`mobile.decks.deck-title`)}</Text>
          <form.Field name="title">
            {(field) => (
              <TextInput
                accessibilityLabel={_(msg`mobile.decks.deck-title`)}
                autoFocus
                value={field.state.value}
                onChangeText={field.handleChange}
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
                ]}
              />
            )}
          </form.Field>
          {errorText("title")}
        </View>
        <View style={styles.field}>
          <form.Field name="algorithmId">
            {(field) => <AlgorithmChoice value={field.state.value} onChange={field.handleChange} />}
          </form.Field>
          {errorText("algorithmId")}
        </View>
        <View style={styles.field}>
          <form.Field name="templateId">
            {(field) => <TemplateChoice value={field.state.value} onChange={field.handleChange} />}
          </form.Field>
          {errorText("templateId")}
        </View>
      </ScrollView>
      <View style={styles.actions}>
        {errorText("form")}
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <ActionButton
              label={_(msg`mobile.decks.add`)}
              isDisabled={isSubmitting}
              onPress={() => void form.handleSubmit()}
            />
          )}
        </form.Subscribe>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  message: { padding: 16 },
  content: { padding: 16, gap: 20 },
  field: { gap: 6 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 16 },
  actions: { padding: 16, gap: 8 },
});
