import { describe, expect, it, vi } from "vitest";
import { createAssistantToolExecutor } from "./assistant-tool-executor";
import type {
  AssistantToolAppInfo,
  AssistantToolLessons,
  AssistantToolSyncStatus,
  AssistantToolTodaysReviewTotals,
} from "./assistant-tools";
import type { AIProfile } from "./settings";

const DECK_ID = "01900000-0000-7000-8000-000000000001";
const TEMPLATE_ID = "01900000-0000-7000-8000-000000000005";
const MISSING_DECK_ID = "01900000-0000-7000-8000-0000000003e7";
const MISSING_TEMPLATE_ID = "01900000-0000-7000-8000-000000000194";
const FRONT_ID = "01900000-0000-7000-8000-000000000001";
const BACK_ID = "01900000-0000-7000-8000-000000000002";

const template = {
  id: TEMPLATE_ID,
  title: "Basic",
  content: {
    fields: [
      { id: FRONT_ID, title: "Front", type: "text" as const, isRequired: true },
      { id: BACK_ID, title: "Back", type: "text" as const, isRequired: true },
    ],
    layout: [{ field: FRONT_ID, operation: "display" as const }],
  },
  createdAt: new Date(0),
  updatedAt: new Date(0),
  isLocked: false,
};

const ALGORITHM_ID = "01900000-0000-7000-8000-000000000031";

const algorithm = {
  id: ALGORITHM_ID,
  title: "Default",
  content: {
    type: "fsrs" as const,
    retention: 90,
    weights: "0.212, 1.2931",
    isFuzzEnabled: true,
    learningSteps: [[1, "m"] as [number, string], [10, "m"] as [number, string]],
    relearningSteps: [[10, "m"] as [number, string]],
    maximumInterval: 36500,
  },
};

const DECK_LESSON_COUNTS = { untouched: 5, learn: 0, review: 2, total: 7 };

const settingsRows = {
  learning: { defaults: { algorithm: ALGORITHM_ID }, dailyLimits: { new: 20 }, dayStartsAt: "04:00" },
  interface: { language: "ru", scheme: "dark" },
  hotkeys: { grades: { again: ["1"] } },
  ai: null,
};

function makeDataSource(overrides: Partial<Parameters<typeof createAssistantToolExecutor>[0]> = {}) {
  const data = {
    getDecks: async () => [{ id: DECK_ID, title: "Spanish", templateId: TEMPLATE_ID }],
    getTemplates: async () => [template],
    getAlgorithms: async () => [algorithm],
    getCards: async () => [
      {
        id: "01900000-0000-7000-8000-000000000009",
        deckId: DECK_ID,
        templateId: TEMPLATE_ID,
        content: { [FRONT_ID]: { text: "hola" } },
      },
    ],
    getCardCounts: async () => ({ [DECK_ID]: 3 }),
    createDeck: async () => {
      throw new Error("createDeck should not be called");
    },
    getSettings: async (name: "learning" | "interface" | "hotkeys" | "ai"): Promise<unknown> => settingsRows[name],
    getAIProfiles: async (): Promise<AIProfile[]> => [],
    getLessons: async ({ deckIds }: { deckIds?: string[] }): Promise<AssistantToolLessons> => {
      const decks = [{ id: DECK_ID, title: "Spanish", ...DECK_LESSON_COUNTS }].filter(
        (deck) => deckIds === undefined || deckIds.includes(deck.id),
      );
      return { total: decks[0] ? DECK_LESSON_COUNTS : { untouched: 0, learn: 0, review: 0, total: 0 }, decks };
    },
    getTodaysReviewTotals: async (): Promise<AssistantToolTodaysReviewTotals> => ({
      dailyLimits: {
        total: 200,
        untouched: { value: 20, counts: true },
        learn: { value: null, counts: false },
        review: { value: 200, counts: true },
      },
      reviewTotals: { untouched: 18, learn: 0, review: 0, total: 18 },
    }),
    getAppInfo: async (): Promise<AssistantToolAppInfo> => ({ app: "web" }),
  };
  return { ...data, ...overrides };
}

