import { langAtom, queriesAtom, queryKeys } from "@koloda/core-react";
import type { Queries } from "@koloda/core-react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { createStore, Provider as JotaiProvider } from "jotai";
import type { PropsWithChildren, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { createAlgorithm, createCard, createDeck, createQueryClient, createTemplate } from "../../test/test-helpers";
import { Algorithm } from "../algorithms/algorithm";
import { CardDetails } from "../cards/card-details";
import { DeckDetails } from "../decks/deck-details";
import { Template } from "../templates/template";

vi.mock("@tanstack/react-router", () => ({
  Link: () => null,
  useNavigate: () => () => {},
}));

// WHY: the form timestamps use the `Trans` macro, which the test config does not compile.
vi.mock("@lingui/react/macro", () => ({ Trans: ({ children }: PropsWithChildren) => <>{children}</> }));

i18n.loadAndActivate({ locale: "en", messages: {} });

const ALGORITHM = createAlgorithm();
const TEMPLATE = createTemplate();
const DECK = createDeck({ algorithmId: ALGORITHM.id, templateId: TEMPLATE.id });
const CARD = createCard({ deckId: DECK.id, templateId: TEMPLATE.id });

type UpdateMutation =
  | "updateDeckMutation"
  | "updateAlgorithmMutation"
  | "updateTemplateMutation"
  | "updateCardMutation";

type EditorCase = {
  name: string;
  mutation: UpdateMutation;
  editor: ReactNode;
};

const EDITORS: EditorCase[] = [
  { name: "DeckDetails", mutation: "updateDeckMutation", editor: <DeckDetails id={DECK.id} /> },
  { name: "Algorithm", mutation: "updateAlgorithmMutation", editor: <Algorithm id={ALGORITHM.id} /> },
  { name: "Template", mutation: "updateTemplateMutation", editor: <Template id={TEMPLATE.id} /> },
  { name: "CardDetails", mutation: "updateCardMutation", editor: <CardDetails card={CARD} /> },
];

function buildQueries(mutation: UpdateMutation, write: () => Promise<never>): Queries {
  const idle = () => ({ mutationFn: async () => undefined });
  return {
    getSettingsQuery: (name: "hotkeys") => ({ queryKey: queryKeys.settings.detail(name), queryFn: async () => null }),
    getDeckQuery: (id: string) => ({ queryKey: queryKeys.decks.detail(id), queryFn: async () => DECK }),
    getAlgorithmsQuery: () => ({ queryKey: queryKeys.algorithms.all(), queryFn: async () => [ALGORITHM] }),
    getAlgorithmQuery: (id: string) => ({ queryKey: queryKeys.algorithms.detail(id), queryFn: async () => ALGORITHM }),
    getAlgorithmDecksQuery: (id: string) => ({ queryKey: queryKeys.algorithms.decks(id), queryFn: async () => [] }),
    getTemplatesQuery: () => ({ queryKey: queryKeys.templates.all(), queryFn: async () => [TEMPLATE] }),
    getTemplateQuery: (id: string) => ({ queryKey: queryKeys.templates.detail(id), queryFn: async () => TEMPLATE }),
    getTemplateDecksQuery: (id: string) => ({ queryKey: queryKeys.templates.decks(id), queryFn: async () => [] }),
    getCardsQuery: (params: { deckId: string }) => ({
      queryKey: queryKeys.cards.deck(params),
      queryFn: async () => [],
    }),
    getReviewsQuery: (data: { cardId: string }) => ({
      queryKey: queryKeys.reviews.card(data),
      queryFn: async () => [],
    }),
    updateDeckMutation: idle,
    updateAlgorithmMutation: idle,
    updateTemplateMutation: idle,
    updateCardMutation: idle,
    deleteDeckMutation: idle,
    deleteAlgorithmMutation: idle,
    deleteTemplateMutation: idle,
    deleteCardMutation: idle,
    cloneAlgorithmMutation: idle,
    cloneTemplateMutation: idle,
    resetCardProgressMutation: idle,
    addAttachmentMutation: idle,
    [mutation]: () => ({ mutationFn: write }),
  } as unknown as Queries;
}

describe("edit forms", () => {
  it.each(EDITORS)("$name does not start a second save while the first is pending", async (row) => {
    const write = vi.fn(() => new Promise<never>(() => {}));
    const store = createStore();
    store.set(queriesAtom, buildQueries(row.mutation, write));
    store.set(langAtom, "en");
    // WHY: the routes load an editor's row before it mounts; a form created without it has no array fields yet.
    const queryClient = createQueryClient();
    queryClient.setQueryData(queryKeys.decks.detail(DECK.id), DECK);
    queryClient.setQueryData(queryKeys.algorithms.detail(ALGORITHM.id), ALGORITHM);
    queryClient.setQueryData(queryKeys.templates.detail(TEMPLATE.id), TEMPLATE);
    const { container } = render(
      <I18nProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <JotaiProvider store={store}>{row.editor}</JotaiProvider>
        </QueryClientProvider>
      </I18nProvider>,
    );
    await waitFor(() => expect(container.querySelector("form")).not.toBeNull());
    const form = container.querySelector("form")!;

    fireEvent.submit(form);
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    fireEvent.submit(form);
    await act(async () => {});

    expect(write).toHaveBeenCalledTimes(1);
  });
});
