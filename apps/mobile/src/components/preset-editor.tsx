import { AppError, formatAppError } from "@koloda/app";
import type { ErrorCode } from "@koloda/app";
import { useTimestampFormatter, useWriteMutation } from "@koloda/core-react";
import { DEFAULT_FSRS_ALGORITHM, LEARNING_STEPS_UNITS, updateAlgorithmSchema } from "@koloda/srs";
import type { Algorithm, UpdateAlgorithmValues } from "@koloda/srs";
import { ALGORITHM_SYNC_GROUPS } from "@koloda/srs-react/algorithms";
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
import { ChoiceGroup } from "./choice-group";
import { DeletePreset } from "./delete-preset";
import { LabeledSwitch } from "./labeled-switch";
import { NumberInput } from "./number-input";

type Part =
  | "title"
  | "notes"
  | "retention"
  | "weights"
  | "learningSteps"
  | "relearningSteps"
  | "maximumInterval"
  | "form";

// WHY: errors group by the part of the form they concern, so each shows under it; parameter errors group by their
// parameter, and "form" holds the ones the save itself returned.
type ErrorsByPart = Partial<Record<Part, string[]>>;

type StepUnit = (typeof LEARNING_STEPS_UNITS)[number]["id"];

export type PresetEditorProps = {
  algorithmId: Algorithm["id"];
  onClone: () => void;
  onDeleted: () => void;
};

export function PresetEditor({ algorithmId, onClone, onDeleted }: PresetEditorProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const { getAlgorithmQuery } = useMobileQueries();
  const { data, error } = useQuery(getAlgorithmQuery(algorithmId));

  if (error) return <Text style={[styles.message, { color: colors.danger }]}>{_(msg`mobile.presets.error`)}</Text>;
  if (data === undefined) return null;
  if (data === null)
    return <Text style={[styles.message, { color: colors.text }]}>{_(msg`mobile.presets.missing`)}</Text>;
  return <PresetEditorForm algorithm={data} onClone={onClone} onDeleted={onDeleted} />;
}

type PresetEditorFormProps = {
  algorithm: Algorithm;
  onClone: () => void;
  onDeleted: () => void;
};

