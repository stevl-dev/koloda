import { TextField, useAppForm } from "@koloda/ui";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

i18n.loadAndActivate({ locale: "en", messages: {} });

type TitleFormProps = { onSubmit: () => void };

function TitleForm({ onSubmit }: TitleFormProps) {
  const form = useAppForm({ defaultValues: { title: "Deck" }, onSubmit });

  return (
    <I18nProvider i18n={i18n}>
      <form.AppField name="title">
        {(field) => (
          <field.TextField aria-label="Title">
            <TextField.Input />
          </field.TextField>
        )}
      </form.AppField>
      <form.AppForm>
        <form.Controls />
      </form.AppForm>
    </I18nProvider>
  );
}

type FlaggedTitleFormProps = { onSubmit: () => void };

// WHY: a pristine form looks the same before and after a reset, except for state a reset clears. The mount-time
// error is that state, so a Discard that acts on a pristine form is visible.
function FlaggedTitleForm({ onSubmit }: FlaggedTitleFormProps) {
  const form = useAppForm({
    defaultValues: { title: "Deck" },
    validators: { onMount: () => "stale", onChange: ({ value }) => (value.title ? undefined : "required") },
    onSubmit,
  });

  return (
    <I18nProvider i18n={i18n}>
      <form.AppField name="title">
        {(field) => (
          <field.TextField aria-label="Title">
            <TextField.Input />
          </field.TextField>
        )}
      </form.AppField>
      <form.Subscribe selector={(state) => state.errors.length}>
        {(errorCount) => <output aria-label="Form errors">{errorCount}</output>}
      </form.Subscribe>
      <form.AppForm>
        <form.Controls />
      </form.AppForm>
    </I18nProvider>
  );
}

async function pressDiscard() {
  await act(async () => {
    fireEvent.keyDown(document.body, { key: "d", code: "KeyD", ctrlKey: true });
  });
}

async function pressSave() {
  await act(async () => {
    fireEvent.keyDown(document.body, { key: "s", code: "KeyS", ctrlKey: true });
  });
}

describe("Controls", () => {
  it("saves by hotkey only after the form changes", async () => {
    const onSubmit = vi.fn();
    render(<TitleForm onSubmit={onSubmit} />);

    await pressSave();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Renamed" } });
    await pressSave();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("discards by hotkey only after the form changes", async () => {
    render(<FlaggedTitleForm onSubmit={vi.fn()} />);
    const title = screen.getByRole("textbox", { name: "Title" }) as HTMLInputElement;
    expect(screen.getByRole("status", { name: "Form errors" }).textContent).toBe("1");

    await pressDiscard();
    expect(screen.getByRole("status", { name: "Form errors" }).textContent).toBe("1");

    // WHY: an invalid edit cannot be submitted, so a guard on `canSubmit` instead of `isDirty` would keep it.
    fireEvent.change(title, { target: { value: "" } });
    await pressDiscard();
    expect(title.value).toBe("Deck");
  });
});
