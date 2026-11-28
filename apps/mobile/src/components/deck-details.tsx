import { AppError, formatAppError } from "@koloda/app";
import type { ErrorCode } from "@koloda/app";
import { useWriteMutation } from "@koloda/core-react";
import { updateDeckSchema } from "@koloda/srs";
import type { Deck, UpdateDeckValues } from "@koloda/srs";
import { DECK_SYNC_GROUPS } from "@koloda/srs-react/decks";
import { useRefreshPristineFields } from "@koloda/ui/form-state";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppColors } from "../colors";
import { useMobileQueries } from "../host/queries-context";
import { ActionButton } from "./action-button";
import { AlgorithmChoice, TemplateChoice } from "./deck-choices";

// WHY: errors group by the first segment of their path, so each shows under its field; "form" holds the ones the save
// itself returned.
type ErrorsByField = Partial<Record<keyof UpdateDeckValues | "form", string[]>>;

export type DeckDetailsProps = {
  deckId: Deck["id"];
};

export function DeckDetails({ deckId }: DeckDetailsProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const { getDecksQuery } = useMobileQueries();
  // WHY: the deck comes from the decks query, as the card screen reads it, so a change synced from desktop shows here.
  const decks = useQuery(getDecksQuery());
  const deck = decks.data?.find((candidate) => candidate.id === deckId);

  if (decks.error) return <Text style={[styles.message, { color: colors.danger }]}>{_(msg`mobile.decks.error`)}</Text>;
  if (!decks.data) return null;
  if (!deck) return <Text style={[styles.message, { color: colors.text }]}>{_(msg`mobile.decks.missing`)}</Text>;
  return <DeckDetailsForm deck={deck} />;
}

type DeckDetailsFormProps = {
  deck: Deck;
};

function DeckDetailsForm({ deck }: DeckDetailsFormProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const { updateDeckMutation } = useMobileQueries();
  const { mutateAsync } = useWriteMutation(updateDeckMutation(), ["decks"]);
  const [errors, setErrors] = useState<ErrorsByField>({});
  const messageOf = (code: string) => formatAppError(new AppError(code as ErrorCode), _).message;
  const values = useMemo<UpdateDeckValues>(
    () => ({ title: deck.title, notes: deck.notes, algorithmId: deck.algorithmId, templateId: deck.templateId }),
    [deck],
  );

  const form = useForm({
    defaultValues: values,
    onSubmit: async ({ formApi, value }) => {
      const parsed = updateDeckSchema.safeParse(value);
      if (!parsed.success) {
        const next: ErrorsByField = {};
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0]) as keyof ErrorsByField;
          next[key] = [...(next[key] ?? []), messageOf(issue.message)];
        }
        setErrors(next);
        return;
      }
      let saved: Deck;
      try {
        saved = await mutateAsync({ id: deck.id, values: parsed.data });
      } catch (error) {
        setErrors({ form: [formatAppError(error, _).message] });
        return;
      }
      setErrors({});
      // WHY: reset must receive the saved values; a bare reset() restores the values from before the save.
      formApi.reset({
        title: saved.title,
        notes: saved.notes,
        algorithmId: saved.algorithmId,
        templateId: saved.templateId,
      });
    },
  });
  useRefreshPristineFields(form, values, DECK_SYNC_GROUPS);

  const errorText = (key: keyof ErrorsByField) =>
    errors[key]?.map((message) => (
      <Text key={message} accessibilityRole="alert" style={{ color: colors.danger }}>
        {message}
      </Text>
    ));
  const inputStyle = [
    styles.input,
    { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={{ color: colors.muted }}>{_(msg`mobile.decks.deck-title`)}</Text>
          <form.Field name="title">
            {(field) => (
              <TextInput
                accessibilityLabel={_(msg`mobile.decks.deck-title`)}
                value={field.state.value}
                onChangeText={field.handleChange}
                style={inputStyle}
              />
            )}
          </form.Field>
          {errorText("title")}
        </View>
        <View style={styles.field}>
          <Text style={{ color: colors.muted }}>{_(msg`mobile.decks.notes`)}</Text>
          <form.Field name="notes">
            {(field) => (
              <TextInput
                accessibilityLabel={_(msg`mobile.decks.notes`)}
                multiline
                value={field.state.value ?? ""}
                onChangeText={field.handleChange}
                style={[inputStyle, styles.notes]}
              />
            )}
          </form.Field>
          {errorText("notes")}
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
      <View style={styles.footer}>
        {errorText("form")}
        <form.Subscribe selector={(state) => [state.isDirty, state.isSubmitting] as const}>
          {([isDirty, isSubmitting]) => (
            <View style={styles.actions}>
              <ActionButton
                label={_(msg`mobile.decks.discard`)}
                isDisabled={!isDirty || isSubmitting}
                onPress={() => {
                  setErrors({});
                  form.reset();
                }}
              />
              <ActionButton
                label={_(msg`mobile.decks.save`)}
                isDisabled={!isDirty || isSubmitting}
                onPress={() => void form.handleSubmit()}
              />
            </View>
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
  input: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  notes: { minHeight: 88, textAlignVertical: "top" },
  footer: { padding: 16, gap: 8 },
  actions: { flexDirection: "row", gap: 12 },
});
