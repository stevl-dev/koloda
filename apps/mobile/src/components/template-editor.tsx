import { AppError, formatAppError } from "@koloda/app";
import type { ErrorCode } from "@koloda/app";
import { useTimestampFormatter, useWriteMutation } from "@koloda/core-react";
import {
  DEFAULT_TEMPLATE_FIELD,
  TEMPLATE_FIELD_TYPES_MESSAGES,
  TEMPLATE_OPERATIONS_MESSAGES,
  updateTemplateSchema,
} from "@koloda/srs";
import type { Template, TemplateFieldType, TemplateOperation, UpdateTemplateValues } from "@koloda/srs";
import { TEMPLATE_SYNC_GROUPS } from "@koloda/srs-react/templates";
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
import { DeleteTemplate } from "./delete-template";
import { LabeledSwitch } from "./labeled-switch";
import { SortableList } from "./sortable-list";

// WHY: errors group by the part of the form they concern, so each shows under it; content errors split into fields
// and layout, and "form" holds the ones the save itself returned.
type ErrorsByPart = Partial<Record<"title" | "notes" | "fields" | "layout" | "form", string[]>>;

export type TemplateEditorProps = {
  templateId: Template["id"];
  onClone: () => void;
  onDeleted: () => void;
};

export function TemplateEditor({ templateId, onClone, onDeleted }: TemplateEditorProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const { getTemplateQuery } = useMobileQueries();
  const { data, error } = useQuery(getTemplateQuery(templateId));

  if (error) return <Text style={[styles.message, { color: colors.danger }]}>{_(msg`mobile.templates.error`)}</Text>;
  if (data === undefined) return null;
  if (data === null)
    return <Text style={[styles.message, { color: colors.text }]}>{_(msg`mobile.templates.missing`)}</Text>;
  return <TemplateEditorForm template={data} onClone={onClone} onDeleted={onDeleted} />;
}

type TemplateEditorFormProps = {
  template: Template;
  onClone: () => void;
  onDeleted: () => void;
};

