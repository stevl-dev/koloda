import { defaultAlgorithmAtom, defaultTemplateAtom, queriesAtom } from "@koloda/core-react";
import { insertDeckSchema as schema } from "@koloda/srs";
import type { InsertDeckData } from "@koloda/srs";
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
import { AlgorithmPicker } from "../algorithms/algorithm-picker";
import { TemplatePicker } from "../templates/template-picker";
import { useCreateEntityDialog } from "../components/use-create-entity-dialog";

export function AddDeck() {
  const { _ } = useLingui();
  const { addDeckMutation } = useAtomValue(queriesAtom);
  const isMotionOn = useMotionSetting();
  const defaultAlgorithm = useAtomValue(defaultAlgorithmAtom);
  const defaultTemplate = useAtomValue(defaultTemplateAtom);
  const { isOpen, setIsOpen, listeners, submit, linkRef, newId, isLinkVisible } = useCreateEntityDialog(
    addDeckMutation(),
    ["decks"],
  );
  const form = useAppForm({
    defaultValues: { title: "", algorithmId: defaultAlgorithm, templateId: defaultTemplate } as InsertDeckData,
    validators: { onSubmit: schema },
    listeners,
    onSubmit: async ({ value, formApi }) => {
      await submit(schema.parse(value), formApi);
    },
  });
  const formErrorMap = useStore(form.store, (state) => state.errorMap);

  return (
    <Dialog.Root isOpen={isOpen} onOpenChange={setIsOpen}>
      <Tooltip content={_(msg`add-deck.trigger`)}>
        <Button variants={{ style: "dashed", size: "icon" }} aria-label={_(msg`add-deck.trigger`)}>
          <AddIcon className="size-4 min-w-4" strokeWidth={3} aria-hidden="true" />
        </Button>
      </Tooltip>
      <Dialog.Popover variants={{ class: "w-84" }}>
        <Dialog.Body>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            <Dialog.Header>
              <Dialog.Title>{_(msg`add-deck.title`)}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Content>
              <form.Field name="title">
                {(field) => (
                  <TextField
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={field.handleChange}
                    autoFocus
                  >
                    <Label>{_(msg`add-deck.inputs.title.label`)}</Label>
                    <TextField.Input />
                  </TextField>
                )}
              </form.Field>
              <form.Field name="algorithmId">
                {(field) => <AlgorithmPicker value={field.state.value} onChange={field.handleChange} />}
              </form.Field>
              <form.Field name="templateId">
                {(field) => <TemplatePicker value={field.state.value} onChange={field.handleChange} />}
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
                  to="/decks/$deckId"
                  params={{ deckId: newId }}
                  onClick={() => setIsOpen(false)}
                  viewTransition={isMotionOn}
                >
                  {_(msg`add-deck.redirect.link`)}
                </Link>
              )}
              <div className="grow" />
              <form.Subscribe selector={(state) => [state.canSubmit]}>
                {([canSubmit]) => (
                  <Button variants={{ style: "primary" }} type="submit" isDisabled={!canSubmit || isLinkVisible}>
                    {isLinkVisible ? _(msg`add-deck.success`) : _(msg`add-deck.submit`)}
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