describe("createAssistantToolExecutor", () => {
  it("list_decks shapes deck rows with counts from the data source", async () => {
    const executor = createAssistantToolExecutor(makeDataSource());
    const output = (await executor("list_decks", {})) as { decks: Array<{ deckId: string; cardCount: number }> };
    expect(output.decks[0]).toMatchObject({ deckId: DECK_ID, cardCount: 3 });
  });

  it("list_decks reports zero for a deck without cards", async () => {
    const executor = createAssistantToolExecutor(makeDataSource({ getCardCounts: async () => ({}) }));
    const output = (await executor("list_decks", {})) as { decks: Array<{ deckId: string; cardCount: number }> };
    expect(output.decks[0]?.cardCount).toBe(0);
  });

  it("get_deck shapes one deck row without reading cards", async () => {
    const getCards = vi.fn(async () => []);
    const executor = createAssistantToolExecutor(makeDataSource({ getCards }));
    const output = await executor("get_deck", { deckId: DECK_ID });
    expect(output).toEqual({
      deckId: DECK_ID,
      title: "Spanish",
      cardCount: 3,
      templateTitle: "Basic",
      fieldTitles: ["Front", "Back"],
    });
    expect(getCards).not.toHaveBeenCalled();
  });

  it("get_deck throws for a missing deck without reading cards", async () => {
    const getCards = vi.fn(async () => []);
    const executor = createAssistantToolExecutor(makeDataSource({ getCards }));
    await expect(executor("get_deck", { deckId: MISSING_DECK_ID })).rejects.toThrow(
      `Deck not found: ${MISSING_DECK_ID}`,
    );
    expect(getCards).not.toHaveBeenCalled();
  });

  it("get_template shapes full field metadata without reading decks or cards", async () => {
    const getDecks = vi.fn(makeDataSource().getDecks);
    const getCards = vi.fn(async () => []);
    const executor = createAssistantToolExecutor(makeDataSource({ getDecks, getCards }));
    const output = await executor("get_template", { templateId: TEMPLATE_ID });
    expect(output).toEqual({
      templateId: TEMPLATE_ID,
      title: "Basic",
      fields: [
        { id: FRONT_ID, title: "Front", type: "text", isRequired: true },
        { id: BACK_ID, title: "Back", type: "text", isRequired: true },
      ],
    });
    expect(getDecks).not.toHaveBeenCalled();
    expect(getCards).not.toHaveBeenCalled();
  });

  it("get_template throws for a missing template without reading decks or cards", async () => {
    const getDecks = vi.fn(makeDataSource().getDecks);
    const getCards = vi.fn(async () => []);
    const executor = createAssistantToolExecutor(makeDataSource({ getDecks, getCards }));
    await expect(executor("get_template", { templateId: MISSING_TEMPLATE_ID })).rejects.toThrow(
      `Template not found: ${MISSING_TEMPLATE_ID}`,
    );
    expect(getDecks).not.toHaveBeenCalled();
    expect(getCards).not.toHaveBeenCalled();
  });

  it("get_deck_cards reads the asked deck's cards and lists them by field title", async () => {
    const getCards = vi.fn(makeDataSource().getCards);
    const executor = createAssistantToolExecutor(makeDataSource({ getCards }));

    const output = await executor("get_deck_cards", { deckId: DECK_ID });

    expect(getCards).toHaveBeenCalledExactlyOnceWith({ deckId: DECK_ID });
    expect(output).toMatchObject({ totalCards: 1, cards: [{ fields: { Front: "hola", Back: "" } }] });
  });

  it("get_deck_cards throws for a missing deck", async () => {
    const getCards = vi.fn(async () => []);
    const executor = createAssistantToolExecutor(makeDataSource({ getCards }));
    await expect(executor("get_deck_cards", { deckId: MISSING_DECK_ID })).rejects.toThrow(
      `Deck not found: ${MISSING_DECK_ID}`,
    );
    expect(getCards).not.toHaveBeenCalled();
  });

  it("get_deck_cards throws when the deck's template is missing", async () => {
    const getCards = vi.fn(async () => []);
    const executor = createAssistantToolExecutor(
      makeDataSource({
        getDecks: async () => [{ id: DECK_ID, title: "Spanish", templateId: MISSING_TEMPLATE_ID }],
        getCards,
      }),
    );
    await expect(executor("get_deck_cards", { deckId: DECK_ID })).rejects.toThrow(
      `Template not found for deck: ${DECK_ID}`,
    );
    expect(getCards).not.toHaveBeenCalled();
  });

  it("add_deck returns the stored deck with field titles and does not read cards", async () => {
    const createdId = "01900000-0000-7000-8000-000000000099";
    const getCards = vi.fn(async () => []);
    const createDeck = vi.fn(async (input: { title: string; templateId: string; algorithmId: string }) => ({
      id: createdId,
      ...input,
    }));
    const getSettings = vi.fn(async () => settingsRows.learning);
    const executor = createAssistantToolExecutor(
      makeDataSource({
        createDeck,
        getSettings,
        getCards,
      }),
    );

    const output = await executor("add_deck", {
      title: "  Spanish verbs  ",
      templateId: TEMPLATE_ID,
      algorithmId: ALGORITHM_ID,
    });

    expect(output).toEqual({
      deckId: createdId,
      title: "Spanish verbs",
      templateId: TEMPLATE_ID,
      templateTitle: "Basic",
      fieldTitles: ["Front", "Back"],
      algorithmId: ALGORITHM_ID,
    });
    expect(createDeck).toHaveBeenCalledTimes(1);
    expect(createDeck).toHaveBeenCalledWith({
      title: "Spanish verbs",
      templateId: TEMPLATE_ID,
      algorithmId: ALGORITHM_ID,
    });
    expect(getSettings).not.toHaveBeenCalled();
    expect(getCards).not.toHaveBeenCalled();
  });

  it("add_deck does not write when the run is canceled during its reads", async () => {
    const controller = new AbortController();
    const createDeck = vi.fn();
    let markReading!: () => void;
    const isReading = new Promise<void>((resolve) => {
      markReading = resolve;
    });
    let releaseAlgorithms!: () => void;
    const getAlgorithms = vi.fn(
      () =>
        new Promise<(typeof algorithm)[]>((resolve) => {
          releaseAlgorithms = () => resolve([algorithm]);
          markReading();
        }),
    );
    const executor = createAssistantToolExecutor(makeDataSource({ createDeck, getAlgorithms }));

    const adding = executor("add_deck", { title: "Spanish", templateId: TEMPLATE_ID }, controller.signal);
    await isReading;
    // The user cancels while the algorithm read is still in flight.
    controller.abort();
    releaseAlgorithms();

    await expect(adding).rejects.toMatchObject({ name: "AbortError" });
    expect(createDeck).not.toHaveBeenCalled();
  });

  it("add_deck does not create a deck when the template is missing", async () => {
    const createDeck = vi.fn();
    const getSettings = vi.fn(async () => settingsRows.learning);
    const executor = createAssistantToolExecutor(makeDataSource({ createDeck, getSettings }));

    await expect(executor("add_deck", { title: "Spanish", templateId: MISSING_TEMPLATE_ID })).rejects.toThrow(
      `Template not found: ${MISSING_TEMPLATE_ID}`,
    );
    expect(createDeck).not.toHaveBeenCalled();
    expect(getSettings).not.toHaveBeenCalled();
  });

  it("add_deck does not create a deck when the requested algorithm is missing", async () => {
    const missingAlgorithmId = "01900000-0000-7000-8000-000000000032";
    const createDeck = vi.fn();
    const getSettings = vi.fn(async () => settingsRows.learning);
    const executor = createAssistantToolExecutor(makeDataSource({ createDeck, getSettings }));

    await expect(
      executor("add_deck", { title: "Spanish", templateId: TEMPLATE_ID, algorithmId: missingAlgorithmId }),
    ).rejects.toThrow(`Algorithm not found: ${missingAlgorithmId}`);
    expect(createDeck).not.toHaveBeenCalled();
    expect(getSettings).not.toHaveBeenCalled();
  });

  it("add_deck stores the default algorithm id when algorithmId is omitted", async () => {
    const createdId = "01900000-0000-7000-8000-000000000099";
    const createDeck = vi.fn(async (input: { title: string; templateId: string; algorithmId: string }) => ({
      id: createdId,
      ...input,
    }));
    const executor = createAssistantToolExecutor(makeDataSource({ createDeck }));

    const output = (await executor("add_deck", { title: "Spanish", templateId: TEMPLATE_ID })) as {
      algorithmId: string;
      deckId: string;
    };

    expect(createDeck).toHaveBeenCalledWith({
      title: "Spanish",
      templateId: TEMPLATE_ID,
      algorithmId: ALGORITHM_ID,
    });
    expect(output.deckId).toBe(createdId);
    expect(output.algorithmId).toBe(ALGORITHM_ID);
  });

  it("add_deck does not create a deck when the default algorithm is missing", async () => {
    const missingAlgorithmId = "01900000-0000-7000-8000-000000000032";
    const createDeck = vi.fn();
    const executor = createAssistantToolExecutor(
      makeDataSource({ createDeck, getSettings: async () => ({ defaults: { algorithm: missingAlgorithmId } }) }),
    );

    await expect(executor("add_deck", { title: "Spanish", templateId: TEMPLATE_ID })).rejects.toThrow(
      `Algorithm not found: ${missingAlgorithmId}`,
    );
    expect(createDeck).not.toHaveBeenCalled();
  });

  it("add_deck does not create a deck when no learning settings are stored", async () => {
    const createDeck = vi.fn();
    const getSettings = vi.fn(async () => null);
    const executor = createAssistantToolExecutor(makeDataSource({ createDeck, getSettings }));

    await expect(executor("add_deck", { title: "Spanish", templateId: TEMPLATE_ID })).rejects.toThrow(
      "Algorithm not found: default",
    );
    expect(getSettings.mock.calls).toEqual([["learning"]]);
    expect(createDeck).not.toHaveBeenCalled();
  });

  it("propose_cards drops mixed invalid cards instead of throwing", async () => {
    const executor = createAssistantToolExecutor(makeDataSource());
    const output = (await executor("propose_cards", {
      deckId: DECK_ID,
      cards: [
        { fields: { Front: "hola", Back: "hello" } },
        { fields: { Front: "gato", Back: 1 } },
        { fields: { Front: "x", Back: [] } },
        "not-an-object",
      ],
    })) as { cards: Array<{ fields: Record<string, string> }>; rejectedCount: number; message?: string };

    expect(output.cards).toEqual([
      { fields: { Front: "hola", Back: "hello" } },
      { fields: { Front: "gato", Back: "1" } },
    ]);
    expect(output.rejectedCount).toBe(2);
    expect(output.message).toMatch(/2 cards were not accepted/);
    expect(output.message).toContain("Required fields left empty: Back.");
  });

  it("get_lessons_today reads every deck and the learning day's start without a deck id", async () => {
    const getLessons = vi.fn(makeDataSource().getLessons);
    const executor = createAssistantToolExecutor(makeDataSource({ getLessons }));

    const output = await executor("get_lessons_today", {});

    expect(getLessons.mock.calls).toEqual([[{}]]);
    expect(output).toMatchObject({
      dayStartsAt: "04:00",
      types: { new: { available: 5, studiedToday: 18, roomLeft: 2, lessonDefault: 2 } },
      decks: [{ deckId: DECK_ID, title: "Spanish" }],
    });
  });

  it("get_lessons_today filters to the asked deck", async () => {
    const getLessons = vi.fn(makeDataSource().getLessons);
    const executor = createAssistantToolExecutor(makeDataSource({ getLessons }));

    const output = await executor("get_lessons_today", { deckId: DECK_ID });

    expect(getLessons.mock.calls).toEqual([[{ deckIds: [DECK_ID] }]]);
    expect(output).toMatchObject({ deck: { deckId: DECK_ID, title: "Spanish" } });
  });

  it("get_lessons_today throws for a missing deck", async () => {
    const executor = createAssistantToolExecutor(makeDataSource());

    await expect(executor("get_lessons_today", { deckId: MISSING_DECK_ID })).rejects.toThrow(
      `Deck not found: ${MISSING_DECK_ID}`,
    );
  });

  it("get_settings returns every section as the host read it when no section is asked for", async () => {
    const executor = createAssistantToolExecutor(makeDataSource());

    const output = await executor("get_settings", {});

    expect(output).toEqual({
      learning: settingsRows.learning,
      interface: settingsRows.interface,
      hotkeys: settingsRows.hotkeys,
      ai: { profiles: [], assistant: { temperature: 0.2, prompt: "built-in" } },
    });
  });

  it.each(["learning", "interface", "hotkeys"] as const)(
    "get_settings reads only the %s row when asked",
    async (name) => {
      const getSettings = vi.fn(async (asked: string) => settingsRows[asked as keyof typeof settingsRows]);
      const getAIProfiles = vi.fn(async () => []);
      const executor = createAssistantToolExecutor(makeDataSource({ getSettings, getAIProfiles }));

      const output = await executor("get_settings", { section: name });

      expect(output).toEqual({ [name]: settingsRows[name] });
      expect(getSettings.mock.calls).toEqual([[name]]);
      expect(getAIProfiles).not.toHaveBeenCalled();
    },
  );

  it("get_settings says the app uses its built-in defaults when a row is not saved", async () => {
    const executor = createAssistantToolExecutor(makeDataSource({ getSettings: async () => null }));

    const output = await executor("get_settings", { section: "hotkeys" });

    expect(output).toEqual({
      hotkeys: {
        isSaved: false,
        message:
          "No hotkeys settings are saved; the app uses its built-in defaults, which the hotkeys help topic gives.",
      },
    });
  });

  it("get_settings fails the call when the host rejects an invalid row", async () => {
    const executor = createAssistantToolExecutor(
      makeDataSource({ getSettings: () => Promise.reject(new Error("Invalid learning settings")) }),
    );

    await expect(executor("get_settings", { section: "learning" })).rejects.toThrow("Invalid learning settings");
  });

  it("get_settings fails the call when the AI row holds an invalid assistant temperature", async () => {
    const executor = createAssistantToolExecutor(
      makeDataSource({ getSettings: async () => ({ profiles: [], assistant: { temperature: 5 } }) }),
    );

    await expect(executor("get_settings", { section: "ai" })).rejects.toThrow();
  });

  it("get_settings shapes AI profiles and assistant settings without secrets or the custom prompt", async () => {
    const profiles: AIProfile[] = [
      {
        id: "01900000-0000-7000-8000-000000000071",
        title: "Home server",
        secrets: { provider: "ollama", baseUrl: "http://10.0.0.5:11434/", apiKey: "sk-secret-ollama" },
        hasSecrets: true,
        whitelistModelIds: ["llama3"],
        createdAt: new Date(0),
      },
      {
        id: "01900000-0000-7000-8000-000000000072",
        title: undefined,
        secrets: { provider: "openrouter", apiKey: null },
        hasSecrets: false,
        createdAt: new Date(0),
      },
    ];
    const aiRow = {
      profiles: profiles.map((profile) => ({ ...profile, createdAt: "1970-01-01T00:00:00.000Z" })),
      assistant: { temperature: 0.7, chatPromptMode: "custom", chatPromptTemplate: "Private prompt text" },
    };
    const executor = createAssistantToolExecutor(
      makeDataSource({ getSettings: async () => aiRow, getAIProfiles: async () => profiles }),
    );

    const output = await executor("get_settings", { section: "ai" });

    expect(output).toEqual({
      ai: {
        profiles: [
          { title: "Home server", provider: "ollama", allowedModels: ["llama3"], hasKey: true },
          { title: null, provider: "openrouter", allowedModels: "all", hasKey: false },
        ],
        assistant: { temperature: 0.7, prompt: "custom" },
      },
    });
    const serialized = JSON.stringify(output);
    for (const secret of ["sk-secret-ollama", "10.0.0.5", "Private prompt text", profiles[0].id]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("get_app_info says the web demo has no sync", async () => {
    const executor = createAssistantToolExecutor(makeDataSource());

    expect(await executor("get_app_info", {})).toEqual({
      app: "web demo",
      sync: { state: "not available", message: "Sync is in the desktop app only." },
    });
  });

  const syncStatus = (overrides: Partial<AssistantToolSyncStatus>): AssistantToolSyncStatus => ({
    state: { type: "idle" },
    lastSuccessAt: Date.UTC(2026, 10, 16, 9, 30),
    pending: 3,
    held: 0,
    uploads: 1,
    fetches: 2,
    hold: null,
    isOverQuota: false,
    ...overrides,
  });
  const counts = {
    lastSyncedAt: "2026-11-16T09:30:00.000Z",
    changesWaitingToUpload: 3,
    imagesWaitingToUpload: 1,
    imagesWaitingToDownload: 2,
  };

  it.each([
    { status: syncStatus({ state: { type: "notEnrolled" } }), sync: { state: "not set up" } },
    { status: syncStatus({ state: { type: "idle" } }), sync: { state: "up to date", ...counts } },
    { status: syncStatus({ state: { type: "syncing" } }), sync: { state: "syncing", ...counts } },
    {
      status: syncStatus({ state: { type: "bootstrapping" }, lastSuccessAt: null }),
      sync: { state: "downloading the space", ...counts, lastSyncedAt: null },
    },
    {
      status: syncStatus({ state: { type: "importPending" } }),
      sync: { state: "waiting for the Add or Replace choice", ...counts },
    },
    {
      status: syncStatus({ state: { type: "stopped", stop: { reason: "pushRefused", code: "quota.envelope" } } }),
      sync: {
        state: "stopped",
        stoppedBecause: "the server refused this device's changes (reason code quota.envelope)",
        ...counts,
      },
    },
    {
      status: syncStatus({ isOverQuota: true, held: 4, hold: { reason: "updateRequired" } }),
      sync: {
        state: "up to date",
        problems: [
          "the space is full; new changes wait to upload",
          "downloads wait at a change this version of the app cannot read",
        ],
        ...counts,
        changesWaitingToUpload: 7,
      },
    },
  ])("get_app_info reports the desktop sync state as $sync.state", async ({ status, sync }) => {
    const executor = createAssistantToolExecutor(
      makeDataSource({ getAppInfo: async () => ({ app: "desktop", syncStatus: status }) }),
    );

    expect(await executor("get_app_info", {})).toEqual({ app: "desktop", sync });
  });

  it("get_app_info never passes an error stop's message, which can name the server", async () => {
    const status = syncStatus({
      state: { type: "stopped", stop: { reason: "error", message: "connect failed: https://sync.example.org:8443" } },
    });
    const executor = createAssistantToolExecutor(
      makeDataSource({ getAppInfo: async () => ({ app: "desktop", syncStatus: status }) }),
    );

    const output = await executor("get_app_info", {});

    expect(output).toMatchObject({
      sync: { stoppedBecause: "an error stopped sync; Settings → Sync shows the details" },
    });
    expect(JSON.stringify(output)).not.toContain("sync.example.org");
  });

  it("read_help_topic returns the asked section without reading host data", async () => {
    const unread = () => Promise.reject(new Error("host data should not be read"));
    const executor = createAssistantToolExecutor(
      makeDataSource({ getDecks: unread, getTemplates: unread, getAlgorithms: unread, getCardCounts: unread }),
    );

    const output = await executor("read_help_topic", { topic: "learning-settings", section: "Daily Limits" });

    expect(output).toMatchObject({ title: "Learning Settings", section: "Daily Limits" });
    expect((output as { markdown: string }).markdown).toMatch(/^## Daily Limits\n/);
  });

  it("read_help_topic fails the call for an unknown topic or section", async () => {
    const executor = createAssistantToolExecutor(makeDataSource());

    await expect(executor("read_help_topic", { topic: "billing" })).rejects.toThrow();
    await expect(executor("read_help_topic", { topic: "learning-settings", section: "Billing" })).rejects.toThrow(
      /no section "Billing"/,
    );
  });

  it("rejects unknown tool names", async () => {
    const executor = createAssistantToolExecutor(makeDataSource());
    await expect(executor("delete_everything", {})).rejects.toThrow("Unknown assistant tool: delete_everything");
  });
});
