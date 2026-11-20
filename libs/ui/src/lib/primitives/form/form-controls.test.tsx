import type * as CoreReact from "@koloda/core-react";
import { TextField, useAppForm } from "@koloda/ui";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// WHY: the shared stub in test-setup.ts ignores scopes and options; Controls needs the real form scope and
// `ignoreInputs: false`, so this file runs on the real hotkey manager.
vi.mock("@koloda/core-react", async (importOriginal) => {
  const actual = await importOriginal<typeof CoreReact>();
  return {
    ...actual,
    useHotkeysSettings: () => ({ form: { submit: ["Mod+S"], reset: ["Mod+D"] } }),
  };
});

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

async function pressWithCtrl(key: string, code: string) {
  const target = document.activeElement ?? document.body;
  await act(async () => {
    fireEvent.keyDown(target, { key, code, ctrlKey: true });
    fireEvent.keyUp(target, { key, code, ctrlKey: true });
  });
}

async function pressDiscard() {
  await pressWithCtrl("d", "KeyD");
}

async function pressSave() {
  await pressWithCtrl("s", "KeyS");
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

  it("saves by hotkey while the cursor is in a field", async () => {
    const onSubmit = vi.fn();
    render(<TitleForm onSubmit={onSubmit} />);
    const title = screen.getByRole("textbox", { name: "Title" });

    title.focus();
    fireEvent.change(title, { target: { value: "Renamed" } });
    await pressSave();

    expect(document.activeElement).toBe(title);
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
