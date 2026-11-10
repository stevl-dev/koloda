import { queriesAtom } from "@koloda/core-react";
import { DEFAULT_FSRS_ALGORITHM, insertAlgorithmSchema as schema } from "@koloda/srs";
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

export function AddAlgorithm() {
  const { _ } = useLingui();
  const { addAlgorithmMutation } = useAtomValue(queriesAtom);
  const isMotionOn = useMotionSetting();
  const { isOpen, setIsOpen, listeners, submit, linkRef, newId, isLinkVisible } = useCreateEntityDialog(
    addAlgorithmMutation(),
    ["algorithms"],
  );
  const form = useAppForm({
    defaultValues: { title: "", content: DEFAULT_FSRS_ALGORITHM },
    validators: { onSubmit: schema },
    listeners,
    onSubmit: async ({ value, formApi }) => {
      await submit(schema.parse(value), formApi);
    },
  });

  const formErrorMap = useStore(form.store, (state) => state.errorMap);

  return (
    <Dialog.Root isOpen={isOpen} onOpenChange={setIsOpen}>
      <Tooltip content={_(msg`add-algorithm.trigger`)}>
        <Button variants={{ style: "dashed", size: "icon" }} aria-label={_(msg`add-algorithm.trigger`)}>
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
              <Dialog.Title>{_(msg`add-algorithm.title`)}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Content variants={{ class: "min-h-34" }}>
              <form.Field name="title">
                {(field) => (
                  <TextField
                    aria-label={_(msg`add-algorithm.inputs.title.label`)}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e)}
                    autoFocus
                  >
                    <Label>{_(msg`add-algorithm.inputs.title.label`)}</Label>
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
                  to="/algorithms/$algorithmId"
                  params={{ algorithmId: newId }}
                  onClick={() => setIsOpen(false)}
                  viewTransition={isMotionOn}
                >
                  {_(msg`add-algorithm.redirect.link`)}
                </Link>
              )}
              <div className="grow" />
              <form.Subscribe selector={(state) => [state.canSubmit]}>
                {([canSubmit]) => (
                  <Button variants={{ style: "primary" }} type="submit" isDisabled={!canSubmit || isLinkVisible}>
                    {isLinkVisible ? _(msg`add-algorithm.success`) : _(msg`add-algorithm.submit`)}
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
