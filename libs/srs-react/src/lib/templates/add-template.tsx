import { generateUuidv7 } from "@koloda/app";
import { queriesAtom } from "@koloda/core-react";
import { DEFAULT_TEMPLATE, insertTemplateSchema as schema, translateDefaultTemplateContent } from "@koloda/srs";
import type { InsertTemplateData } from "@koloda/srs";
import {
  AddIcon,
  Button,
  Dialog,
  Label,
  Link,
  link,
  TextField,
  Tooltip,
  useAppForm,
  useMotionSetting,
} from "@koloda/ui";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useStore } from "@tanstack/react-form";
import { useAtomValue } from "jotai";
import { useCreateEntityDialog } from "../components/use-create-entity-dialog";

export function AddTemplate() {
  const { _ } = useLingui();
  const { addTemplateMutation } = useAtomValue(queriesAtom);
  const isMotionOn = useMotionSetting();
  const { isOpen, setIsOpen, listeners, submit, linkRef, newId, isLinkVisible } = useCreateEntityDialog(
    addTemplateMutation(),
    ["templates"],
  );
  const form = useAppForm({
    defaultValues: { ...DEFAULT_TEMPLATE, title: "" } as InsertTemplateData,
    validators: { onSubmit: schema },
    listeners,
    onSubmit: async ({ value, formApi }) => {
      // WHY: the default fields are built per add, in the current language and with their own ids.
      // `defaultValues` holds the seed ids, and the reset after a success restores them, so ids minted
      // there would repeat on the next add.
      const defaults = translateDefaultTemplateContent(_);
      const fieldIds = new Map(defaults.fields.map((field) => [field.id, generateUuidv7()]));
      const content = {
        fields: defaults.fields.map((field) => ({ ...field, id: fieldIds.get(field.id) ?? field.id })),
        layout: defaults.layout.map((item) => ({ ...item, field: fieldIds.get(item.field) ?? item.field })),
      };
      await submit(schema.parse({ ...value, content }), formApi);
    },
  });

  const formErrorMap = useStore(form.store, (state) => state.errorMap);

  return (
    <Dialog.Root isOpen={isOpen} onOpenChange={setIsOpen}>
      <Tooltip content={_(msg`add-template.trigger`)}>
        <Button variants={{ style: "dashed", size: "icon" }} aria-label={_(msg`add-template.trigger`)}>
          <AddIcon className="size-4 min-w-4" strokeWidth={3} aria-hidden="true" />
        </Button>
      </Tooltip>
      <Dialog.Popover variants={{ class: "min-w-84" }}>
        <Dialog.Body>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            <Dialog.Header>
              <Dialog.Title>{_(msg`add-template.title`)}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Content variants={{ class: "min-h-34" }}>
              <form.Field name="title">
                {(field) => (
                  <TextField
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e)}
                    autoFocus
                  >
                    <Label>{_(msg`add-template.inputs.title.label`)}</Label>
                    <TextField.Input />
                  </TextField>
                )}
              </form.Field>
              <div className="min-h-10 mt-4">
                {formErrorMap.onSubmit && <form.Errors errors={formErrorMap.onSubmit} />}
              </div>
            </Dialog.Content>
            <Dialog.Footer>
              {isLinkVisible && (
                <Link
                  className={link({ type: "added" })}
                  ref={linkRef}
                  to="/templates/$templateId"
                  params={{ templateId: newId }}
                  onClick={() => setIsOpen(false)}
                  viewTransition={isMotionOn}
                >
                  {_(msg`add-template.redirect.link`)}
                </Link>
              )}
              <div className="grow" />
              <form.Subscribe selector={(state) => [state.canSubmit]}>
                {([canSubmit]) => (
                  <Button variants={{ style: "primary" }} type="submit" isDisabled={!canSubmit || isLinkVisible}>
                    {isLinkVisible ? _(msg`add-template.success`) : _(msg`add-template.submit`)}
                  </Button>
                )}
              </form.Subscribe>
            </Dialog.Footer>
          </form>
        </Dialog.Body>
      </Dialog.Popover>
    </Dialog.Root>
  );
}
