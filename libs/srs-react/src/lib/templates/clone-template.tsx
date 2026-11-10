import { queriesAtom } from "@koloda/core-react";
import { cloneTemplateSchema } from "@koloda/srs";
import type { Template } from "@koloda/srs";
import { msg } from "@lingui/core/macro";
import { useAtomValue } from "jotai";
import { CloneEntity } from "../components/clone-entity";
import type { CloneEntityMessages } from "../components/clone-entity";

type CloneTemplateProps = { id: Template["id"] };

const MESSAGES: CloneEntityMessages = {
  trigger: msg`clone-template.trigger`,
  titleLabel: msg`clone-template.inputs.title.label`,
  link: msg`clone-template.redirect.link`,
  submit: msg`clone-template.submit`,
  success: msg`clone-template.success`,
};

export function CloneTemplate({ id }: CloneTemplateProps) {
  const { cloneTemplateMutation } = useAtomValue(queriesAtom);

  return (
    <CloneEntity
      id={id}
      schema={cloneTemplateSchema}
      mutation={cloneTemplateMutation()}
      kinds={["templates"]}
      messages={MESSAGES}
      getLink={(templateId) => ({ to: "/templates/$templateId", params: { templateId } })}
    />
  );
}
