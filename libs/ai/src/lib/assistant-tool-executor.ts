import type { ResolvedLearningSettings } from "@koloda/app";
import {
  ASSISTANT_TOOL_SPECS,
  shapeAddDeckOutput,
  shapeAppInfoOutput,
  shapeChangeSettingsOutput,
  shapeGetDeckCardsOutput,
  shapeGetDeckOutput,
  shapeGetSettingsOutput,
  shapeGetTemplateOutput,
  shapeLessonsTodayOutput,
  shapeListAlgorithmsOutput,
  shapeListDecksOutput,
  shapeListTemplatesOutput,
  shapeProposeCardsOutput,
} from "./assistant-tools";
import type {
  AssistantToolAlgorithm,
  AssistantToolAppInfo,
  AssistantToolCard,
  AssistantToolExecutor,
  AssistantToolLessons,
  AssistantToolTemplate,
  AssistantToolTodaysReviewTotals,
} from "./assistant-tools";
import { readHelpTopic } from "./help-corpus";
import type { AIProfile } from "./settings";
import {
  applySettingsValues,
  readSettingsValue,
  saveSettingsRows,
  SETTINGS_CHANGE_FIELDS,
  SETTINGS_CHANGE_ROWS,
  splitSettingsChangeField,
} from "./settings-changes";
import type { SettingsChange, SettingsChangeRow, SettingsRowContents } from "./settings-changes";

/**
 * Data access the assistant tools need. Injected by the host so this module
 * stays I/O-free (libs/ai holds shaping and budgets only — hosts bind the DB).
 */
type AssistantToolDataSource = {
  getDecks: () => Promise<Array<{ id: string; title: string; templateId: string; notes?: string | null }>>;
  getTemplates: () => Promise<AssistantToolTemplate[]>;
  getAlgorithms: () => Promise<AssistantToolAlgorithm[]>;
  getCards: (params: { deckId: string }) => Promise<AssistantToolCard[]>;
  getCardCounts: () => Promise<Record<string, number>>;
  /**
   * One settings row's content as the host's own read validates it, or null when no row is stored.
   * A present row that fails validation rejects.
   */
  getSettings: (name: "learning" | "interface" | "hotkeys" | "ai") => Promise<unknown>;
  /** The public profile read: keys redacted, `hasSecrets` from key presence. */
  getAIProfiles: () => Promise<AIProfile[]>;
  /** The Dashboard's available counts, due as of now, for the filtered decks. */
  getLessons: (filters: { deckIds?: string[] }) => Promise<AssistantToolLessons>;
  getTodaysReviewTotals: () => Promise<AssistantToolTodaysReviewTotals>;
  /** The host kind, and on the desktop the sync status; the web demo has no sync (`SYNC.md` (§Platform Availability)). */
  getAppInfo: () => Promise<AssistantToolAppInfo>;
  /**
   * Persist an empty deck and return the stored row; the executor shapes the output.
   * Called only after template and algorithm resolution succeed.
   * `algorithmId` is always explicit here; the host does not invent cards.
   */
  createDeck: (input: {
    title: string;
    templateId: string;
    algorithmId: string;
  }) => Promise<{ id: string; title: string; templateId: string; algorithmId: string }>;
  /**
   * Save one settings row whole, through the same validation as the settings screen's save.
   * Rejects, writing nothing, when the content fails it.
   */
  setSettings: (name: SettingsChangeRow, content: Record<string, unknown>) => Promise<unknown>;
};

/**
 * Shared assistant tool executor. Reads resolve through the host data source
 * and shape here. `add_deck` validates the template and algorithm, then calls
 * `createDeck`. It does not create cards or set a propose write target.
 */
