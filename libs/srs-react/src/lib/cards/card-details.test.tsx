import { AppError, SEED_TEMPLATE_TYPE_BACK_FIELD_ID as BACK } from "@koloda/app";
import { langAtom, queriesAtom, queryKeys } from "@koloda/core-react";
import type { Queries } from "@koloda/core-react";
import type { Card } from "@koloda/srs";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createStore, Provider as JotaiProvider, useAtomValue } from "jotai";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import { createCard, createQueryClient, createTemplate } from "../../test/test-helpers";
import { CardDetails } from "./card-details";

// WHY: the form timestamps use the `Trans` macro, which the test config does not compile.
vi.mock("@lingui/react/macro", () => ({ Trans: ({ children }: PropsWithChildren) => <>{children}</> }));

i18n.loadAndActivate({ locale: "en", messages: {} });

const TEMPLATE = createTemplate();
const CARD = createCard({ templateId: TEMPLATE.id });
const LATER = new Date("2030-01-02T00:00:00.000Z");

function withText(card: Card, fieldId: string, text: string): Card {
  return { ...card, updatedAt: LATER, content: { ...card.content, [fieldId]: { text } } };
}

// The editor as its screens mount it: the card comes from the deck's cards list.
function DeckCard() {
  const { getCardsQuery } = useAtomValue(queriesAtom);
  const { data } = useQuery(getCardsQuery({ deckId: CARD.deckId }));
  const card = data?.find((item) => item.id === CARD.id);
  return card ? <CardDetails card={card} /> : null;
}

async function renderDeckCard() {
  let stored = CARD;
  const updateCard = vi.fn(async ({ values }: { values: Pick<Card, "content"> }) => {
    stored = { ...stored, content: values.content, updatedAt: LATER };
    return stored;
  });
  const queries = {
    getCardsQuery: (params: { deckId: string }) => ({
      queryKey: queryKeys.cards.deck(params),
      queryFn: async () => [stored],
    }),
    getTemplateQuery: (id: string) => ({ queryKey: queryKeys.templates.detail(id), queryFn: async () => TEMPLATE }),
    getSettingsQuery: (name: "hotkeys") => ({ queryKey: queryKeys.settings.detail(name), queryFn: async () => null }),
    updateCardMutation: () => ({ mutationFn: updateCard }),
    resetCardProgressMutation: () => ({ mutationFn: async () => undefined }),
    deleteCardMutation: () => ({ mutationFn: async () => undefined }),
    addAttachmentMutation: () => ({ mutationFn: async () => null }),
  } as unknown as Queries;
  const store = createStore();
  store.set(queriesAtom, queries);
  store.set(langAtom, "en");
  const queryClient = createQueryClient();

  render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <JotaiProvider store={store}>
          <DeckCard />
        </JotaiProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
  await screen.findByRole("textbox", { name: "Front" });

  return {
    updateCard,
    // Another device's change to the card, arriving through sync.
    arrive: async (card: Card) => {
      stored = card;
      await act(() => queryClient.invalidateQueries({ queryKey: queryKeys.cards.deck({ deckId: CARD.deckId }) }));
    },
  };
}

function field(name: "Front" | "Back") {
  return screen.getByRole("textbox", { name }) as HTMLTextAreaElement;
}

function type(name: "Front" | "Back", text: string) {
  fireEvent.change(field(name), { target: { value: text } });
}

function save() {
  fireEvent.submit(field("Front").closest("form")!);
}

describe("CardDetails form", () => {
  it("keeps typed text when the card changes underneath (SYNC.md, an open edit form)", async () => {
    const { arrive } = await renderDeckCard();
    type("Front", "Typed here");

    await arrive(withText(CARD, BACK, "From the other device"));

    expect(field("Front").value).toBe("Typed here");
  });

  it("shows a synced change while nothing is typed", async () => {
    const { arrive } = await renderDeckCard();

    await arrive(withText(CARD, BACK, "From the other device"));

    await waitFor(() => expect(field("Back").value).toBe("From the other device"));
  });

  it("settles on the saved text after a save, with nothing left to save", async () => {
    const { updateCard } = await renderDeckCard();
    type("Front", "Saved text");
    expect(screen.getByRole("button", { name: "form.save" })).toBeTruthy();

    save();

    await waitFor(() => expect(screen.queryByRole("button", { name: "form.save" })).toBeNull());
    expect(updateCard).toHaveBeenCalledTimes(1);
    expect(field("Front").value).toBe("Saved text");
  });

  it("still checks a required field against the template after a save reset the form", async () => {
    const { updateCard } = await renderDeckCard();
    type("Front", "Saved text");
    save();
    await waitFor(() => expect(screen.queryByRole("button", { name: "form.save" })).toBeNull());

    type("Front", "");
    save();
    await act(async () => {});

    expect(updateCard).toHaveBeenCalledTimes(1);
  });
});

describe("CardDetails", () => {
  it("shows why a progress reset failed", async () => {
    const template = createTemplate();
    const card = createCard({ templateId: template.id, state: 2, dueAt: new Date("2030-01-01T00:00:00.000Z") });
    const queries = {
      getTemplateQuery: (id: string) => ({ queryKey: queryKeys.templates.detail(id), queryFn: async () => template }),
      getSettingsQuery: (name: "hotkeys") => ({ queryKey: queryKeys.settings.detail(name), queryFn: async () => null }),
      getReviewsQuery: (data: { cardId: string }) => ({
        queryKey: queryKeys.reviews.card(data),
        queryFn: async () => [],
      }),
      updateCardMutation: () => ({ mutationFn: async () => undefined }),
      resetCardProgressMutation: () => ({
        mutationFn: async () => {
          throw new AppError("not-found.cards.reset.card");
        },
      }),
      deleteCardMutation: () => ({ mutationFn: async () => undefined }),
      addAttachmentMutation: () => ({ mutationFn: async () => null }),
    } as unknown as Queries;
    const store = createStore();
    store.set(queriesAtom, queries);
    store.set(langAtom, "en");

    render(
      <I18nProvider i18n={i18n}>
        <QueryClientProvider client={createQueryClient()}>
          <JotaiProvider store={store}>
            <CardDetails card={card} />
          </JotaiProvider>
        </QueryClientProvider>
      </I18nProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "card.action.reset-progress" }));

    expect(await screen.findByText("not-found.cards.reset.card")).toBeTruthy();
  });
});
