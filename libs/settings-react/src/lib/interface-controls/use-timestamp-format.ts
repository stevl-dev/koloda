import { formatTimestamp, interfaceSettingsValidation } from "@koloda/app";
import type { ErrorCode, TimestampKind } from "@koloda/app";
import { dateFormatAtom, langAtom, timeFormatAtom } from "@koloda/core-react";
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import type { InterfaceField } from "./interface-setting-atoms";

export const LOCALE_OPTION = "locale";
// WHY: underscore fails the token whitelist, so this id can never collide with a storable pattern.
export const CUSTOM_OPTION = "__custom";

export type TimestampFormatPreset = {
  value: string;
  /** Displayed instead of the raw pattern when present. */
  label?: MessageDescriptor;
};

export const DATE_FORMAT_PRESETS: readonly TimestampFormatPreset[] = [
  { value: "yyyy-MM-dd" },
  { value: "dd.MM.yyyy" },
  { value: "MM/dd/yyyy" },
];
export const TIME_FORMAT_PRESETS: readonly TimestampFormatPreset[] = [
  { value: "hh:mm a", label: msg`settings.interface.time-format.12-hour` },
  { value: "HH:mm", label: msg`settings.interface.time-format.24-hour` },
];

function toOption(presets: readonly TimestampFormatPreset[], allowsCustom: boolean, value: string): string {
  if (value === LOCALE_OPTION || presets.some((preset) => preset.value === value)) {
    return value;
  }
  // WHY: A stored custom date pattern maps to Custom; without a custom option (time) it stays its own row.
  return allowsCustom ? CUSTOM_OPTION : value;
}

export type TimestampFormatOptions = {
  kind: TimestampKind;
  presets: readonly TimestampFormatPreset[];
  allowsCustom: boolean;
  write: (field: InterfaceField, value: string) => void;
};

/** The state of one timestamp format control, shared by the desktop select and the mobile choices. */
export function useTimestampFormat({ kind, presets, allowsCustom, write }: TimestampFormatOptions) {
  const locale = useAtomValue(langAtom);
  const savedDate = useAtomValue(dateFormatAtom);
  const savedTime = useAtomValue(timeFormatAtom);

  const saved = kind === "date" ? savedDate : savedTime;
  const schema =
    kind === "date" ? interfaceSettingsValidation.shape.dateFormat : interfaceSettingsValidation.shape.timeFormat;
  const errorCode: ErrorCode =
    kind === "date" ? "validation.settings-interface.date-format" : "validation.settings-interface.time-format";
  const [selection, setSelection] = useState(() => toOption(presets, allowsCustom, saved));
  const [pattern, setPattern] = useState(saved === LOCALE_OPTION ? "" : saved);
  const [error, setError] = useState<ErrorCode | undefined>(undefined);
  const [now, setNow] = useState(() => new Date());

  // WHY: re-echo the saved value whenever it changes (hydration, preset pick, own commit) so the
  // select and field never drift from the setting and stale errors do not linger.
  useEffect(() => {
    setSelection(toOption(presets, allowsCustom, saved));
    setPattern(saved === LOCALE_OPTION ? "" : saved);
    setError(undefined);
  }, [saved, presets, allowsCustom]);

  // WHY: the preview promises the current date/time, so the clock keeps running while the page
  // sits idle; 1s because a custom pattern can show seconds (presets are minute-granular).
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const save = (value: string) => write(kind === "date" ? "dateFormat" : "timeFormat", value);

  const select = (next: string) => {
    setSelection(next);
    setError(undefined);
    if (next !== CUSTOM_OPTION) {
      save(next);
    }
  };

  const commit = () => {
    // WHY: Empty means "nothing chosen yet": stay on Custom without writing or erroring.
    if (pattern === "" || pattern === saved) {
      setError(undefined);
      return;
    }
    if (!schema.safeParse(pattern).success) {
      setError(errorCode);
      return;
    }
    setError(undefined);
    save(pattern);
  };

  const previewPattern = schema.safeParse(pattern).success ? pattern : saved;
  const previewFormats =
    kind === "date"
      ? { dateFormat: previewPattern, timeFormat: savedTime }
      : { dateFormat: savedDate, timeFormat: previewPattern };
  const previewValue = formatTimestamp(now, kind, previewFormats, locale);

  return { saved, selection, pattern, setPattern, error, select, commit, previewValue };
}
