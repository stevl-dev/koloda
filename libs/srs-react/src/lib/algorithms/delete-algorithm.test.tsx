import { defaultAlgorithmAtom, queriesAtom, queryKeys } from "@koloda/core-react";
import type { Queries } from "@koloda/core-react";
import type { Algorithm, Deck } from "@koloda/srs";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createStore, Provider as JotaiProvider } from "jotai";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import { createQueryClient, testId } from "../../test/test-helpers";
import { DeleteAlgorithm } from "./delete-algorithm";

vi.mock("@lingui/react", () => ({
  useLingui: () => ({
    _: (message: { toString(): string }) => message.toString(),
  }),
}));

const navigate = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

const ALGORITHM_ID = testId(1);
const SUCCESSOR_ID = testId(2);

function buildQueries(): Queries {
  const queries: Partial<Queries> = {
    getSettingsQuery: (name) => ({
      queryKey: queryKeys.settings.detail(name),
      queryFn: async () => null,
    }),
    getAlgorithmsQuery: () => ({
      queryKey: queryKeys.algorithms.all(),
      queryFn: async () =>
        [
          { id: ALGORITHM_ID, title: "Old" },
          { id: SUCCESSOR_ID, title: "Successor" },
        ] as Algorithm[],
    }),
    getAlgorithmDecksQuery: () => ({
      queryKey: queryKeys.algorithms.decks(ALGORITHM_ID),
      queryFn: async () => [{ id: testId(9), title: "Spanish" }] as Array<Pick<Deck, "id" | "title">>,
    }),
    deleteAlgorithmMutation: () => ({
      mutationFn: async () => undefined,
    }),
  };
  return queries as Queries;
}

describe("DeleteAlgorithm", () => {
  it("invalidates deck queries after a successor delete", async () => {
    const store = createStore();
    store.set(queriesAtom, buildQueries());
    store.set(defaultAlgorithmAtom, testId(3));
    const queryClient = createQueryClient();
    // The decks list, which shows each deck's preset and so the successor after the delete.
    queryClient.setQueryData(queryKeys.decks.all(), []);

    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={queryClient}>
          <JotaiProvider store={store}>{children}</JotaiProvider>
        </QueryClientProvider>
      );
    }

    render(<DeleteAlgorithm id={ALGORITHM_ID} />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole("button", { name: "delete-algorithm.trigger" }));
    expect(await screen.findByText("delete-algorithm.successor-message")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "delete-algorithm.confirm" }));

    await waitFor(() => {
      expect(queryClient.getQueryState(queryKeys.decks.all())?.isInvalidated).toBe(true);
    });
    expect(navigate).toHaveBeenCalledWith({ to: "/algorithms" });
  });
});
