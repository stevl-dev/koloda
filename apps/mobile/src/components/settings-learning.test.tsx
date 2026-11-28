import type { ResolvedLearningSettings } from "@koloda/app";
import { langAtom } from "@koloda/core-react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { createStore, Provider } from "jotai";
import type { KolodaFacade } from "../host/facade";
import { createMobileQueries } from "../host/queries";
import { MobileQueriesContext } from "../host/queries-context";
import { activateLanguage } from "../i18n";
import { fakeFacade } from "../test/fake-facade";
import { SettingsLearning } from "./settings-learning";

const SAVED: ResolvedLearningSettings = {
  defaults: { algorithm: "01900000-0000-7000-8000-000000000301", template: "01900000-0000-7000-8000-000000000201" },
  dailyLimits: {
    total: 100,
    untouched: { value: 20, counts: true },
    learn: { value: null, counts: false },
    review: { value: 80, counts: true },
  },
  dayStartsAt: "04:00",
  learnAheadLimit: [0, 30],
};

const OTHER_ALGORITHM = "01900000-0000-7000-8000-000000000302";
const OTHER_TEMPLATE = "01900000-0000-7000-8000-000000000202";

function echo(data: string) {
  return Promise.resolve(JSON.stringify({ name: "learning", content: JSON.parse(data).content }));
}

async function renderForm(setSettings: KolodaFacade["setSettings"]) {
  activateLanguage("en");
  const store = createStore();
  store.set(langAtom, "en");
  const getAlgorithms = () =>
    Promise.resolve(
      JSON.stringify([
        { id: SAVED.defaults.algorithm, title: "FSRS" },
        { id: OTHER_ALGORITHM, title: "Cramming" },
      ]),
    );
  const getTemplates = () =>
    Promise.resolve(
      JSON.stringify([
        { id: SAVED.defaults.template, title: "Vocabulary" },
        { id: OTHER_TEMPLATE, title: "Cloze" },
      ]),
    );
  const queries = createMobileQueries(fakeFacade({ setSettings, getAlgorithms, getTemplates }), "/cache");
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });

  await render(
    <Provider store={store}>
      <I18nProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <MobileQueriesContext.Provider value={queries}>
            <SettingsLearning data={SAVED} />
          </MobileQueriesContext.Provider>
        </QueryClientProvider>
      </I18nProvider>
    </Provider>,
  );
}

describe("SettingsLearning", () => {
  it("saves a changed limit with the defaults as they were", async () => {
    const setSettings = jest.fn(echo);
    await renderForm(setSettings);

    await fireEvent.changeText(screen.getByLabelText("New"), "30");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    const { content } = JSON.parse(setSettings.mock.calls[0]![0]);
    expect(content.dailyLimits.untouched).toEqual({ value: 30, counts: true });
    expect(content.defaults).toEqual(SAVED.defaults);
  });

  it("saves the default preset and template the user chose", async () => {
    const setSettings = jest.fn(echo);
    await renderForm(setSettings);

    await fireEvent.press(await screen.findByRole("radio", { name: "Cramming" }));
    await fireEvent.press(screen.getByRole("radio", { name: "Cloze" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(setSettings).toHaveBeenCalled());
    const { content } = JSON.parse(setSettings.mock.calls[0]![0]);
    expect(content.defaults).toEqual({ algorithm: OTHER_ALGORITHM, template: OTHER_TEMPLATE });
    expect(content.dailyLimits).toEqual(SAVED.dailyLimits);
  });

  it("rejects a counted limit above Total and writes nothing", async () => {
    const setSettings = jest.fn(echo);
    await renderForm(setSettings);

    await fireEvent.changeText(screen.getByLabelText("New"), "101");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("New can't be more than total")).toBeTruthy();
    expect(setSettings).not.toHaveBeenCalled();
  });

  it("fills in the first-setup number when Unlimited turns off on a cap that had none", async () => {
    await renderForm(jest.fn(echo));

    await fireEvent(screen.getByLabelText("Learn unlimited"), "valueChange", false);

    expect(screen.getByLabelText("Learn")).toHaveDisplayValue("200");
  });

  it("discards an edit back to the saved values without writing", async () => {
    const setSettings = jest.fn(echo);
    await renderForm(setSettings);

    await fireEvent.changeText(screen.getByLabelText("Minutes"), "45");
    await fireEvent.press(screen.getByRole("button", { name: "Discard" }));

    expect(screen.getByLabelText("Minutes")).toHaveDisplayValue("30");
    expect(setSettings).not.toHaveBeenCalled();
  });
});
