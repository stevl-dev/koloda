import { insertTemplateSchema, translateDefaultTemplateContent } from "@koloda/srs";
import type { Template } from "@koloda/srs";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useMobileQueries } from "../host/queries-context";
import { TitleForm } from "./title-form";

export type AddTemplateProps = {
  onAdded: (template: Template) => void;
};

export function AddTemplate({ onAdded }: AddTemplateProps) {
  const { _ } = useLingui();
  const { addTemplateMutation, newId } = useMobileQueries();

  return (
    <TitleForm
      submitLabel={_(msg`mobile.templates.add`)}
      // WHY: the default fields are built per add, in the interface language and with ids of their own
      // (TEMPLATES.md §Adding Templates).
      toData={(title) => {
        const defaults = translateDefaultTemplateContent(_);
        const ids = new Map(defaults.fields.map((field) => [field.id, newId()]));
        return {
          title,
          content: {
            fields: defaults.fields.map((field) => ({ ...field, id: ids.get(field.id) ?? field.id })),
            layout: defaults.layout.map((item) => ({ ...item, field: ids.get(item.field) ?? item.field })),
          },
        };
      }}
      schema={insertTemplateSchema}
      mutation={addTemplateMutation()}
      kinds={["templates"]}
      onDone={onAdded}
    />
  );
}
