import { cloneTemplateSchema } from "@koloda/srs";
import type { Template } from "@koloda/srs";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useMobileQueries } from "../host/queries-context";
import { TitleForm } from "./title-form";

export type CloneTemplateProps = {
  sourceId: Template["id"];
  onCloned: (template: Template) => void;
};

export function CloneTemplate({ sourceId, onCloned }: CloneTemplateProps) {
  const { _ } = useLingui();
  const { cloneTemplateMutation } = useMobileQueries();

  return (
    <TitleForm
      submitLabel={_(msg`mobile.templates.clone`)}
      toData={(title) => ({ title, sourceId })}
      schema={cloneTemplateSchema}
      mutation={cloneTemplateMutation()}
      kinds={["templates"]}
      onDone={onCloned}
    />
  );
}
