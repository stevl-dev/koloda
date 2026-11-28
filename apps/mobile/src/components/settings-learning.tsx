import { AppError, formatAppError, resolvedLearningSettingsValidation, timeFieldFormatOptions } from "@koloda/app";
import type { ErrorCode, ResolvedLearningSettings } from "@koloda/app";
import { langAtom, queryKeys, timeFormatAtom, useWriteMutation } from "@koloda/core-react";
import { LEARNING_SYNC_GROUPS, UNLIMITED_OFF_VALUES } from "@koloda/settings-react/learning-settings";
import { useRefreshPristineFields } from "@koloda/ui/form-state";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useAppColors } from "../colors";
import { useMobileQueries } from "../host/queries-context";
import { ActionButton } from "./action-button";
import { ChoiceGroup } from "./choice-group";

// WHY: errors group by the first segment of their path, so each shows under the section it names; "form" holds the
// ones the save itself returned.
type ErrorsBySection = Partial<Record<"form" | "dailyLimits" | "dayStartsAt" | "learnAheadLimit", string[]>>;

const LIMIT_TYPES = ["untouched", "learn", "review"] as const;

function pad(value: number): string {
  return `${value}`.padStart(2, "0");
}

export type SettingsLearningProps = {
  data: ResolvedLearningSettings;
};

export function SettingsLearning({ data }: SettingsLearningProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const queryClient = useQueryClient();
  const { setSettingsMutation } = useMobileQueries();
  const { mutateAsync } = useWriteMutation(setSettingsMutation<"learning">(), ["settings.learning"]);
  const [errors, setErrors] = useState<ErrorsBySection>({});
  const messageOf = (code: string) => formatAppError(new AppError(code as ErrorCode), _).message;

  const form = useForm({
    defaultValues: data,
    onSubmit: async ({ formApi, value }) => {
      const parsed = resolvedLearningSettingsValidation.safeParse(value);
      if (!parsed.success) {
        const next: ErrorsBySection = {};
        for (const issue of parsed.error.issues) {
          const section = String(issue.path[0]) as keyof ErrorsBySection;
          next[section] = [...(next[section] ?? []), messageOf(issue.message)];
        }
        setErrors(next);
        return;
      }
      try {
        const returning = await mutateAsync({ name: "learning", content: value });
        queryClient.setQueryData(queryKeys.settings.detail("learning"), returning);
      } catch (error) {
        setErrors({ form: [formatAppError(error, _).message] });
        return;
      }
      setErrors({});
      // WHY: reset must receive the saved values; a bare reset() restores the values from before the save.
      formApi.reset(value);
    },
  });
  useRefreshPristineFields(form, data, LEARNING_SYNC_GROUPS);

  const errorText = (section: keyof ErrorsBySection) =>
    errors[section]?.map((message) => (
      <Text key={message} accessibilityRole="alert" style={{ color: colors.danger }}>
        {message}
      </Text>
    ));
  const limitLabels = {
    untouched: _(msg`mobile.settings.learning.limits.untouched`),
    learn: _(msg`mobile.settings.learning.limits.learn`),
    review: _(msg`mobile.settings.learning.limits.review`),
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {errorText("form")}
        <View style={styles.section}>
          <Text style={[styles.heading, { color: colors.text }]}>{_(msg`mobile.settings.learning.limits`)}</Text>
          <form.Field name="dailyLimits.total">
            {(field) => (
              <CapInput
                label={_(msg`mobile.settings.learning.limits.total`)}
                unlimitedOffValue={UNLIMITED_OFF_VALUES.total}
                value={field.state.value}
                onChange={field.handleChange}
              />
            )}
          </form.Field>
          {LIMIT_TYPES.map((type) => {
            const label = limitLabels[type];
            return (
              <View key={type} style={styles.section}>
                <form.Field name={`dailyLimits.${type}.value`}>
                  {(field) => (
                    <CapInput
                      label={label}
                      unlimitedOffValue={UNLIMITED_OFF_VALUES[type]}
                      value={field.state.value}
                      onChange={field.handleChange}
                    />
                  )}
                </form.Field>
                <form.Field name={`dailyLimits.${type}.counts`}>
                  {(field) => (
                    <LabeledSwitch
                      text={_(msg`mobile.settings.learning.limits.counts`)}
                      accessibilityLabel={_(msg`mobile.settings.learning.limits.counts-for ${label}`)}
                      value={field.state.value}
                      onChange={field.handleChange}
                    />
                  )}
                </form.Field>
              </View>
            );
          })}
          {errorText("dailyLimits")}
        </View>
        <form.Field name="dayStartsAt">
          {(field) => <DayStartInput value={field.state.value} onChange={field.handleChange} />}
        </form.Field>
        {errorText("dayStartsAt")}
        <View style={styles.section}>
          <Text style={[styles.heading, { color: colors.text }]}>{_(msg`mobile.settings.learning.learn-ahead`)}</Text>
          <View style={styles.row}>
            <form.Field name="learnAheadLimit[0]">
              {(field) => (
                <NumberInput
                  label={_(msg`mobile.settings.learning.learn-ahead.hours`)}
                  max={48}
                  value={field.state.value}
                  onChange={field.handleChange}
                />
              )}
            </form.Field>
            <form.Field name="learnAheadLimit[1]">
              {(field) => (
                <NumberInput
                  label={_(msg`mobile.settings.learning.learn-ahead.minutes`)}
                  max={59}
                  value={field.state.value}
                  onChange={field.handleChange}
                />
              )}
            </form.Field>
          </View>
          {errorText("learnAheadLimit")}
        </View>
      </ScrollView>
      <form.Subscribe selector={(state) => [state.isDirty, state.isSubmitting] as const}>
        {([isDirty, isSubmitting]) => (
          <View style={styles.actions}>
            <ActionButton
              label={_(msg`mobile.settings.learning.discard`)}
              isDisabled={!isDirty || isSubmitting}
              onPress={() => {
                setErrors({});
                form.reset();
              }}
            />
            <ActionButton
              label={_(msg`mobile.settings.learning.save`)}
              isDisabled={!isDirty || isSubmitting}
              onPress={() => void form.handleSubmit()}
            />
          </View>
        )}
      </form.Subscribe>
    </View>
  );
}