export function createAssistantToolExecutor(data: AssistantToolDataSource): AssistantToolExecutor {
  // WHY: the same default that manual deck create stores when the user does not pick one.
  // `getSettings` returns the content its host read validated, so only the row's absence is checked here.
  const readDefaultAlgorithmId = async () => {
    const learning = (await data.getSettings("learning")) as ResolvedLearningSettings | null;
    const algorithmId = learning?.defaults.algorithm;
    if (!algorithmId) throw new Error("Algorithm not found: default");
    return algorithmId;
  };

  const resolveDeckTemplate = async (deckId: string) => {
    const [decks, templates] = await Promise.all([data.getDecks(), data.getTemplates()]);
    const deck = decks.find((row) => row.id === deckId);
    if (deck == null) throw new Error(`Deck not found: ${deckId}`);
    const template = templates.find((row) => row.id === deck.templateId);
    if (template == null) throw new Error(`Template not found for deck: ${deckId}`);
    return { deck, template };
  };

  return async (name, input, abortSignal) => {
    if (name === "list_decks") {
      const [decks, templates, counts] = await Promise.all([
        data.getDecks(),
        data.getTemplates(),
        data.getCardCounts(),
      ]);
      return shapeListDecksOutput(
        decks.map((deck) => ({
          id: deck.id,
          title: deck.title,
          templateId: deck.templateId,
          cardCount: counts[deck.id] ?? 0,
          notes: deck.notes,
        })),
        templates,
      );
    }
    if (name === "list_templates") {
      const templates = await data.getTemplates();
      return shapeListTemplatesOutput(templates);
    }
    if (name === "list_algorithms") {
      const algorithms = await data.getAlgorithms();
      return shapeListAlgorithmsOutput(algorithms);
    }
    if (name === "get_deck") {
      const { deckId } = ASSISTANT_TOOL_SPECS.get_deck.inputSchema.parse(input);
      const [decks, templates, counts] = await Promise.all([
        data.getDecks(),
        data.getTemplates(),
        data.getCardCounts(),
      ]);
      const deck = decks.find((row) => row.id === deckId);
      if (deck == null) throw new Error(`Deck not found: ${deckId}`);
      return shapeGetDeckOutput(
        {
          id: deck.id,
          title: deck.title,
          templateId: deck.templateId,
          cardCount: counts[deck.id] ?? 0,
          notes: deck.notes,
        },
        templates,
      );
    }
    if (name === "get_template") {
      const { templateId } = ASSISTANT_TOOL_SPECS.get_template.inputSchema.parse(input);
      const templates = await data.getTemplates();
      const template = templates.find((row) => row.id === templateId);
      if (template == null) throw new Error(`Template not found: ${templateId}`);
      return shapeGetTemplateOutput(template);
    }
    if (name === "get_deck_cards") {
      const { deckId } = ASSISTANT_TOOL_SPECS.get_deck_cards.inputSchema.parse(input);
      const { deck, template } = await resolveDeckTemplate(deckId);
      const cards = await data.getCards({ deckId });
      return shapeGetDeckCardsOutput({ id: deck.id, title: deck.title, template }, cards);
    }
    if (name === "add_deck") {
      const {
        title,
        templateId,
        algorithmId: requestedAlgorithmId,
      } = ASSISTANT_TOOL_SPECS.add_deck.inputSchema.parse(input);
      const templates = await data.getTemplates();
      const template = templates.find((row) => row.id === templateId);
      if (template == null) throw new Error(`Template not found: ${templateId}`);
      const algorithmId = requestedAlgorithmId ?? (await readDefaultAlgorithmId());
      const algorithms = await data.getAlgorithms();
      if (!algorithms.some((row) => row.id === algorithmId)) {
        throw new Error(`Algorithm not found: ${algorithmId}`);
      }
      // WHY: the reads above can outlast a cancel, and on desktop the renderer
      // refreshes deck caches as soon as the run ends. Never start the write for a
      // canceled run; a write already under way finishes, and that refresh follows it.
      abortSignal?.throwIfAborted();
      const created = await data.createDeck({ title, templateId, algorithmId });
      return shapeAddDeckOutput(created, template);
    }
    if (name === "propose_cards") {
      const { deckId, cards } = ASSISTANT_TOOL_SPECS.propose_cards.inputSchema.parse(input);
      const { deck, template } = await resolveDeckTemplate(deckId);
      return shapeProposeCardsOutput({ id: deck.id, title: deck.title, template }, cards);
    }
    if (name === "get_settings") {
      const { section } = ASSISTANT_TOOL_SPECS.get_settings.inputSchema.parse(input);
      const wants = (part: string) => section === undefined || section === part;
      const [learning, interfaceSettings, hotkeys, ai] = await Promise.all([
        wants("learning") ? data.getSettings("learning") : undefined,
        wants("interface") ? data.getSettings("interface") : undefined,
        wants("hotkeys") ? data.getSettings("hotkeys") : undefined,
        wants("ai")
          ? Promise.all([data.getSettings("ai"), data.getAIProfiles()]).then(([content, profiles]) => ({
              content,
              profiles,
            }))
          : undefined,
      ]);
      return shapeGetSettingsOutput({
        ...(wants("learning") ? { learning } : {}),
        ...(wants("interface") ? { interface: interfaceSettings } : {}),
        ...(wants("hotkeys") ? { hotkeys } : {}),
        ...(ai ? { ai } : {}),
      });
    }
    if (name === "change_settings") {
      const { changes } = ASSISTANT_TOOL_SPECS.change_settings.inputSchema.parse(input);
      for (const { field, value } of changes) {
        const parsed = SETTINGS_CHANGE_FIELDS[field].safeParse(value);
        if (!parsed.success) throw new Error(`Invalid value for ${field}: ${parsed.error.issues[0]?.message}`);
      }
      const rowNames = SETTINGS_CHANGE_ROWS.filter((row) =>
        changes.some(({ field }) => splitSettingsChangeField(field).row === row),
      );
      const rows: SettingsRowContents = {};
      for (const row of rowNames) {
        const content = (await data.getSettings(row)) as Record<string, unknown> | null;
        if (content == null) throw new Error(`No ${row} settings are saved`);
        rows[row] = content;
      }
      const applied: SettingsChange[] = changes
        .map(({ field, value }) => ({ field, from: readSettingsValue(rows, field), to: value }))
        .filter(({ from, to }) => JSON.stringify(from) !== JSON.stringify(to));
      if (applied.length === 0) return shapeChangeSettingsOutput([]);
      const algorithmId = applied.find(({ field }) => field === "learning.defaults.algorithm")?.to;
      if (algorithmId !== undefined && !(await data.getAlgorithms()).some((row) => row.id === algorithmId)) {
        throw new Error(`Algorithm not found: ${algorithmId}`);
      }
      const templateId = applied.find(({ field }) => field === "learning.defaults.template")?.to;
      if (templateId !== undefined && !(await data.getTemplates()).some((row) => row.id === templateId)) {
        throw new Error(`Template not found: ${templateId}`);
      }
      const next = applySettingsValues(
        rows,
        applied.map(({ field, to }) => ({ field, value: to })),
      );
      // WHY: as in add_deck, never start a write for a run the user canceled during the reads.
      abortSignal?.throwIfAborted();
      await saveSettingsRows(rows, next, data.setSettings);
      return shapeChangeSettingsOutput(applied);
    }
    if (name === "get_lessons_today") {
      const { deckId } = ASSISTANT_TOOL_SPECS.get_lessons_today.inputSchema.parse(input);
      const [lessons, todaysReviewTotals, learning] = await Promise.all([
        data.getLessons(deckId === undefined ? {} : { deckIds: [deckId] }),
        data.getTodaysReviewTotals(),
        data.getSettings("learning") as Promise<ResolvedLearningSettings | null>,
      ]);
      if (learning == null) throw new Error("Learning settings not found");
      const { dayStartsAt } = learning;
      if (deckId === undefined) return shapeLessonsTodayOutput({ lessons, todaysReviewTotals, dayStartsAt });
      const deck = lessons.decks.find((row) => row.id === deckId);
      if (deck == null) throw new Error(`Deck not found: ${deckId}`);
      return shapeLessonsTodayOutput({ lessons, todaysReviewTotals, dayStartsAt, deck });
    }
    if (name === "get_app_info") {
      return shapeAppInfoOutput(await data.getAppInfo());
    }
    if (name === "read_help_topic") {
      const { topic, section } = ASSISTANT_TOOL_SPECS.read_help_topic.inputSchema.parse(input);
      return readHelpTopic(topic, section);
    }
    throw new Error(`Unknown assistant tool: ${name}`);
  };
}