function PresetEditorForm({ algorithm, onClone, onDeleted }: PresetEditorFormProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const formatTimestamp = useTimestampFormatter();
  const { updateAlgorithmMutation } = useMobileQueries();
  const { mutateAsync } = useWriteMutation(updateAlgorithmMutation(), ["algorithms"]);
  const [errors, setErrors] = useState<ErrorsByPart>({});
  const messageOf = (code: string) => formatAppError(new AppError(code as ErrorCode), _).message;
  const values = useMemo<UpdateAlgorithmValues>(
    () => ({ title: algorithm.title, notes: algorithm.notes, content: algorithm.content }),
    [algorithm],
  );

  const form = useForm({
    defaultValues: values,
    onSubmit: async ({ formApi, value }) => {
      const parsed = updateAlgorithmSchema.safeParse(value);
      if (!parsed.success) {
        const next: ErrorsByPart = {};
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0] === "content" ? issue.path[1] : issue.path[0]) as Part;
          next[key] = [...new Set([...(next[key] ?? []), messageOf(issue.message)])];
        }
        setErrors(next);
        return;
      }
      let saved: Algorithm;
      try {
        saved = await mutateAsync({ id: algorithm.id, values: parsed.data });
      } catch (error) {
        setErrors({ form: [formatAppError(error, _).message] });
        return;
      }
      setErrors({});
      // WHY: reset must receive the saved values; a bare reset() restores the values from before the save.
      formApi.reset({ title: saved.title, notes: saved.notes, content: saved.content });
    },
  });
  useRefreshPristineFields(form, values, ALGORITHM_SYNC_GROUPS);

  const errorText = (key: Part) =>
    errors[key]?.map((message) => (
      <Text key={message} accessibilityRole="alert" style={{ color: colors.danger }}>
        {message}
      </Text>
    ));
  const inputStyle = [
    styles.input,
    { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
  ];
  const units = LEARNING_STEPS_UNITS.map(({ id, long }) => ({ value: id, label: _(long) }));

  const steps = (type: "learningSteps" | "relearningSteps") => (
    <form.Field name={`content.${type}`} mode="array">
      {(stepsField) => (
        <View style={styles.section}>
          <Text style={[styles.heading, { color: colors.text }]}>
            {type === "learningSteps" ? _(msg`mobile.presets.learning-steps`) : _(msg`mobile.presets.relearning-steps`)}
          </Text>
          {stepsField.state.value.map((_step, i) => {
            const stepNumber = i + 1;
            return (
              <View key={i} style={[styles.row, { borderColor: colors.border }]}>
                <form.Field name={`content.${type}[${i}][0]`}>
                  {(field) => (
                    <NumberInput
                      label={
                        type === "learningSteps"
                          ? _(msg`mobile.presets.learning-step.amount ${stepNumber}`)
                          : _(msg`mobile.presets.relearning-step.amount ${stepNumber}`)
                      }
                      value={field.state.value}
                      onChange={field.handleChange}
                    />
                  )}
                </form.Field>
                <form.Field name={`content.${type}[${i}][1]`}>
                  {(field) => (
                    <ChoiceGroup
                      label={
                        type === "learningSteps"
                          ? _(msg`mobile.presets.learning-step.unit ${stepNumber}`)
                          : _(msg`mobile.presets.relearning-step.unit ${stepNumber}`)
                      }
                      choices={units}
                      value={field.state.value}
                      onChange={(unit) => field.handleChange(unit as StepUnit)}
                    />
                  )}
                </form.Field>
                <ActionButton
                  label={
                    type === "learningSteps"
                      ? _(msg`mobile.presets.learning-step.remove ${stepNumber}`)
                      : _(msg`mobile.presets.relearning-step.remove ${stepNumber}`)
                  }
                  isDanger
                  onPress={() => stepsField.removeValue(i)}
                />
              </View>
            );
          })}
          <ActionButton
            label={
              type === "learningSteps"
                ? _(msg`mobile.presets.learning-step.add`)
                : _(msg`mobile.presets.relearning-step.add`)
            }
            // WHY: a new step copies the last one, or starts from the list's default first step (ALGORITHMS.md
            // §Parameters).
            onPress={() => stepsField.pushValue(stepsField.state.value.at(-1) ?? DEFAULT_FSRS_ALGORITHM[type][0])}
          />
          {errorText(type)}
        </View>
      )}
    </form.Field>
  );

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={{ color: colors.muted }}>
            {_(msg`mobile.presets.created-at`)}: {formatTimestamp(algorithm.createdAt, "datetime")}
          </Text>
          {algorithm.updatedAt && (
            <Text style={{ color: colors.muted }}>
              {_(msg`mobile.presets.updated-at`)}: {formatTimestamp(algorithm.updatedAt, "datetime")}
            </Text>
          )}
        </View>
        <View style={styles.field}>
          <Text style={{ color: colors.muted }}>{_(msg`mobile.presets.preset-title`)}</Text>
          <form.Field name="title">
            {(field) => (
              <TextInput
                accessibilityLabel={_(msg`mobile.presets.preset-title`)}
                value={field.state.value}
                onChangeText={field.handleChange}
                style={inputStyle}
              />
            )}
          </form.Field>
          {errorText("title")}
        </View>
        <View style={styles.field}>
          <Text style={{ color: colors.muted }}>{_(msg`mobile.presets.notes`)}</Text>
          <form.Field name="notes">
            {(field) => (
              <TextInput
                accessibilityLabel={_(msg`mobile.presets.notes`)}
                multiline
                value={field.state.value ?? ""}
                onChangeText={field.handleChange}
                style={[inputStyle, styles.multiline]}
              />
            )}
          </form.Field>
          {errorText("notes")}
        </View>
        <View style={styles.field}>
          <form.Field name="content.retention">
            {(field) => (
              <NumberInput
                label={_(msg`mobile.presets.retention`)}
                max={99}
                value={field.state.value}
                onChange={field.handleChange}
              />
            )}
          </form.Field>
          {errorText("retention")}
        </View>
        <form.Field name="content.isFuzzEnabled">
          {(field) => (
            <LabeledSwitch
              text={_(msg`mobile.presets.fuzz`)}
              accessibilityLabel={_(msg`mobile.presets.fuzz`)}
              value={field.state.value}
              onChange={field.handleChange}
            />
          )}
        </form.Field>
        <View style={styles.field}>
          <Text style={{ color: colors.muted }}>{_(msg`mobile.presets.weights`)}</Text>
          <form.Field name="content.weights">
            {(field) => (
              <TextInput
                accessibilityLabel={_(msg`mobile.presets.weights`)}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                value={field.state.value}
                onChangeText={field.handleChange}
                style={[inputStyle, styles.multiline]}
              />
            )}
          </form.Field>
          {errorText("weights")}
        </View>
        {steps("learningSteps")}
        {steps("relearningSteps")}
        <View style={styles.field}>
          <form.Field name="content.maximumInterval">
            {(field) => (
              <NumberInput
                label={_(msg`mobile.presets.maximum-interval`)}
                value={field.state.value}
                onChange={field.handleChange}
              />
            )}
          </form.Field>
          {errorText("maximumInterval")}
        </View>
        <View style={styles.field}>
          <ActionButton label={_(msg`mobile.presets.clone`)} onPress={onClone} />
        </View>
        <DeletePreset algorithm={algorithm} onDeleted={onDeleted} />
      </ScrollView>
      <View style={styles.footer}>
        {errorText("form")}
        <form.Subscribe selector={(state) => [state.isDirty, state.isSubmitting] as const}>
          {([isDirty, isSubmitting]) => (
            <View style={styles.actions}>
              <ActionButton
                label={_(msg`mobile.presets.discard`)}
                isDisabled={!isDirty || isSubmitting}
                onPress={() => {
                  setErrors({});
                  form.reset();
                }}
              />
              <ActionButton
                label={_(msg`mobile.presets.save`)}
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
  section: { gap: 12 },
  heading: { fontSize: 17, fontWeight: "600" },
  field: { gap: 6 },
  row: { gap: 8, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  multiline: { minHeight: 88, textAlignVertical: "top" },
  footer: { padding: 16, gap: 8 },
  actions: { flexDirection: "row", gap: 12 },
});