type NumberInputProps = {
  label: string;
  max?: number;
  isEditable?: boolean;
  value: number;
  onChange: (value: number) => void;
};

function NumberInput({ label, max, isEditable = true, value, onChange }: NumberInputProps) {
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

type CapInputProps = {
  label: string;
  unlimitedOffValue: number;
  value: number | null;
  onChange: (value: number | null) => void;
};

function CapInput({ label, unlimitedOffValue, value, onChange }: CapInputProps) {
  const { _ } = useLingui();
  const lastNumber = useRef(value ?? unlimitedOffValue);
  if (typeof value === "number") lastNumber.current = value;
  const isUnlimited = value == null;

  return (
    <View style={styles.row}>
      <NumberInput label={label} isEditable={!isUnlimited} value={lastNumber.current} onChange={onChange} />
      <LabeledSwitch
        text={_(msg`mobile.settings.learning.limits.unlimited`)}
        accessibilityLabel={_(msg`mobile.settings.learning.limits.unlimited-for ${label}`)}
        value={isUnlimited}
        onChange={(isOn) => onChange(isOn ? null : lastNumber.current)}
      />
    </View>
  );
}

type LabeledSwitchProps = {
  text: string;
  accessibilityLabel: string;
  value: boolean;
  onChange: (value: boolean) => void;
};

function LabeledSwitch({ text, accessibilityLabel, value, onChange }: LabeledSwitchProps) {
  const colors = useAppColors();

  return (
    <View style={styles.switchRow}>
      <Switch
        accessibilityLabel={accessibilityLabel}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.link, false: colors.border }}
      />
      <Text style={[styles.switchLabel, { color: colors.text }]} importantForAccessibility="no">
        {text}
      </Text>
    </View>
  );
}

type DayStartInputProps = {
  value: string;
  onChange: (value: string) => void;
};

// INVARIANT: the clock follows the time format; Default takes the language's clock (INTERFACE-SETTINGS.md
// §Date and Time Format).
function DayStartInput({ value, onChange }: DayStartInputProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const timeFormat = useAtomValue(timeFormatAtom);
  const locale = useAtomValue(langAtom);
  const is12Hour =
    (timeFieldFormatOptions(timeFormat).hourCycle ??
      (new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions().hour12 ? 12 : 24)) === 12;
  const [hours, minutes] = value.split(":").map(Number) as [number, number];
  const isPm = hours >= 12;
  const write = (nextHours: number, nextMinutes: number) => onChange(`${pad(nextHours)}:${pad(nextMinutes)}`);

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: colors.text }]}>{_(msg`mobile.settings.learning.day-starts-at`)}</Text>
      <View style={styles.row}>
        <NumberInput
          label={_(msg`mobile.settings.learning.day-starts-at.hour`)}
          max={is12Hour ? 12 : 23}
          value={is12Hour ? hours % 12 || 12 : hours}
          onChange={(next) => write(is12Hour ? (next % 12) + (isPm ? 12 : 0) : next, minutes)}
        />
        <NumberInput
          label={_(msg`mobile.settings.learning.day-starts-at.minute`)}
          max={59}
          value={minutes}
          onChange={(next) => write(hours, next)}
        />
      </View>
      {is12Hour && (
        <ChoiceGroup
          label={_(msg`mobile.settings.learning.day-starts-at.period`)}
          choices={[
            { value: "am", label: _(msg`mobile.settings.learning.day-starts-at.am`) },
            { value: "pm", label: _(msg`mobile.settings.learning.day-starts-at.pm`) },
          ]}
          value={isPm ? "pm" : "am"}
          onChange={(period) => write((hours % 12) + (period === "pm" ? 12 : 0), minutes)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 24 },
  section: { gap: 12 },
  heading: { fontSize: 17, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 16 },
  field: { gap: 4 },
  input: { minHeight: 44, minWidth: 88, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 17 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, flexShrink: 1 },
  switchLabel: { flexShrink: 1 },
  actions: { flexDirection: "row", gap: 12, padding: 16 },
});
