import { toFormErrors } from "@koloda/app";
import { queriesAtom, queryKeys, useWriteMutation } from "@koloda/core-react";
import type { Deck, UpdateDeckValues } from "@koloda/srs";
import { updateDeckSchema as schema } from "@koloda/srs";
import { FormLayout, formLayout, Label, TextField, useAppForm, useRefreshPristineFields } from "@koloda/ui";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { AlgorithmPicker } from "../algorithms/algorithm-picker";
import { TemplatePicker } from "../templates/template-picker";
import { DeleteDeck } from "./delete-deck";

type DeckDetailsProps = { id: Deck["id"] };

// INVARIANT: one path per deck sync group (crates/koloda-sync-proto/PROTOCOL.md, Field groups and merge).
const DECK_SYNC_GROUPS = ["title", "notes", "algorithmId", "templateId"] as const;

export function DeckDetails({ id }: DeckDetailsProps) {
  const queryClient = useQueryClient();
  const { _ } = useLingui();
  const { getDeckQuery, updateDeckMutation } = useAtomValue(queriesAtom);
  const { data } = useQuery(getDeckQuery(id));
  const { mutateAsync } = useWriteMutation(updateDeckMutation(), ["decks"]);
  const form = useAppForm({
    defaultValues: data as UpdateDeckValues,
    validators: { onSubmit: schema },
    onSubmit: async ({ formApi, value }) => {
      // WHY: await the save so the form stays submitting until it settles; canSubmit stays
      // false meanwhile, so a second press cannot save twice.
      let returning;
      try {
        returning = await mutateAsync({ id, values: schema.parse(value) });
      } catch (error) {
        formApi.setErrorMap({ onSubmit: toFormErrors(error) });
        return;
      }
      queryClient.setQueryData(queryKeys.decks.detail(id), returning);
      // WHY: reset must receive the saved values — a bare reset() restores the original
      // defaults, so Discard would revert to those instead of the last save.
      formApi.reset(returning);
    },
  });
  useRefreshPristineFields(form, data, DECK_SYNC_GROUPS);

  if (!data) return null;

  return (
    <form
      className={formLayout}
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <FormLayout.Section>
        <form.Timestamps>
          <form.CreatedAt timestamp={data?.createdAt} />
          <form.UpdatedAt timestamp={data?.updatedAt} />
        </form.Timestamps>
      </FormLayout.Section>
      <form.AppField name="title">
        {(field) => (
          <field.TextField variants={{ layout: "form" }}>
            <Label variants={{ layout: "form" }}>{_(msg`deck.inputs.title.label`)}</Label>
            <TextField.Input variants={{ layout: "form" }} />
          </field.TextField>
        )}
      </form.AppField>
      <form.Field name="notes">
        {(field) => (
          <TextField variants={{ layout: "form" }} value={field.state.value ?? ""} onChange={field.handleChange}>
            <Label variants={{ layout: "form" }}>{_(msg`deck.inputs.notes.label`)}</Label>
            <TextField.TextArea variants={{ layout: "form" }} canAutoResize rows={2} />
          </TextField>
        )}
      </form.Field>
      <form.Field name="algorithmId">
        {(field) => (
          <AlgorithmPicker variants={{ layout: "form" }} value={field.state.value} onChange={field.handleChange} />
        )}
      </form.Field>
      <form.Field name="templateId">
        {(field) => (
          <TemplatePicker variants={{ layout: "form" }} value={field.state.value} onChange={field.handleChange} />
        )}
      </form.Field>
      <FormLayout.Section term={_(msg`deck.actions.label`)}>
        <DeleteDeck id={id} />
      </FormLayout.Section>
      <form.AppForm>
        <form.Controls />
      </form.AppForm>
    </form>
  );
}
