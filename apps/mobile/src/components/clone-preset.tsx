import { cloneAlgorithmSchema } from "@koloda/srs";
import type { Algorithm } from "@koloda/srs";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useMobileQueries } from "../host/queries-context";
import { TitleForm } from "./title-form";

export type ClonePresetProps = {
  sourceId: Algorithm["id"];
  onCloned: (algorithm: Algorithm) => void;
};

export function ClonePreset({ sourceId, onCloned }: ClonePresetProps) {
  const { _ } = useLingui();
  const { cloneAlgorithmMutation } = useMobileQueries();

  return (
    <TitleForm
      submitLabel={_(msg`mobile.presets.clone`)}
      toData={(title) => ({ title, sourceId })}
      schema={cloneAlgorithmSchema}
      mutation={cloneAlgorithmMutation()}
      kinds={["algorithms"]}
      onDone={onCloned}
    />
  );
}
