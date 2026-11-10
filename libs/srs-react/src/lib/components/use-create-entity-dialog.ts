import { toFormErrors } from "@koloda/app";
import type { AppError } from "@koloda/app";
import { useWriteMutation } from "@koloda/core-react";
import type { DataKind } from "@koloda/core-react";
import type { UseMutationOptions } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreatedEntity = { id: string };

type ResettableForm = { reset: () => void };

type SubmittedForm = ResettableForm & {
  setErrorMap: (errorMap: { onSubmit: ReturnType<typeof toFormErrors> }) => void;
};

/**
 * The shared behavior of the add and clone dialogs for decks, templates, and algorithms:
 * the awaited write, the error on failure, the reset when the dialog opens or closes, and the link to
 * what was created.
 *
 * A dialog file holds only its fields, trigger, route link, and messages; a change to how these dialogs
 * submit, reset, or report success belongs here, so the five cannot drift apart.
 * After a success every dialog shows the link, disables its submit button, and reads the success label
 * until the form changes.
 * The add-card dialog does not use this: it stays open for the next card and has no link.
 */
export function useCreateEntityDialog<TData extends CreatedEntity, TVariables>(
  options: UseMutationOptions<TData, AppError, TVariables, unknown>,
  kinds: readonly DataKind[],
) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const formRef = useRef<ResettableForm | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [newId, setNewId] = useState<TData["id"] | null>(null);
  const { mutateAsync, isSuccess } = useWriteMutation(options, kinds);

  useEffect(() => {
    if (newId) linkRef.current?.focus();
  }, [newId]);

  useEffect(() => {
    setNewId(null);
    formRef.current?.reset();
  }, [isOpen]);

  const listeners = useMemo(
    () => ({
      // WHY: the dialog's form is created after this hook, from options that use `submit`; the form hands
      // itself over here when it mounts, so the reset above needs no second call in each dialog.
      onMount: ({ formApi }: { formApi: ResettableForm }) => {
        formRef.current = formApi;
      },
      onChange: () => {
        setNewId(null);
      },
    }),
    [],
  );

  const submit = useCallback(
    async (variables: TVariables, formApi: SubmittedForm) => {
      // WHY: await the write so the form stays submitting until it settles; canSubmit stays
      // false meanwhile, so a second press cannot create twice.
      let returning: TData;
      try {
        returning = await mutateAsync(variables);
      } catch (error) {
        formApi.setErrorMap({ onSubmit: toFormErrors(error) });
        return;
      }
      formApi.reset();
      // WHY: reset() fires the form onChange listener, which clears newId; the
      // microtask sets it after that so the success link survives the reset.
      queueMicrotask(() => {
        setNewId(returning.id);
      });
    },
    [mutateAsync],
  );

  const isLinkVisible = !!(isSuccess && newId);

  return { isOpen, setIsOpen, listeners, submit, linkRef, newId, isLinkVisible };
}
