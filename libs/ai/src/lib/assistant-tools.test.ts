import { describe, expect, it, vi } from "vitest";
import {
  ASSISTANT_TOOL_MAX_CARDS_PER_DECK,
  ASSISTANT_TOOL_NOTE_PREVIEW_CHAR_BUDGET,
  ASSISTANT_TOOL_SPECS,
  bindAssistantTools,
} from "./assistant-tools";
import { HELP_TOPIC_IDS } from "./help-corpus.generated";
import type { AssistantToolCard, AssistantToolTemplate, ProposeCardsOutput } from "./assistant-tools";
import {
  generatedCardsFromProposeOutput,
  isProposeCardsOutput,
  PROPOSE_CARDS_RETRY_MESSAGE,
  proposeCardsRejectedMessage,
  shapeGetDeckCardsOutput,
  shapeGetDeckOutput,
  shapeGetTemplateOutput,
  shapeListAlgorithmsOutput,
  shapeListDecksOutput,
  shapeListTemplatesOutput,
  shapeProposeCardsOutput,
} from "./assistant-tools";

describe("assistant-tools binder", () => {
  it("binds only the requested specs with model-facing descriptions", () => {
    const bound = bindAssistantTools({ names: ["get_deck_cards"], execute: vi.fn() });

    expect(Object.keys(bound)).toEqual(["get_deck_cards"]);
    expect(bound.get_deck_cards?.description).toBe(ASSISTANT_TOOL_SPECS.get_deck_cards.description);
  });

  it("rejects unknown tool names at bind time", () => {
    expect(() => bindAssistantTools({ names: ["nope"], execute: vi.fn() })).toThrow(/Unknown assistant tool/);
  });
});

describe("deck, template, algorithm, and card tool descriptions", () => {
  it("tells the model propose_cards creates new cards and how to report rejects", () => {
    const { description } = ASSISTANT_TOOL_SPECS.propose_cards;
    expect(description).toMatch(/create new flashcards/i);
    expect(description).toMatch(/random card/i);
    expect(description).toMatch(/do not ask the user/i);
    expect(description).toMatch(/empty cards array/i);
    expect(description).toMatch(/rejectedCount/i);
    expect(description).toMatch(/markdown table/i);
  });

  it("tells the model list_decks returns field titles, without making it the first call for every question", () => {
    const { description } = ASSISTANT_TOOL_SPECS.list_decks;
    expect(description).toMatch(/field titles/i);
    expect(description).toMatch(/do not ask the user for field titles/i);
    expect(description).not.toMatch(/call this first when the user asks about their decks or cards/i);
  });

  it("tells the model list_templates returns field titles, so it need not ask", () => {
    const { description } = ASSISTANT_TOOL_SPECS.list_templates;
    expect(description).toMatch(/field titles/i);
    expect(description).toMatch(/do not ask the user to list templates/i);
  });

  it("tells the model list_algorithms returns presets with FSRS settings, so it need not ask", () => {
    const { description } = ASSISTANT_TOOL_SPECS.list_algorithms;
    expect(description).toMatch(/presets/i);
    expect(description).toMatch(/FSRS settings/i);
    expect(description).toMatch(/do not ask the user to list presets/i);
  });

  it("tells the model get_deck takes an id from list_decks and returns no card bodies", () => {
    const { description } = ASSISTANT_TOOL_SPECS.get_deck;
    expect(description).toMatch(/use the deckId from list_decks/i);
    expect(description).toMatch(/do not ask the user for an id/i);
    expect(description).toMatch(/does not return card bodies/i);
  });

  it("tells the model get_template takes a known id and returns no decks or cards", () => {
    const { description } = ASSISTANT_TOOL_SPECS.get_template;
    expect(description).toMatch(
      /use the templateId from list_templates \(or another tool result that returned that id\)/i,
    );
    expect(description).toMatch(/do not ask the user for an id/i);
    expect(description).toMatch(/does not return decks, cards, or create cards/i);
  });

  it("tells the model get_deck_cards cannot pick a random card", () => {
    expect(ASSISTANT_TOOL_SPECS.get_deck_cards.description).toMatch(/cannot pick a single random card/i);
  });

  it("tells the model add_deck creates an empty deck from listed ids and edits nothing else", () => {
    const { description } = ASSISTANT_TOOL_SPECS.add_deck;
    expect(description).toMatch(/call list_templates first for templateId/i);
    expect(description).toMatch(/do not ask the user for ids/i);
    expect(description).toMatch(/via list_algorithms/i);
    expect(description).toMatch(/otherwise omit and use the app default/i);
    expect(description).toMatch(/empty deck only/i);
    expect(description).toMatch(/propose_cards/i);
    expect(description).toMatch(/does not edit templates or algorithms/i);
  });
});

describe("get_app_info", () => {
  it("tells the model when to call it and what it never returns", () => {
    const { description } = ASSISTANT_TOOL_SPECS.get_app_info;
    expect(description).toMatch(/which app they use or whether sync works/i);
    expect(description).toMatch(/do not ask the user/i);
    expect(description).toMatch(/web demo has no sync/i);
    expect(description).toMatch(/server addresses, space and device ids, and tokens are never returned/i);
  });
});

