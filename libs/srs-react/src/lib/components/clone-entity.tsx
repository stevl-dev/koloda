import type { AppError } from "@koloda/app";
import type { DataKind } from "@koloda/core-react";
import type { cloneAlgorithmSchema, cloneTemplateSchema } from "@koloda/srs";
import { Button, CloneIcon, Dialog, Label, Link, link, TextField, useAppForm, useMotionSetting } from "@koloda/ui";
import type { MessageDescriptor } from "@lingui/core";
import { useLingui } from "@lingui/react";
import { useStore } from "@tanstack/react-form";
import type { UseMutationOptions } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { useCreateEntityDialog } from "./use-create-entity-dialog";

type CloneData = { title: string; sourceId: string };

export type CloneEntityMessages = Record<"trigger" | "titleLabel" | "link" | "submit" | "success", MessageDescriptor>;

type CloneEntityProps<TData extends { id: string }> = {
  id: string;
  schema: typeof cloneAlgorithmSchema | typeof cloneTemplateSchema;
  mutation: UseMutationOptions<TData, AppError, CloneData, unknown>;
  kinds: readonly DataKind[];
  messages: CloneEntityMessages;
  getLink: (newId: string) => Pick<ComponentProps<typeof Link>, "to" | "params">;
};

export function CloneEntity<TData extends { id: string }>({
  id,
  schema,
  mutation,
  kinds,
  messages,
  getLink,
}: CloneEntityProps<TData>) {
  const { _ } = useLingui();
  const isMotionOn = useMotionSetting();
  const { isOpen, setIsOpen, listeners, submit, linkRef, newId, isLinkVisible } = useCreateEntityDialog(
    mutation,
    kinds,
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
        {_(messages.trigger)}
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
                    <Label>{_(messages.titleLabel)}</Label>
                    <TextField.Input />
                  </TextField>
                )}
              </form.Field>
              <div className="min-h-10">{formErrorMap.onSubmit && <form.Errors errors={formErrorMap.onSubmit} />}</div>
            </Dialog.Content>
            <Dialog.Footer>
              {isLinkVisible && newId && (
                <Link
                  className={link({ type: "added" })}
                  ref={linkRef}
                  {...getLink(newId)}
                  onClick={() => setIsOpen(false)}
                  viewTransition={isMotionOn}
                >
                  {_(messages.link)}
                </Link>
              )}
              <div className="grow" />
              <form.Subscribe selector={(state) => [state.canSubmit]}>
                {([canSubmit]) => (
                  <Button variants={{ style: "primary" }} type="submit" isDisabled={!canSubmit || isLinkVisible}>
                    {isLinkVisible ? _(messages.success) : _(messages.submit)}
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
