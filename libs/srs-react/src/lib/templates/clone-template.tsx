import { queriesAtom } from "@koloda/core-react";
import { cloneTemplateSchema as schema } from "@koloda/srs";
import type { Template } from "@koloda/srs";
import { Button, CloneIcon, Dialog, Label, Link, link, TextField, useAppForm, useMotionSetting } from "@koloda/ui";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useStore } from "@tanstack/react-form";
import { useAtomValue } from "jotai";
import { useCreateEntityDialog } from "../components/use-create-entity-dialog";

type CloneTemplateProps = { id: Template["id"] };

export function CloneTemplate({ id }: CloneTemplateProps) {
  const { _ } = useLingui();
  const { cloneTemplateMutation } = useAtomValue(queriesAtom);
  const isMotionOn = useMotionSetting();
  const { isOpen, setIsOpen, listeners, submit, linkRef, newId, isLinkVisible } = useCreateEntityDialog(
    cloneTemplateMutation(),
    ["templates"],
  );
  const form = useAppForm({
    defaultValues: { title: "", sourceId: id },
    validators: { onSubmit: schema },
    listeners,
    onSubmit: async ({ value, formApi }) => {
      await submit(schema.parse(value), formApi);
    },
  });
  const formErrorMap = useStore(form.store, (state) => state.errorMap);

  return (
    <Dialog.Root isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button variants={{ style: "primary" }}>
        <CloneIcon className="size-5 min-w-5" strokeWidth={1.75} aria-hidden="true" />
        {_(msg`clone-template.trigger`)}
      </Button>
      <Dialog.Popover variants={{ class: "min-w-84" }}>
        <Dialog.Body>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            <Dialog.Content>
              <form.Field name="title">
                {(field) => (
                  <TextField
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={field.handleChange}
                    autoFocus
                  >
                    <Label>{_(msg`clone-template.inputs.title.label`)}</Label>
                    <TextField.Input />
                  </TextField>
                )}
              </form.Field>
              <div className="min-h-10">{formErrorMap.onSubmit && <form.Errors errors={formErrorMap.onSubmit} />}</div>
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
                  {_(msg`clone-template.redirect.link`)}
                </Link>
              )}
              <div className="grow" />
              <form.Subscribe selector={(state) => [state.canSubmit]}>
                {([canSubmit]) => (
                  <Button variants={{ style: "primary" }} type="submit" isDisabled={!canSubmit || isLinkVisible}>
                    {isLinkVisible ? _(msg`clone-template.success`) : _(msg`clone-template.submit`)}
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
