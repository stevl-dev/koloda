import { defaultAlgorithmAtom, defaultTemplateAtom, queriesAtom, queryKeys } from "@koloda/core-react";
import type { Queries } from "@koloda/core-react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createStore, Provider as JotaiProvider } from "jotai";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { createAlgorithm, createQueryClient, createTemplate, testId } from "../../test/test-helpers";
import { AddAlgorithm } from "../algorithms/add-algorithm";
import { CloneAlgorithm } from "../algorithms/clone-algorithm";
import { AddDeck } from "../decks/add-deck";
import { AddTemplate } from "../templates/add-template";
import { CloneTemplate } from "../templates/clone-template";

vi.mock("@tanstack/react-router", () => ({
  Link: () => null,
}));

i18n.loadAndActivate({ locale: "en", messages: {} });

type DialogCase = {
  name: string;
  messagePrefix: string;
  mutation:
    | "addAlgorithmMutation"
    | "addTemplateMutation"
    | "addDeckMutation"
    | "cloneAlgorithmMutation"
    | "cloneTemplateMutation";
  dialog: ReactNode;
};

const DIALOGS: DialogCase[] = [
  { name: "AddAlgorithm", messagePrefix: "add-algorithm", mutation: "addAlgorithmMutation", dialog: <AddAlgorithm /> },
  { name: "AddTemplate", messagePrefix: "add-template", mutation: "addTemplateMutation", dialog: <AddTemplate /> },
  { name: "AddDeck", messagePrefix: "add-deck", mutation: "addDeckMutation", dialog: <AddDeck /> },
  {
    name: "CloneAlgorithm",
    messagePrefix: "clone-algorithm",
    mutation: "cloneAlgorithmMutation",
    dialog: <CloneAlgorithm id={testId(1)} />,
  },
  {
    name: "CloneTemplate",
    messagePrefix: "clone-template",
    mutation: "cloneTemplateMutation",
    dialog: <CloneTemplate id={testId(1)} />,
  },
];

const ALGORITHM = createAlgorithm({ id: testId(1) });
const TEMPLATE = createTemplate({ id: testId(2) });

async function openDialog(row: DialogCase, write: (data: unknown) => Promise<{ id: string }>) {
  const queries = {
    getSettingsQuery: (name: "hotkeys") => ({ queryKey: queryKeys.settings.detail(name), queryFn: async () => null }),
    // The deck dialog's pickers; the other dialogs do not read these.
    getAlgorithmsQuery: () => ({ queryKey: queryKeys.algorithms.all(), queryFn: async () => [ALGORITHM] }),
    getTemplatesQuery: () => ({ queryKey: queryKeys.templates.all(), queryFn: async () => [TEMPLATE] }),
    [row.mutation]: () => ({ mutationFn: write }),
  } as unknown as Queries;
  const store = createStore();
  store.set(queriesAtom, queries);
  store.set(defaultAlgorithmAtom, ALGORITHM.id);
  store.set(defaultTemplateAtom, TEMPLATE.id);
  render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={createQueryClient()}>
        <JotaiProvider store={store}>{row.dialog}</JotaiProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: `${row.messagePrefix}.trigger` }));
  const title = await screen.findByRole("textbox", { name: new RegExp(`${row.messagePrefix}.inputs.title.label`) });

  return { title, form: title.closest("form")! };
}

describe("add and clone dialogs", () => {
  it.each(DIALOGS)("$name does not start a second write while the first is pending", async (row) => {
    const write = vi.fn((_data: unknown) => new Promise<never>(() => {}));
    const { title, form } = await openDialog(row, write);
    fireEvent.change(title, { target: { value: "Copy" } });

    fireEvent.submit(form);
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    fireEvent.submit(form);
    await act(async () => {});

    expect(write).toHaveBeenCalledTimes(1);
  });

  it.each(DIALOGS)("$name opens on its title field", async (row) => {
    const { title } = await openDialog(row, async () => ({ id: testId(9) }));

    await waitFor(() => expect(document.activeElement).toBe(title));
  });

  it.each(DIALOGS)("$name reports a success and takes no second add until the form changes", async (row) => {
    const write = vi.fn(async (_data: unknown) => ({ id: testId(9) }));
    const { title, form } = await openDialog(row, write);
    fireEvent.change(title, { target: { value: "Copy" } });

    fireEvent.submit(form);

    const done = await screen.findByRole("button", { name: `${row.messagePrefix}.success` });
    expect((done as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(title, { target: { value: "Another" } });

    const submit = await screen.findByRole("button", { name: `${row.messagePrefix}.submit` });
    expect((submit as HTMLButtonElement).disabled).toBe(false);
  });
});
