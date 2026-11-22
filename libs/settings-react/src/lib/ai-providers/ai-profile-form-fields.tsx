import { SECRETS_LABELS } from "@koloda/ai-react";
import type { ZodIssue } from "@koloda/app";
import { Label, TextField } from "@koloda/ui";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import type { ReactNode } from "react";
import type { AIProfileHeaderRow, AIProfileProviderField, AIProfileTextFieldType } from "./ai-provider-form-config";
import { AIProfileHeadersField } from "./ai-profile-headers-field";
import { AIProfileSecretsField } from "./ai-profile-secrets-field";

type FieldApi = {
  state: {
    value: string | undefined;
    meta: { isValid: boolean; errors: unknown };
  };
  handleBlur: () => void;
  handleChange: (value: string) => void;
};

type HeaderRowsFieldApi = {
  state: { value: AIProfileHeaderRow[] | undefined };
  pushValue: (row: AIProfileHeaderRow) => void;
  removeValue: (index: number) => void;
};

export type AIProfileForm = {
  Field: {
    (props: { name: AIProfileTextFieldType; children: (field: FieldApi) => ReactNode }): ReactNode;
    (props: { name: "headers"; mode: "array"; children: (field: HeaderRowsFieldApi) => ReactNode }): ReactNode;
    (props: {
      name: `headers[${number}].name` | `headers[${number}].value`;
      children: (field: FieldApi) => ReactNode;
    }): ReactNode;
  };
};

export type AIProfileFormFieldsProps = {
  form: AIProfileForm;
  fields: AIProfileProviderField[];
  mode: "add" | "edit";
  hasSecrets?: boolean;
};

export function AIProfileFormFields({ form, fields, mode, hasSecrets = false }: AIProfileFormFieldsProps) {
  const { _ } = useLingui();

  return fields.map((fieldConfig) => {
    if (fieldConfig.type === "headers") return <AIProfileHeadersField key="headers" form={form} />;

    if (fieldConfig.type === "modelIds") {
      return (
        <form.Field key="modelIds" name="modelIds">
          {(field) => (
            <TextField value={field.state.value ?? ""} onBlur={field.handleBlur} onChange={field.handleChange}>
              <Label>{_(msg`settings.ai.profiles.model-ids.label`)}</Label>
              <TextField.TextArea rows={3} placeholder={_(msg`settings.ai.profiles.model-ids.placeholder`)} />
              {!field.state.meta.isValid && <TextField.Errors errors={field.state.meta.errors as ZodIssue[]} />}
            </TextField>
          )}
        </form.Field>
      );
    }

    const placeholder =
      fieldConfig.type === "title"
        ? _(msg`settings.ai.profiles.title.placeholder`)
        : fieldConfig.type === "baseUrl"
          ? fieldConfig.defaultValue
          : undefined;

    const label =
      fieldConfig.type === "title" ? _(msg`settings.ai.profiles.title.label`) : _(SECRETS_LABELS[fieldConfig.type]);

    return (
      <form.Field key={fieldConfig.type} name={fieldConfig.type}>
        {(field) => {
          if (fieldConfig.type === "apiKey" && mode === "edit") {
            return (
              <AIProfileSecretsField
                label={label}
                value={field.state.value}
                onChange={field.handleChange}
                hasSecrets={hasSecrets}
                errors={!field.state.meta.isValid ? (field.state.meta.errors as ZodIssue[]) : undefined}
              />
            );
          }

          return (
            <TextField
              type={fieldConfig.type === "baseUrl" ? "url" : fieldConfig.type === "apiKey" ? "password" : undefined}
              value={field.state.value ?? ""}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              isRequired={fieldConfig.isRequired}
            >
              <Label>{label}</Label>
              <TextField.Input placeholder={placeholder} />
              {!field.state.meta.isValid && <TextField.Errors errors={field.state.meta.errors as ZodIssue[]} />}
            </TextField>
          );
        }}
      </form.Field>
    );
  });
}