describe("get_settings", () => {
  const { description, inputSchema } = ASSISTANT_TOOL_SPECS.get_settings;

  it("tells the model these are current values and what it never returns", () => {
    expect(description).toMatch(/current settings/i);
    expect(description).toMatch(/help topics give only first-setup defaults/i);
    expect(description).toMatch(/do not ask the user for their settings/i);
    expect(description).toMatch(/keys, provider secrets and addresses, and the custom prompt text are never returned/i);
    expect(description).toMatch(/cannot change settings/i);
  });

  it("accepts one of the four sections or none", () => {
    expect(inputSchema.parse({})).toEqual({});
    for (const section of ["learning", "interface", "hotkeys", "ai"]) {
      expect(inputSchema.parse({ section })).toEqual({ section });
    }
    expect(() => inputSchema.parse({ section: "sync" })).toThrow();
  });
});

describe("read_help_topic", () => {
  const { description, inputSchema } = ASSISTANT_TOOL_SPECS.read_help_topic;

  it("indexes every help topic in its description", () => {
    const missing = HELP_TOPIC_IDS.filter((id) => !description.includes(`\n- ${id}: `));
    expect(missing).toEqual([]);
  });

  it("tells the model to read before answering and what topics cannot tell", () => {
    expect(description).toMatch(/instead of answering from memory/i);
    expect(description).toMatch(/first-setup defaults, not this installation's current values; get_settings/i);
    expect(description).toMatch(/labels .* are the English ones/i);
    expect(description).toMatch(/pass section/i);
  });

  it("accepts a known topic with an optional section", () => {
    expect(inputSchema.parse({ topic: "lessons" })).toEqual({ topic: "lessons" });
    expect(inputSchema.parse({ topic: "lessons", section: "Grading" })).toEqual({
      topic: "lessons",
      section: "Grading",
    });
  });

  it("rejects an unknown topic and an empty section", () => {
    expect(() => inputSchema.parse({ topic: "billing" })).toThrow();
    expect(() => inputSchema.parse({})).toThrow();
    expect(() => inputSchema.parse({ topic: "lessons", section: "" })).toThrow();
  });
});

describe("get_deck input schema", () => {
  const schema = ASSISTANT_TOOL_SPECS.get_deck.inputSchema;
  const deckId = "01900000-0000-7000-8000-000000000005";

  it("accepts a uuid deckId", () => {
    expect(schema.parse({ deckId })).toEqual({ deckId });
  });

  it("rejects a missing or non-uuid deckId", () => {
    expect(() => schema.parse({})).toThrow();
    expect(() => schema.parse({ deckId: "not-a-uuid" })).toThrow();
  });
});

describe("get_template input schema", () => {
  const schema = ASSISTANT_TOOL_SPECS.get_template.inputSchema;
  const templateId = "01900000-0000-7000-8000-000000000005";

  it("accepts a uuid templateId", () => {
    expect(schema.parse({ templateId })).toEqual({ templateId });
  });

  it("rejects a missing or non-uuid templateId", () => {
    expect(() => schema.parse({})).toThrow();
    expect(() => schema.parse({ templateId: "not-a-uuid" })).toThrow();
    expect(() => schema.parse({ deckId: templateId })).toThrow();
  });
});

describe("add_deck input schema", () => {
  const schema = ASSISTANT_TOOL_SPECS.add_deck.inputSchema;
  const templateId = "01900000-0000-7000-8000-000000000005";
  const algorithmId = "01900000-0000-7000-8000-000000000031";

  it("requires a title and templateId and trims the title", () => {
    expect(schema.parse({ title: "  Spanish  ", templateId })).toEqual({ title: "Spanish", templateId });
  });

  it("accepts an optional algorithm id", () => {
    expect(schema.parse({ title: "Spanish", templateId, algorithmId })).toEqual({
      title: "Spanish",
      templateId,
      algorithmId,
    });
  });

  it("rejects a blank title, a missing templateId, and a bad uuid", () => {
    expect(() => schema.parse({ title: "   ", templateId })).toThrow();
    expect(() => schema.parse({ title: "Spanish" })).toThrow();
    expect(() => schema.parse({ title: "Spanish", templateId: "not-a-uuid" })).toThrow();
    expect(() => schema.parse({ title: "Spanish", templateId, algorithmId: "not-a-uuid" })).toThrow();
  });
});

describe("propose_cards input schema", () => {
  const schema = ASSISTANT_TOOL_SPECS.propose_cards.inputSchema;

  it("coerces a flattened card and { text } field values", () => {
    expect(
      schema.parse({ deckId: "01900000-0000-7000-8000-000000000005", cards: [{ Front: "hola", Back: "hello" }] }),
    ).toEqual({
      deckId: "01900000-0000-7000-8000-000000000005",
      cards: [{ fields: { Front: "hola", Back: "hello" } }],
    });
    expect(
      schema.parse({
        deckId: "01900000-0000-7000-8000-000000000005",
        cards: [{ fields: { Front: { text: "hola" }, Back: { text: "hello" } } }],
      }),
    ).toEqual({
      deckId: "01900000-0000-7000-8000-000000000005",
      cards: [{ fields: { Front: "hola", Back: "hello" } }],
    });
  });

  it("parses an empty cards array", () => {
    expect(schema.parse({ deckId: "01900000-0000-7000-8000-000000000005", cards: [] })).toEqual({
      deckId: "01900000-0000-7000-8000-000000000005",
      cards: [],
    });
  });

  it("coerces a mixed batch without failing the payload", () => {
    expect(
      schema.parse({
        deckId: "01900000-0000-7000-8000-000000000005",
        cards: [
          { fields: { Front: "hola", Back: "hello" } },
          { fields: { Front: "gato", Back: 1 } },
          { fields: { Front: "x", Back: [] } },
          "not-an-object",
        ],
      }),
    ).toEqual({
      deckId: "01900000-0000-7000-8000-000000000005",
      cards: [
        { fields: { Front: "hola", Back: "hello" } },
        { fields: { Front: "gato", Back: "1" } },
        { fields: { Front: "x" } },
        { fields: {} },
      ],
    });
  });

  it("coerces booleans and { text } numbers to strings", () => {
    expect(
      schema.parse({
        deckId: "01900000-0000-7000-8000-000000000005",
        cards: [{ fields: { Front: true, Back: { text: 1492 } } }],
      }),
    ).toEqual({
      deckId: "01900000-0000-7000-8000-000000000005",
      cards: [{ fields: { Front: "true", Back: "1492" } }],
    });
  });

  it("parses all-unfixable cards as empty field maps", () => {
    expect(
      schema.parse({ deckId: "01900000-0000-7000-8000-000000000005", cards: [null, "x", [1], { fields: 1 }] }),
    ).toEqual({
      deckId: "01900000-0000-7000-8000-000000000005",
      cards: [{ fields: {} }, { fields: {} }, { fields: {} }, { fields: {} }],
    });
  });
});

describe("tool output shaping", () => {
  const templates: AssistantToolTemplate[] = [
    {
      id: "01900000-0000-7000-8000-000000000001",
      title: "Basic",
      content: {
        fields: [
          { id: "01900000-0000-7000-8000-00000000000a", title: "Front", type: "text", isRequired: true },
          { id: "01900000-0000-7000-8000-00000000000b", title: "Back", type: "text", isRequired: true },
        ],
      },
    },
    {
      id: "01900000-0000-7000-8000-000000000002",
      title: "Cloze",
      content: {
        fields: [{ id: "01900000-0000-7000-8000-000000000014", title: "Text", type: "text", isRequired: true }],
      },
    },
  ];
  const deck = { id: "01900000-0000-7000-8000-000000000005", title: "Spanish verbs", template: templates[0] };

  /** Card content is keyed by field id as a string, mirroring the persisted shape. */
  function card(texts: Record<string, string>): AssistantToolCard {
    return {
      content: Object.fromEntries(Object.entries(texts).map(([id, text]) => [id, { text }])),
    };
  }

  it("maps template rows to list_templates output with field titles", () => {
    expect(shapeListTemplatesOutput(templates)).toEqual({
      templates: [
        {
          templateId: "01900000-0000-7000-8000-000000000001",
          title: "Basic",
          fieldTitles: ["Front", "Back"],
        },
        {
          templateId: "01900000-0000-7000-8000-000000000002",
          title: "Cloze",
          fieldTitles: ["Text"],
        },
      ],
    });
  });

  it("maps algorithm rows to list_algorithms output with FSRS settings", () => {
    const content = {
      type: "fsrs" as const,
      retention: 90,
      weights: "0.212, 1.2931",
      isFuzzEnabled: true,
      learningSteps: [[1, "m"] as [number, string], [10, "m"] as [number, string]],
      relearningSteps: [[10, "m"] as [number, string]],
      maximumInterval: 36500,
    };
    expect(
      shapeListAlgorithmsOutput([
        { id: "01900000-0000-7000-8000-000000000021", title: "Default", content },
        { id: "01900000-0000-7000-8000-000000000022", title: "Strict", content: { ...content, retention: 95 } },
      ]),
    ).toEqual({
      algorithms: [
        {
          algorithmId: "01900000-0000-7000-8000-000000000021",
          title: "Default",
          content,
        },
        {
          algorithmId: "01900000-0000-7000-8000-000000000022",
          title: "Strict",
          content: { ...content, retention: 95 },
        },
      ],
    });
  });

  it("maps deck rows to list_decks output with template titles and field titles", () => {
    const output = shapeListDecksOutput(
      [
        {
          id: "01900000-0000-7000-8000-000000000005",
          title: "Spanish verbs",
          templateId: "01900000-0000-7000-8000-000000000001",
          cardCount: 12,
        },
        {
          id: "01900000-0000-7000-8000-000000000006",
          title: "Orphan",
          templateId: "01900000-0000-7000-8000-000000000063",
          cardCount: 0,
        },
      ],
      templates,
    );

    expect(output).toEqual({
      decks: [
        {
          deckId: "01900000-0000-7000-8000-000000000005",
          title: "Spanish verbs",
          cardCount: 12,
          templateTitle: "Basic",
          fieldTitles: ["Front", "Back"],
        },
        {
          deckId: "01900000-0000-7000-8000-000000000006",
          title: "Orphan",
          cardCount: 0,
          templateTitle: null,
          fieldTitles: [],
        },
      ],
    });
  });

  it("returns an empty deck list for empty inputs", () => {
    expect(shapeListDecksOutput([], templates)).toEqual({ decks: [] });
  });

  it("maps one deck row to get_deck output with template titles and field titles", () => {
    expect(
      shapeGetDeckOutput(
        {
          id: "01900000-0000-7000-8000-000000000005",
          title: "Spanish verbs",
          templateId: "01900000-0000-7000-8000-000000000001",
          cardCount: 12,
        },
        templates,
      ),
    ).toEqual({
      deckId: "01900000-0000-7000-8000-000000000005",
      title: "Spanish verbs",
      cardCount: 12,
      templateTitle: "Basic",
      fieldTitles: ["Front", "Back"],
    });
  });

  it("maps a missing template to a null title and empty fieldTitles", () => {
    expect(
      shapeGetDeckOutput(
        {
          id: "01900000-0000-7000-8000-000000000006",
          title: "Orphan",
          templateId: "01900000-0000-7000-8000-000000000063",
          cardCount: 0,
        },
        templates,
      ),
    ).toEqual({
      deckId: "01900000-0000-7000-8000-000000000006",
      title: "Orphan",
      cardCount: 0,
      templateTitle: null,
      fieldTitles: [],
    });
  });

  it("maps one template to get_template output preserving field order, types, and required", () => {
    expect(
      shapeGetTemplateOutput({
        id: "01900000-0000-7000-8000-000000000003",
        title: "Notes",
        content: {
          fields: [
            { id: "01900000-0000-7000-8000-00000000000c", title: "Prompt", type: "text", isRequired: true },
            { id: "01900000-0000-7000-8000-00000000000d", title: "Notes", type: "markdown", isRequired: false },
            { id: "01900000-0000-7000-8000-00000000000e", title: "Hint", type: "text", isRequired: false },
          ],
        },
      }),
    ).toEqual({
      templateId: "01900000-0000-7000-8000-000000000003",
      title: "Notes",
      fields: [
        { id: "01900000-0000-7000-8000-00000000000c", title: "Prompt", type: "text", isRequired: true },
        { id: "01900000-0000-7000-8000-00000000000d", title: "Notes", type: "markdown", isRequired: false },
        { id: "01900000-0000-7000-8000-00000000000e", title: "Hint", type: "text", isRequired: false },
      ],
    });
  });

  it("lists every card of a small deck and maps field ids to titles", () => {
    const cards = [
      card({
        "01900000-0000-7000-8000-00000000000a": "hola",
        "01900000-0000-7000-8000-00000000000b": "hello",
      }),
      card({
        "01900000-0000-7000-8000-00000000000a": "gato",
        "01900000-0000-7000-8000-00000000000b": "cat",
      }),
    ];

    expect(shapeGetDeckCardsOutput(deck, cards)).toEqual({
      deckTitle: "Spanish verbs",
      totalCards: 2,
      isCapped: false,
      cards: [{ fields: { Front: "hola", Back: "hello" } }, { fields: { Front: "gato", Back: "cat" } }],
    });
  });

  it("maps a field missing from card content to empty text", () => {
    expect(shapeGetDeckCardsOutput(deck, [card({ "01900000-0000-7000-8000-00000000000a": "hola" })])).toEqual({
      deckTitle: "Spanish verbs",
      totalCards: 1,
      isCapped: false,
      cards: [{ fields: { Front: "hola", Back: "" } }],
    });
  });

  it("returns no cards for an empty deck without flagging it capped", () => {
    expect(shapeGetDeckCardsOutput(deck, [])).toEqual({
      deckTitle: "Spanish verbs",
      totalCards: 0,
      isCapped: false,
      cards: [],
    });
  });

  it(`caps the card list at ${ASSISTANT_TOOL_MAX_CARDS_PER_DECK} while reporting the true total`, () => {
    // WHY: single short field keeps every entry far under the char budget, so the
    // only truncation source in this test is the per-deck cap.
    const cappedDeck = { id: "01900000-0000-7000-8000-000000000007", title: "Numbers", template: templates[1] };
    const cards = Array.from({ length: ASSISTANT_TOOL_MAX_CARDS_PER_DECK + 5 }, (_unused, index) =>
      card({ "01900000-0000-7000-8000-000000000014": `n${index}` }),
    );

    const output = shapeGetDeckCardsOutput(cappedDeck, cards);

    expect(output.totalCards).toBe(ASSISTANT_TOOL_MAX_CARDS_PER_DECK + 5);
    expect(output.cards).toHaveLength(ASSISTANT_TOOL_MAX_CARDS_PER_DECK);
    expect(output.cards[0]).toEqual({ fields: { Text: "n0" } });
    expect(output.cards[ASSISTANT_TOOL_MAX_CARDS_PER_DECK - 1]).toEqual({
      fields: { Text: `n${ASSISTANT_TOOL_MAX_CARDS_PER_DECK - 1}` },
    });
    expect(output.isCapped).toBe(true);
  });

  it("skips a card past the serialized char budget and keeps filling with later cards", () => {
    // WHY: each big entry serializes to ~7.1k chars, so the second never fits the
    // 8k budget — truncation comes from the budget, not the 200-card cap.
    const bigText = "x".repeat(3_500);
    const big = { "01900000-0000-7000-8000-00000000000a": bigText, "01900000-0000-7000-8000-00000000000b": bigText };
    const cards = [
      card(big),
      card({ "01900000-0000-7000-8000-00000000000a": "uno", "01900000-0000-7000-8000-00000000000b": "one" }),
      card(big),
      card({ "01900000-0000-7000-8000-00000000000a": "dos", "01900000-0000-7000-8000-00000000000b": "two" }),
      card({ "01900000-0000-7000-8000-00000000000a": "tres", "01900000-0000-7000-8000-00000000000b": "three" }),
    ];

    const output = shapeGetDeckCardsOutput(deck, cards);

    expect(output.totalCards).toBe(5);
    expect(output.cards).toEqual([
      { fields: { Front: bigText, Back: bigText } },
      { fields: { Front: "uno", Back: "one" } },
      { fields: { Front: "dos", Back: "two" } },
      { fields: { Front: "tres", Back: "three" } },
    ]);
    expect(output.isCapped).toBe(true);
  });

  it("lists the fitting cards when the first card alone is over the char budget", () => {
    const cards = [
      card({ "01900000-0000-7000-8000-00000000000a": "x".repeat(9_000), "01900000-0000-7000-8000-00000000000b": "" }),
      card({ "01900000-0000-7000-8000-00000000000a": "hola", "01900000-0000-7000-8000-00000000000b": "hello" }),
      card({ "01900000-0000-7000-8000-00000000000a": "gato", "01900000-0000-7000-8000-00000000000b": "cat" }),
    ];

    const output = shapeGetDeckCardsOutput(deck, cards);

    expect(output.totalCards).toBe(3);
    expect(output.cards).toEqual([
      { fields: { Front: "hola", Back: "hello" } },
      { fields: { Front: "gato", Back: "cat" } },
    ]);
    expect(output.isCapped).toBe(true);
  });
});

describe("propose_cards output shaping", () => {
  const template: AssistantToolTemplate = {
    id: "01900000-0000-7000-8000-000000000001",
    title: "Basic",
    content: {
      fields: [
        { id: "01900000-0000-7000-8000-00000000000a", title: "Front", type: "text", isRequired: true },
        { id: "01900000-0000-7000-8000-00000000000b", title: "Back", type: "text", isRequired: true },
        { id: "01900000-0000-7000-8000-00000000000c", title: "Hint", type: "text", isRequired: false },
      ],
    },
  };
  const deck = { id: "01900000-0000-7000-8000-000000000005", title: "Spanish verbs", template };

  it("maps titles onto template field ids and returns title-keyed accepted cards", () => {
    expect(shapeProposeCardsOutput(deck, [{ fields: { Front: "hola", Back: "hello", Hint: "greeting" } }])).toEqual({
      deckId: "01900000-0000-7000-8000-000000000005",
      deckTitle: "Spanish verbs",
      templateId: "01900000-0000-7000-8000-000000000001",
      templateFields: [
        { id: "01900000-0000-7000-8000-00000000000a", title: "Front", type: "text", isRequired: true },
        { id: "01900000-0000-7000-8000-00000000000b", title: "Back", type: "text", isRequired: true },
        { id: "01900000-0000-7000-8000-00000000000c", title: "Hint", type: "text", isRequired: false },
      ],
      cards: [{ fields: { Front: "hola", Back: "hello", Hint: "greeting" } }],
      rejectedCount: 0,
    });
  });

  it("drops all-empty cards", () => {
    const output = shapeProposeCardsOutput(deck, [
      { fields: { Front: "hola", Back: "hello" } },
      { fields: { Front: "  ", Back: "", Hint: "   " } },
      { fields: {} },
    ]);

    expect(output.cards).toEqual([{ fields: { Front: "hola", Back: "hello", Hint: "" } }]);
    expect(output.rejectedCount).toBe(2);
    expect(output.message).toBe(proposeCardsRejectedMessage(2));
  });

  it("rejects a card that leaves a required field blank and names the field", () => {
    const output = shapeProposeCardsOutput(deck, [
      { fields: { Front: "hola", Hint: "greeting" } },
      { fields: { Front: "gato", Back: "cat" } },
    ]);

    expect(output.cards).toEqual([{ fields: { Front: "gato", Back: "cat", Hint: "" } }]);
    expect(output.rejectedCount).toBe(1);
    expect(output.message).toBe(
      `${proposeCardsRejectedMessage(1)} Required fields left empty: Back. Fill them in every card.`,
    );
  });

  it("names every blank required field, in template order, when no card is accepted", () => {
    const output = shapeProposeCardsOutput(deck, [
      { fields: { Back: "hello" } },
      { fields: { Hint: "only optional" } },
    ]);

    expect(output.cards).toEqual([]);
    expect(output.rejectedCount).toBe(2);
    expect(output.message).toBe(
      `${PROPOSE_CARDS_RETRY_MESSAGE} Required fields left empty: Front, Back. Fill them in every card.`,
    );
  });

  it("rejects a key that matches no field as a blank required field", () => {
    const output = shapeProposeCardsOutput(deck, [{ fields: { Front: "hola", Answer: "hello" } }]);

    expect(output.cards).toEqual([]);
    expect(output.rejectedCount).toBe(1);
    expect(output.message).toContain("Required fields left empty: Back.");
  });

  it("accepts lowercase field titles and field-id keys", () => {
    expect(shapeProposeCardsOutput(deck, [{ fields: { front: "hola", BACK: "hello" } }]).cards).toEqual([
      { fields: { Front: "hola", Back: "hello", Hint: "" } },
    ]);
    expect(
      shapeProposeCardsOutput(deck, [
        {
          fields: {
            "01900000-0000-7000-8000-00000000000a": "hola",
            "01900000-0000-7000-8000-00000000000b": "hello",
          },
        },
      ]).cards,
    ).toEqual([{ fields: { Front: "hola", Back: "hello", Hint: "" } }]);
  });

  it("tells the model to retry when every card is rejected", () => {
    const output = shapeProposeCardsOutput(deck, [{ fields: {} }, { fields: { Front: "  ", Back: "", Hint: "   " } }]);

    expect(output.cards).toEqual([]);
    expect(output.rejectedCount).toBe(2);
    expect(output.message).toBe(PROPOSE_CARDS_RETRY_MESSAGE);
  });

  it("tells the model about partial rejects without failing the tool", () => {
    const output = shapeProposeCardsOutput(deck, [{ fields: { Front: "hola", Back: "hello" } }, { fields: {} }]);

    expect(output.cards).toEqual([{ fields: { Front: "hola", Back: "hello", Hint: "" } }]);
    expect(output.rejectedCount).toBe(1);
    expect(output.message).toBe(proposeCardsRejectedMessage(1));
  });

  it("keeps a card with one value when the template requires no field", () => {
    const optionalDeck = {
      ...deck,
      template: {
        ...template,
        content: { fields: template.content.fields.map((field) => ({ ...field, isRequired: false })) },
      },
    };
    const output = shapeProposeCardsOutput(optionalDeck, [{ fields: { Hint: "only optional" } }]);

    expect(output.cards).toEqual([{ fields: { Front: "", Back: "", Hint: "only optional" } }]);
    expect(output.rejectedCount).toBe(0);
    expect(output.message).toBeUndefined();
  });

  it("ignores unknown field titles", () => {
    const output = shapeProposeCardsOutput(deck, [{ fields: { Front: "hola", Back: "hello", Extra: "nope" } }]);

    expect(output.cards).toEqual([{ fields: { Front: "hola", Back: "hello", Hint: "" } }]);
    expect(output.rejectedCount).toBe(0);
  });

  it("returns an empty accepted list for empty input without rejecting", () => {
    expect(shapeProposeCardsOutput(deck, [])).toEqual({
      deckId: "01900000-0000-7000-8000-000000000005",
      deckTitle: "Spanish verbs",
      templateId: "01900000-0000-7000-8000-000000000001",
      templateFields: [
        { id: "01900000-0000-7000-8000-00000000000a", title: "Front", type: "text", isRequired: true },
        { id: "01900000-0000-7000-8000-00000000000b", title: "Back", type: "text", isRequired: true },
        { id: "01900000-0000-7000-8000-00000000000c", title: "Hint", type: "text", isRequired: false },
      ],
      cards: [],
      rejectedCount: 0,
    });
  });

  it(`caps accepted cards at ${ASSISTANT_TOOL_MAX_CARDS_PER_DECK} and counts extras as rejected`, () => {
    const cards = Array.from({ length: ASSISTANT_TOOL_MAX_CARDS_PER_DECK + 5 }, (_unused, index) => ({
      fields: { Front: `f${index}`, Back: `b${index}` },
    }));

    const output = shapeProposeCardsOutput(deck, cards);

    expect(output.cards).toHaveLength(ASSISTANT_TOOL_MAX_CARDS_PER_DECK);
    expect(output.rejectedCount).toBe(5);
    expect(output.message).toBe(proposeCardsRejectedMessage(5));
    expect(output.cards[0]).toEqual({ fields: { Front: "f0", Back: "b0", Hint: "" } });
    expect(output.cards[ASSISTANT_TOOL_MAX_CARDS_PER_DECK - 1]).toEqual({
      fields: {
        Front: `f${ASSISTANT_TOOL_MAX_CARDS_PER_DECK - 1}`,
        Back: `b${ASSISTANT_TOOL_MAX_CARDS_PER_DECK - 1}`,
        Hint: "",
      },
    });
  });

  it("copies the source template id onto the shaped result", () => {
    expect(shapeProposeCardsOutput(deck, [{ fields: { Front: "hola", Back: "hello" } }]).templateId).toBe(
      "01900000-0000-7000-8000-000000000001",
    );
  });

  it("carries isRequired from the source template onto output fields", () => {
    const output = shapeProposeCardsOutput(deck, [{ fields: { Front: "hola", Back: "hello" } }]);

    expect(output.templateFields).toEqual([
      { id: "01900000-0000-7000-8000-00000000000a", title: "Front", type: "text", isRequired: true },
      { id: "01900000-0000-7000-8000-00000000000b", title: "Back", type: "text", isRequired: true },
      { id: "01900000-0000-7000-8000-00000000000c", title: "Hint", type: "text", isRequired: false },
    ]);
  });

  it("carries type: markdown from the source template onto output fields", () => {
    const markdownDeck = {
      id: "01900000-0000-7000-8000-000000000005",
      title: "Spanish verbs",
      template: {
        id: "01900000-0000-7000-8000-000000000001",
        title: "Basic",
        content: {
          fields: [
            { id: "01900000-0000-7000-8000-00000000000a", title: "Front", type: "text" as const, isRequired: true },
            { id: "01900000-0000-7000-8000-00000000000b", title: "Back", type: "markdown" as const, isRequired: true },
          ],
        },
      },
    };

    const output = shapeProposeCardsOutput(markdownDeck, [{ fields: { Front: "hola", Back: "**hello**" } }]);

    expect(output.templateFields).toEqual([
      { id: "01900000-0000-7000-8000-00000000000a", title: "Front", type: "text", isRequired: true },
      { id: "01900000-0000-7000-8000-00000000000b", title: "Back", type: "markdown", isRequired: true },
    ]);
    expect(isProposeCardsOutput(output)).toBe(true);
  });
});

describe("propose_cards output guard and mapper", () => {
  const validOutput: ProposeCardsOutput = {
    deckId: "01900000-0000-7000-8000-000000000005",
    deckTitle: "Spanish verbs",
    templateId: "01900000-0000-7000-8000-000000000001",
    templateFields: [
      { id: "01900000-0000-7000-8000-00000000000a", title: "Front", type: "text", isRequired: true },
      { id: "01900000-0000-7000-8000-00000000000b", title: "Back", type: "text", isRequired: true },
      { id: "01900000-0000-7000-8000-00000000000c", title: "Hint", type: "text", isRequired: false },
    ],
    cards: [{ fields: { Front: "hola", Back: "hello", Hint: "greeting" } }],
    rejectedCount: 0,
  };

  it("accepts a shaped propose_cards payload", () => {
    const deck = {
      id: "01900000-0000-7000-8000-000000000005",
      title: "Spanish verbs",
      template: {
        id: "01900000-0000-7000-8000-000000000001",
        title: "Basic",
        content: {
          fields: [
            { id: "01900000-0000-7000-8000-00000000000a", title: "Front", type: "text" as const, isRequired: true },
            { id: "01900000-0000-7000-8000-00000000000b", title: "Back", type: "text" as const, isRequired: true },
            { id: "01900000-0000-7000-8000-00000000000c", title: "Hint", type: "text" as const, isRequired: false },
          ],
        },
      },
    };

    expect(isProposeCardsOutput(validOutput)).toBe(true);
    expect(isProposeCardsOutput(shapeProposeCardsOutput(deck, [{ fields: { Front: "hola", Back: "hello" } }]))).toBe(
      true,
    );
  });

  it("rejects malformed payloads", () => {
    expect(isProposeCardsOutput(undefined)).toBe(false);
    expect(isProposeCardsOutput(null)).toBe(false);
    expect(isProposeCardsOutput({ decks: [] })).toBe(false);
    expect(isProposeCardsOutput({ ...validOutput, deckId: 0 })).toBe(false);
    expect(isProposeCardsOutput({ ...validOutput, deckId: 1.5 })).toBe(false);
    expect(isProposeCardsOutput({ ...validOutput, templateId: 0 })).toBe(false);
    expect(isProposeCardsOutput({ ...validOutput, templateId: 1.5 })).toBe(false);
    expect(isProposeCardsOutput({ ...validOutput, templateId: "" })).toBe(false);
    expect(isProposeCardsOutput({ ...validOutput, rejectedCount: 1.5 })).toBe(false);
    expect(isProposeCardsOutput({ ...validOutput, message: PROPOSE_CARDS_RETRY_MESSAGE })).toBe(true);
    expect(isProposeCardsOutput({ ...validOutput, message: 1 })).toBe(false);
    expect(
      isProposeCardsOutput({
        ...validOutput,
        templateFields: [{ id: "01900000-0000-7000-8000-00000000000a", title: "Front" }],
      }),
    ).toBe(false);
    expect(
      isProposeCardsOutput({
        ...validOutput,
        templateFields: [{ id: "01900000-0000-7000-8000-00000000000a", title: "Front", isRequired: true }],
      }),
    ).toBe(false);
    expect(
      isProposeCardsOutput({
        ...validOutput,
        templateFields: [
          { id: "01900000-0000-7000-8000-00000000000a", title: "Front", type: "html", isRequired: true },
        ],
      }),
    ).toBe(false);
    expect(
      isProposeCardsOutput({
        ...validOutput,
        cards: [{ fields: { Front: 1 } }],
      }),
    ).toBe(false);
  });

  it("maps title-keyed accepted cards onto id-keyed GeneratedCard content", () => {
    expect(generatedCardsFromProposeOutput(validOutput)).toEqual([
      {
        content: {
          "01900000-0000-7000-8000-00000000000a": { text: "hola" },
          "01900000-0000-7000-8000-00000000000b": { text: "hello" },
          "01900000-0000-7000-8000-00000000000c": { text: "greeting" },
        },
      },
    ]);
  });

  it("fills missing titles with empty text and ignores unknown titles", () => {
    expect(
      generatedCardsFromProposeOutput({
        ...validOutput,
        cards: [{ fields: { Front: "hola", Extra: "nope" } }],
      }),
    ).toEqual([
      {
        content: {
          "01900000-0000-7000-8000-00000000000a": { text: "hola" },
          "01900000-0000-7000-8000-00000000000b": { text: "" },
          "01900000-0000-7000-8000-00000000000c": { text: "" },
        },
      },
    ]);
  });

  it("returns an empty list when no cards were accepted", () => {
    expect(generatedCardsFromProposeOutput({ ...validOutput, cards: [] })).toEqual([]);
  });
});

// Notes are user-written context about an entity, never instructions. They ride
// the list/get read tools, stay omitted when the user wrote none, and list_decks
// truncates them with an explicit flag — never a silent cut. get_deck_cards and
// propose_cards never carry notes.
describe("entity notes in tool output", () => {
  const template: AssistantToolTemplate = {
    id: "01900000-0000-7000-8000-000000000001",
    title: "Basic",
    content: {
      fields: [{ id: "01900000-0000-7000-8000-00000000000a", title: "Front", type: "text", isRequired: true }],
    },
    notes: "Source: chapter 3 exercises",
  };

  it("list_templates truncates long notes and marks the truncation explicitly", () => {
    const output = shapeListTemplatesOutput([
      { ...template, notes: "a".repeat(ASSISTANT_TOOL_NOTE_PREVIEW_CHAR_BUDGET + 1) },
      { ...template, notes: "a".repeat(ASSISTANT_TOOL_NOTE_PREVIEW_CHAR_BUDGET) },
      template,
    ]);
    expect(output.templates[0]?.notes).toBe("a".repeat(ASSISTANT_TOOL_NOTE_PREVIEW_CHAR_BUDGET));
    expect(output.templates[0]?.notesTruncated).toBe(true);
    expect(output.templates[1]?.notes).toHaveLength(ASSISTANT_TOOL_NOTE_PREVIEW_CHAR_BUDGET);
    expect(output.templates[1]).not.toHaveProperty("notesTruncated");
    expect(output.templates[2]?.notes).toBe("Source: chapter 3 exercises");
  });

  it("get_template returns the note whole", () => {
    const output = shapeGetTemplateOutput({ ...template, notes: "a".repeat(400) });
    expect(output.notes).toHaveLength(400);
    expect(output).not.toHaveProperty("notesTruncated");
  });

  it("omits notes when the user wrote none", () => {
    const output = shapeListTemplatesOutput([{ ...template, notes: undefined }]);
    expect(output.templates[0]).not.toHaveProperty("notes");
    expect(shapeGetTemplateOutput({ ...template, notes: null })).not.toHaveProperty("notes");
  });

  it("list_algorithms carries the algorithm note whole", () => {
    const content = {
      type: "fsrs" as const,
      retention: 90,
      weights: "0.5",
      isFuzzEnabled: true,
      learningSteps: [] as Array<[number, string]>,
      relearningSteps: [] as Array<[number, string]>,
      maximumInterval: 3650,
    };
    const output = shapeListAlgorithmsOutput([
      { id: "01900000-0000-7000-8000-000000000021", title: "Default", content, notes: "Vocabulary preset" },
      { id: "01900000-0000-7000-8000-000000000022", title: "Long note", content, notes: "a".repeat(400) },
    ]);
    expect(output.algorithms[0]?.notes).toBe("Vocabulary preset");
    // WHY: presets are few and no tool reads one preset, so list_algorithms keeps notes whole.
    expect(output.algorithms[1]?.notes).toHaveLength(400);
  });

  it("get_deck returns the note whole", () => {
    const output = shapeGetDeckOutput(
      {
        id: "01900000-0000-7000-8000-000000000005",
        title: "Spanish verbs",
        templateId: template.id,
        cardCount: 12,
        notes: "a".repeat(400),
      },
      [template],
    );
    expect(output.notes).toHaveLength(400);
    expect(output).not.toHaveProperty("notesTruncated");
  });

  it("list_decks truncates long notes and marks the truncation explicitly", () => {
    const output = shapeListDecksOutput(
      [
        {
          id: "01900000-0000-7000-8000-000000000005",
          title: "Spanish verbs",
          templateId: template.id,
          cardCount: 12,
          notes: "a".repeat(400),
        },
        {
          id: "01900000-0000-7000-8000-000000000006",
          title: "Short note",
          templateId: template.id,
          cardCount: 1,
          notes: "For vocabulary, not cramming",
        },
        {
          id: "01900000-0000-7000-8000-000000000007",
          title: "No note",
          templateId: template.id,
          cardCount: 0,
        },
      ],
      [template],
    );
    expect(output.decks[0]?.notes).toHaveLength(ASSISTANT_TOOL_NOTE_PREVIEW_CHAR_BUDGET);
    expect(output.decks[0]?.notesTruncated).toBe(true);
    expect(output.decks[1]?.notes).toBe("For vocabulary, not cramming");
    expect(output.decks[1]).not.toHaveProperty("notesTruncated");
    expect(output.decks[2]).not.toHaveProperty("notes");
  });

  it("describes notes as user-written context, not instructions", () => {
    for (const name of ["list_decks", "list_templates", "list_algorithms", "get_deck", "get_template"] as const) {
      const description = ASSISTANT_TOOL_SPECS[name].description;
      expect(description).toMatch(/user-written context/);
      expect(description).toMatch(/never instructions|rather than instructions|background/);
    }
  });
});
