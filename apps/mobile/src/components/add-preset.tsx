import { DEFAULT_FSRS_ALGORITHM, insertAlgorithmSchema } from "@koloda/srs";
import type { Algorithm } from "@koloda/srs";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useMobileQueries } from "../host/queries-context";
import { TitleForm } from "./title-form";

export type AddPresetProps = {
  onAdded: (algorithm: Algorithm) => void;
};

export function AddPreset({ onAdded }: AddPresetProps) {
  const { _ } = useLingui();
  const { addAlgorithmMutation } = useMobileQueries();

  return (
    <TitleForm
      submitLabel={_(msg`mobile.presets.add`)}
      // INVARIANT: a new preset starts from the built-in FSRS defaults (ALGORITHMS.md §Adding Algorithms).
      toData={(title) => ({ title, content: DEFAULT_FSRS_ALGORITHM })}
      schema={insertAlgorithmSchema}
      mutation={addAlgorithmMutation()}
      kinds={["algorithms"]}
      onDone={onAdded}
    />
  );
}
