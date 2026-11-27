import { ERROR_MESSAGES, formatAppError, MOTION_SETTINGS, SCHEMES } from "@koloda/app";
import { motionSettingAtom, schemeAtom } from "@koloda/core-react";
import { ErrorMessage, FormLayout, ToggleGroup } from "@koloda/ui";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useAtomValue } from "jotai";
import { DarkThemePicker, LightThemePicker } from "./interface-controls/color-theme-picker";
import { LanguagePicker } from "./interface-controls/language-picker";
import { TimestampFormatSection } from "./interface-controls/timestamp-format";
import { DATE_FORMAT_PRESETS, TIME_FORMAT_PRESETS } from "./interface-controls/use-timestamp-format";
import {
  useInterfaceSettingWrite,
  useInterfaceSettingWriteError,
} from "./interface-controls/use-interface-setting-write";

export function SettingsInterface() {
  const { _ } = useLingui();
  const scheme = useAtomValue(schemeAtom);
  const motion = useAtomValue(motionSettingAtom);
  const write = useInterfaceSettingWrite();
  const writeError = useInterfaceSettingWriteError();

  return (
    <FormLayout>
      {writeError && (
        <div role="alert">
          <ErrorMessage {...formatAppError(writeError, _, ERROR_MESSAGES["db.update"])} layout="inline" />
        </div>
      )}
      <LanguagePicker variants={{ layout: "form" }} label={_(msg`settings.interface.language`)} showIcon={false} />
      <FormLayout.Section term={_(msg`settings.interface.scheme`)}>
        <ToggleGroup
          disallowEmptySelection
          selectedKeys={[scheme]}
          onSelectionChange={([value]) => write("scheme", value.toString())}
        >
          <ToggleGroup.Item id="light">{_(SCHEMES.light)}</ToggleGroup.Item>
          <ToggleGroup.Item id="dark">{_(SCHEMES.dark)}</ToggleGroup.Item>
          <ToggleGroup.Item id="system">{_(SCHEMES.system)}</ToggleGroup.Item>
        </ToggleGroup>
      </FormLayout.Section>
      <LightThemePicker variants={{ layout: "form" }} />
      <DarkThemePicker variants={{ layout: "form" }} />
      <FormLayout.Section term={_(msg`settings.interface.motion`)}>
        <ToggleGroup
          disallowEmptySelection
          selectedKeys={[motion]}
          onSelectionChange={([value]) => write("motion", value.toString())}
        >
          {Object.entries(MOTION_SETTINGS).map(([id, t]) => (
            <ToggleGroup.Item id={id} key={id}>
              {_(t)}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup>
      </FormLayout.Section>
      <TimestampFormatSection
        kind="date"
        label={msg`settings.interface.date-format`}
        localeLabel={msg`settings.interface.date-format.locale`}
        customLabel={msg`settings.interface.date-format.custom`}
        preview={(value) => _(msg`settings.interface.date-format.preview ${value}`)}
        presets={DATE_FORMAT_PRESETS}
      />
      <TimestampFormatSection
        kind="time"
        label={msg`settings.interface.time-format`}
        localeLabel={msg`settings.interface.time-format.locale`}
        preview={(value) => _(msg`settings.interface.time-format.preview ${value}`)}
        presets={TIME_FORMAT_PRESETS}
      />
    </FormLayout>
  );
}