function TemplateEditorForm({ template, onClone, onDeleted }: TemplateEditorFormProps) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const formatTimestamp = useTimestampFormatter();
  const { updateTemplateMutation, newId } = useMobileQueries();
  const { mutateAsync } = useWriteMutation(updateTemplateMutation(), ["templates"]);
  const [errors, setErrors] = useState<ErrorsByPart>({});
  const messageOf = (code: string) => formatAppError(new AppError(code as ErrorCode), _).message;
  const values = useMemo<UpdateTemplateValues>(
    () => ({ title: template.title, notes: template.notes, content: template.content }),
    [template],
  );
  const isLocked = template.isLocked;

  const form = useForm({
    defaultValues: values,
    onSubmit: async ({ formApi, value }) => {
      const parsed = updateTemplateSchema.safeParse(value);
      if (!parsed.success) {
        const next: ErrorsByPart = {};
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0] === "content" ? issue.path[1] : issue.path[0]) as keyof ErrorsByPart;
          next[key] = [...new Set([...(next[key] ?? []), messageOf(issue.message)])];
        }
        setErrors(next);
        return;
      }
      let saved: Template;
      try {
        saved = await mutateAsync({ id: template.id, values: parsed.data });
      } catch (error) {
        setErrors({ form: [formatAppError(error, _).message] });
        return;
      }
      setErrors({});
      // WHY: reset must receive the saved values; a bare reset() restores the values from before the save.
      formApi.reset({ title: saved.title, notes: saved.notes, content: saved.content });
    },
  });
  useRefreshPristineFields(form, values, TEMPLATE_SYNC_GROUPS);

  const errorText = (key: keyof ErrorsByPart) =>
    errors[key]?.map((message) => (
      <Text key={message} accessibilityRole="alert" style={{ color: colors.danger }}>
        {message}
      </Text>
    ));
  const inputStyle = [
    styles.input,
    { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
  ];
  const fieldTypes = TEMPLATE_FIELD_TYPES_MESSAGES.map(({ id, value }) => ({ value: id, label: _(value) }));
  const operations = TEMPLATE_OPERATIONS_MESSAGES.map(({ id, value }) => ({ value: id, label: _(value) }));

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={{ color: colors.muted }}>
            {_(msg`mobile.templates.created-at`)}: {formatTimestamp(template.createdAt, "datetime")}
          </Text>
          {template.updatedAt && (
            <Text style={{ color: colors.muted }}>
              {_(msg`mobile.templates.updated-at`)}: {formatTimestamp(template.updatedAt, "datetime")}
            </Text>
          )}
        </View>
        <View style={styles.field}>
          <Text style={{ color: colors.muted }}>{_(msg`mobile.templates.template-title`)}</Text>
          <form.Field name="title">
            {(field) => (
              <TextInput
                accessibilityLabel={_(msg`mobile.templates.template-title`)}
                value={field.state.value}
                onChangeText={field.handleChange}
                style={inputStyle}
              />
            )}
          </form.Field>
          {errorText("title")}
        </View>
        <View style={styles.field}>
          <Text style={{ color: colors.muted }}>{_(msg`mobile.templates.notes`)}</Text>
          <form.Field name="notes">
            {(field) => (
              <TextInput
                accessibilityLabel={_(msg`mobile.templates.notes`)}
                multiline
                value={field.state.value ?? ""}
                onChangeText={field.handleChange}
                style={[inputStyle, styles.notes]}
              />
            )}
          </form.Field>
          {errorText("notes")}
        </View>
        <Text style={{ color: colors.text }}>
          {isLocked ? _(msg`mobile.templates.locked`) : _(msg`mobile.templates.unlocked`)}
        </Text>
        <View style={styles.section}>
          <Text style={[styles.heading, { color: colors.text }]}>{_(msg`mobile.templates.fields`)}</Text>
          <form.Field name="content.fields" mode="array">
            {(fieldsField) => (
              <>
                <SortableList
                  items={fieldsField.state.value}
                  keyOf={(item) => item.id}
                  handleLabel={(_item, i) => {
                    const fieldNumber = i + 1;
                    return _(msg`mobile.templates.reorder-field ${fieldNumber}`);
                  }}
                  onMove={(from, to) => fieldsField.moveValue(from, to)}
                  renderItem={(item, i) => {
                    const fieldNumber = i + 1;
                    return (
                      <View style={[styles.row, { borderColor: colors.border }]}>
                        <form.Field name={`content.fields[${i}].title`}>
                          {(field) => (
                            <TextInput
                              accessibilityLabel={_(msg`mobile.templates.field-title ${fieldNumber}`)}
                              placeholder={_(msg`mobile.templates.untitled-field`)}
                              placeholderTextColor={colors.muted}
                              value={field.state.value}
                              onChangeText={field.handleChange}
                              style={inputStyle}
                            />
                          )}
                        </form.Field>
                        <form.Field name={`content.fields[${i}].type`}>
                          {(field) => (
                            <ChoiceGroup
                              label={_(msg`mobile.templates.field-type ${fieldNumber}`)}
                              choices={fieldTypes}
                              value={field.state.value}
                              isDisabled={isLocked}
                              onChange={(type) => field.handleChange(type as TemplateFieldType)}
                            />
                          )}
                        </form.Field>
                        <form.Field name={`content.fields[${i}].isRequired`}>
                          {(field) => (
                            <LabeledSwitch
                              text={_(msg`mobile.templates.required`)}
                              accessibilityLabel={_(msg`mobile.templates.field-required ${fieldNumber}`)}
                              value={field.state.value}
                              isDisabled={isLocked}
                              onChange={field.handleChange}
                            />
                          )}
                        </form.Field>
                        {!isLocked && fieldsField.state.value.length > 1 && (
                          <ActionButton
                            label={_(msg`mobile.templates.remove-field ${fieldNumber}`)}
                            isDanger
                            onPress={() => {
                              fieldsField.removeValue(i);
                              form.setFieldValue(
                                "content.layout",
                                form.state.values.content.layout.filter((layoutItem) => layoutItem.field !== item.id),
                              );
                            }}
                          />
                        )}
                      </View>
                    );
                  }}
                />
                {!isLocked && (
                  <ActionButton
                    label={_(msg`mobile.templates.add-field`)}
                    onPress={() => {
                      const id = newId();
                      fieldsField.pushValue({ ...DEFAULT_TEMPLATE_FIELD, id });
                      form.pushFieldValue("content.layout", { field: id, operation: "display" });
                    }}
                  />
                )}
              </>
            )}
          </form.Field>
          {errorText("fields")}
        </View>
        <View style={styles.section}>
          <Text style={[styles.heading, { color: colors.text }]}>{_(msg`mobile.templates.layout`)}</Text>
          <form.Subscribe selector={(state) => state.values.content.fields}>
            {(fields) => (
              <form.Field name="content.layout" mode="array">
                {(layoutField) => (
                  <SortableList
                    items={layoutField.state.value}
                    keyOf={(item) => item.field}
                    handleLabel={(_item, i) => {
                      const rowNumber = i + 1;
                      return _(msg`mobile.templates.reorder-layout-row ${rowNumber}`);
                    }}
                    onMove={(from, to) => layoutField.moveValue(from, to)}
                    renderItem={(item, i) => {
                      const rowNumber = i + 1;
                      const fieldTitle =
                        fields.find((field) => field.id === item.field)?.title ||
                        _(msg`mobile.templates.untitled-field`);
                      return (
                        <View style={[styles.row, { borderColor: colors.border }]}>
                          <form.Field name={`content.layout[${i}].operation`}>
                            {(field) => (
                              <ChoiceGroup
                                label={_(msg`mobile.templates.layout-row ${rowNumber} ${fieldTitle}`)}
                                choices={operations}
                                value={field.state.value}
                                onChange={(operation) => field.handleChange(operation as TemplateOperation)}
                              />
                            )}
                          </form.Field>
                        </View>
                      );
                    }}
                  />
                )}
              </form.Field>
            )}
          </form.Subscribe>
          {errorText("layout")}
        </View>
        <View style={styles.field}>
          <ActionButton label={_(msg`mobile.templates.clone`)} onPress={onClone} />
        </View>
        <DeleteTemplate template={template} onDeleted={onDeleted} />
      </ScrollView>
      <View style={styles.footer}>
        {errorText("form")}
        <form.Subscribe selector={(state) => [state.isDirty, state.isSubmitting] as const}>
          {([isDirty, isSubmitting]) => (
            <View style={styles.actions}>
              <ActionButton
                label={_(msg`mobile.templates.discard`)}
                isDisabled={!isDirty || isSubmitting}
                onPress={() => {
                  setErrors({});
                  form.reset();
                }}
              />
              <ActionButton
                label={_(msg`mobile.templates.save`)}
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
  notes: { minHeight: 88, textAlignVertical: "top" },
  footer: { padding: 16, gap: 8 },
  actions: { flexDirection: "row", gap: 12 },
});
