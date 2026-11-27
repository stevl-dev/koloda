import type { TimestampKind } from "@koloda/app";
import { FormLayout, Select, TextField } from "@koloda/ui";
import type { MessageDescriptor } from "@lingui/core";
import { useLingui } from "@lingui/react";
import { useInterfaceSettingWrite } from "./use-interface-setting-write";
import { CUSTOM_OPTION, LOCALE_OPTION, useTimestampFormat } from "./use-timestamp-format";
import type { TimestampFormatPreset } from "./use-timestamp-format";

export type TimestampFormatSectionProps = {
  kind: TimestampKind;
  label: MessageDescriptor;
  localeLabel: MessageDescriptor;
  /** Present only where the select offers Custom: reveals the pattern field row. */
  customLabel?: MessageDescriptor;
  preview: (formatted: string) => string;
  presets: readonly TimestampFormatPreset[];
};

export function TimestampFormatSection({
  kind,
  label,
  localeLabel,
  customLabel,
  preview,
  presets,
}: TimestampFormatSectionProps) {
  const { _ } = useLingui();
  const write = useInterfaceSettingWrite();
  const allowsCustom = customLabel != null;
  const { saved, selection, pattern, setPattern, error, select, commit, previewValue } = useTimestampFormat({
    kind,
    presets,
    allowsCustom,
    write,
  });

  const onChange = (key: string | number | null) => {
    if (key != null) select(key.toString());
  };

  const options = [
    { id: LOCALE_OPTION, text: _(localeLabel) },
    ...presets.map((preset) => ({ id: preset.value, text: preset.label ? _(preset.label) : preset.value })),
    ...(customLabel ? [{ id: CUSTOM_OPTION, text: _(customLabel) }] : []),
    ...(!allowsCustom && saved !== LOCALE_OPTION && !presets.some((preset) => preset.value === saved)
      ? [{ id: saved, text: saved }]
      : []),
  ];

  return (
    <FormLayout.Section term={_(label)}>
      <div className="flex flex-col gap-3">
        {/* WHY: the row's max-content (select + field + gaps) decides whether the wd:flex-wrap
          section stacks under its label, so the field's w-60 pins its footprint to the control
          width; flex-wrap drops the field onto its own line instead when the column is tight. */}
        <div className="flex flex-wrap items-start gap-2">
          {/* WHY: form layout mirrors the other selects' max-w-60; min-w-60 floors the fit-content cell. */}
          <Select
            popoverVariants={{ class: "min-w-48 w-[var(--trigger-width)]" }}
            buttonVariants={{ layout: "form", class: "min-w-60" }}
            aria-label={_(label)}
            items={options}
            value={selection}
            onChange={onChange}
          >
            {({ id, text }) => (
              <Select.ListBoxItem id={id} textValue={text} key={id}>
                {text}
              </Select.ListBoxItem>
            )}
          </Select>
          {customLabel != null && selection === CUSTOM_OPTION && (
            <div className="flex flex-col gap-2 w-60">
              <TextField
                aria-label={_(customLabel)}
                value={pattern}
                onChange={setPattern}
                onBlur={commit}
                isInvalid={Boolean(error)}
              >
                <TextField.Input
                  placeholder={presets[0].value}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commit();
                    }
                  }}
                />
              </TextField>
              {error && <TextField.Errors errors={[{ message: error }]} />}
            </div>
          )}
        </div>
        <p className="fg-level-4 text-sm">{preview(previewValue)}</p>
      </div>
    </FormLayout.Section>
  );
}
