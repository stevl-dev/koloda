import { queriesAtom } from "@koloda/core-react";
import { cloneAlgorithmSchema } from "@koloda/srs";
import type { Algorithm } from "@koloda/srs";
import { msg } from "@lingui/core/macro";
import { useAtomValue } from "jotai";
import { CloneEntity } from "../components/clone-entity";
import type { CloneEntityMessages } from "../components/clone-entity";

type CloneAlgorithmProps = { id: Algorithm["id"] };

const MESSAGES: CloneEntityMessages = {
  trigger: msg`clone-algorithm.trigger`,
  titleLabel: msg`clone-algorithm.inputs.title.label`,
  link: msg`clone-algorithm.redirect.link`,
  submit: msg`clone-algorithm.submit`,
  success: msg`clone-algorithm.success`,
};

export function CloneAlgorithm({ id }: CloneAlgorithmProps) {
  const { cloneAlgorithmMutation } = useAtomValue(queriesAtom);

  return (
    <CloneEntity
      id={id}
      schema={cloneAlgorithmSchema}
      mutation={cloneAlgorithmMutation()}
      kinds={["algorithms"]}
      messages={MESSAGES}
      getLink={(algorithmId) => ({ to: "/algorithms/$algorithmId", params: { algorithmId } })}
    />
  );
}
