import type { ZodIssue } from "@koloda/app";
import { AddIcon, Button, DeleteIcon, Label, TextField } from "@koloda/ui";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useId } from "react";
import type { AIProfileForm } from "./ai-profile-form-fields";
import { AIProfileSecretsField } from "./ai-profile-secrets-field";

export type AIProfileHeadersFieldProps = {
  form: AIProfileForm;
};

export function AIProfileHeadersField({ form }: AIProfileHeadersFieldProps) {
  const { _ } = useLingui();
  const headingId = useId();

  return (
    <form.Field name="headers" mode="array">
      {(field) => (
        <div className="flex flex-col gap-2" role="group" aria-labelledby={headingId}>
          <Label elementType="span" id={headingId}>
            {_(msg`settings.ai.profiles.headers.label`)}
          </Label>
          {(field.state.value ?? []).map((row, index) => {
            const rowNumber = index + 1;
            return (
              // WHY: a stored row keeps its masked state in `AIProfileSecretsField`, so its key follows the
              // row, not the index, when a row above it is removed. Stored names are unique.
              <div className="flex flex-row items-end gap-2" key={row.isStored ? `stored:${row.name}` : `new:${index}`}>
                <form.Field name={`headers[${index}].name`}>
                  {(nameField) => (
                    <TextField
                      variants={{ class: "grow" }}
                      value={nameField.state.value ?? ""}
                      onBlur={nameField.handleBlur}
                      onChange={nameField.handleChange}
                      // WHY: a stored value belongs to its name; renaming means removing the row and adding one.
                      isReadOnly={row.isStored}
                    >
                      <Label>{_(msg`settings.ai.profiles.headers.name.${rowNumber}`)}</Label>
                      <TextField.Input />
                      {!nameField.state.meta.isValid && (
                        <TextField.Errors errors={nameField.state.meta.errors as ZodIssue[]} />
                      )}
                    </TextField>
                  )}
                </form.Field>
                <form.Field name={`headers[${index}].value`}>
                  {(valueField) => {
                    const label = _(msg`settings.ai.profiles.headers.value.${rowNumber}`);
                    const errors = !valueField.state.meta.isValid
                      ? (valueField.state.meta.errors as ZodIssue[])
                      : undefined;
                    if (row.isStored) {
                      return (
                        <AIProfileSecretsField
                          label={label}
                          value={valueField.state.value}
                          onChange={valueField.handleChange}
                          hasSecrets
                          errors={errors}
                        />
                      );
                    }
                    return (
                      <TextField
                        type="password"
                        variants={{ class: "grow" }}
                        value={valueField.state.value ?? ""}
                        onBlur={valueField.handleBlur}
                        onChange={valueField.handleChange}
                      >
                        <Label>{label}</Label>
                        <TextField.Input />
                        {errors && <TextField.Errors errors={errors} />}
                      </TextField>
                    );
                  }}
                </form.Field>
                <Button
                  variants={{ style: "ghost", size: "icon" }}
                  aria-label={_(msg`settings.ai.profiles.headers.remove.${rowNumber}`)}
                  onClick={() => field.removeValue(index)}
                >
                  <DeleteIcon className="size-5 min-w-5 mx-0.5" strokeWidth={1.75} aria-hidden="true" />
                </Button>
              </div>
            );
          })}
          <Button
            variants={{ style: "dashed" }}
            onClick={() => field.pushValue({ name: "", value: "", isStored: false })}
          >
            <AddIcon className="size-4 min-w-4" strokeWidth={3} aria-hidden="true" />
            {_(msg`settings.ai.profiles.headers.add`)}
          </Button>
        </div>
      )}
    </form.Field>
  );
}
