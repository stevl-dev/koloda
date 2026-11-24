import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AIToolActivity } from "./ai-tool-activity";
import type { AIToolCallRecord } from "./ai-tool-activity";

const plural = vi.hoisted(() => vi.fn((_count: number, forms: { other: string }) => forms.other));

vi.mock("@lingui/core/macro", async (importOriginal) => ({
  ...(await importOriginal()),
  plural,
}));

vi.mock("@lingui/react", () => ({
  useLingui: () => ({
    _: (message: { toString(): string }) => message.toString(),
  }),
}));

function call(
  overrides: Partial<AIToolCallRecord> & Pick<AIToolCallRecord, "id" | "name" | "status">,
): AIToolCallRecord {
  return {
    input: {},
    ...overrides,
  };
}

function activityDots(trigger: HTMLElement) {
  return [...trigger.querySelectorAll('[aria-hidden="true"]')].filter((el) => el.textContent === "·");
}

describe("AIToolActivity", () => {
  it.each([
    {
      name: "list_decks",
      label: "ai.chat.tool-activity.list-decks",
      output: { decks: [{ deckId: 1 }, { deckId: 2 }, { deckId: 3 }] },
      countLabel: "ai.chat.tool-activity.decks",
      count: 3,
    },
    {
      name: "list_templates",
      label: "ai.chat.tool-activity.list-templates",
      output: { templates: [{ templateId: 1 }, { templateId: 2 }] },
      countLabel: "ai.chat.tool-activity.templates",
      count: 2,
    },
    {
      name: "list_algorithms",
      label: "ai.chat.tool-activity.list-algorithms",
      output: { algorithms: [{ algorithmId: 1 }, { algorithmId: 2 }] },
      countLabel: "ai.chat.tool-activity.algorithms",
      count: 2,
    },
    {
      name: "list_decks",
      label: "ai.chat.tool-activity.list-decks",
      output: { isTruncated: true, itemCount: 14, preview: '{"decks":[' },
      countLabel: "ai.chat.tool-activity.decks",
      count: 14,
    },
    {
      name: "list_templates",
      label: "ai.chat.tool-activity.list-templates",
      output: { isTruncated: true, itemCount: 9, preview: '{"templates":[' },
      countLabel: "ai.chat.tool-activity.templates",
      count: 9,
    },
    {
      name: "list_algorithms",
      label: "ai.chat.tool-activity.list-algorithms",
      output: { isTruncated: true, itemCount: 6, preview: '{"algorithms":[' },
      countLabel: "ai.chat.tool-activity.algorithms",
      count: 6,
    },
  ])(
    "renders a $name success row from the list length (count $count)",
    ({ name, label, output, countLabel, count }) => {
      plural.mockClear();
      render(<AIToolActivity calls={[call({ id: "c1", name, status: "success", output })]} />);

      expect(screen.getByText(label)).toBeTruthy();
      expect(plural.mock.calls).toEqual([[count, { other: countLabel }]]);
      expect(screen.getByText(countLabel)).toBeTruthy();
      expect(activityDots(screen.getByRole("button", { name: new RegExp(label.replaceAll(".", "\\.")) }))).toHaveLength(
        1,
      );
      expect(screen.queryByLabelText("ai.chat.tool-activity.running")).toBeNull();
      expect(screen.queryByLabelText("ai.chat.tool-activity.failed")).toBeNull();
    },
  );

  it("renders an add_deck success row with the deck title", () => {
    render(
      <AIToolActivity
        calls={[
          call({
            id: "c1",
            name: "add_deck",
            status: "success",
            input: { title: "Spanish", templateId: "01900000-0000-7000-8000-000000000005" },
            output: {
              deckId: "01900000-0000-7000-8000-000000000099",
              title: "Spanish",
              templateId: "01900000-0000-7000-8000-000000000005",
              templateTitle: "Basic",
              fieldTitles: ["Front", "Back"],
              algorithmId: "01900000-0000-7000-8000-000000000031",
            },
          }),
        ]}
      />,
    );

    expect(screen.getByText("ai.chat.tool-activity.add-deck")).toBeTruthy();
    expect(screen.getByText("Spanish")).toBeTruthy();
    expect(activityDots(screen.getByRole("button", { name: /ai\.chat\.tool-activity\.add-deck/ }))).toHaveLength(1);
    expect(screen.queryByLabelText("ai.chat.tool-activity.failed")).toBeNull();
  });

  it.each([
    {
      name: "get_deck",
      label: "ai.chat.tool-activity.get-deck",
      input: { deckId: "01900000-0000-7000-8000-000000000001" },
      output: {
        deckId: "01900000-0000-7000-8000-000000000001",
        title: "Spanish",
        cardCount: 3,
        templateTitle: "Basic",
        fieldTitles: ["Front", "Back"],
      },
      title: "Spanish",
    },
    {
      name: "get_template",
      label: "ai.chat.tool-activity.get-template",
      input: { templateId: "01900000-0000-7000-8000-000000000005" },
      output: {
        templateId: "01900000-0000-7000-8000-000000000005",
        title: "Basic",
        fields: [
          { id: "a", title: "Front", type: "text", isRequired: true },
          { id: "b", title: "Back", type: "text", isRequired: true },
        ],
      },
      title: "Basic",
    },
    {
      name: "read_help_topic",
      label: "ai.chat.tool-activity.read-help-topic",
      input: { topic: "lessons", section: "Grading" },
      output: { title: "Lessons", section: "Grading", markdown: "## Grading\n" },
      title: "Lessons",
    },
    {
      name: "read_help_topic",
      label: "ai.chat.tool-activity.read-help-topic",
      input: { topic: "lessons" },
      output: { isTruncated: true, itemCount: 2, title: "Lessons", preview: '{"title":"Lessons",' },
      title: "Lessons",
    },
  ])("renders a $name success row with the title", ({ name, label, input, output, title }) => {
    render(<AIToolActivity calls={[call({ id: "c1", name, status: "success", input, output })]} />);

    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByText(title)).toBeTruthy();
    expect(activityDots(screen.getByRole("button", { name: new RegExp(label.replaceAll(".", "\\.")) }))).toHaveLength(
      1,
    );
    expect(screen.queryByLabelText("ai.chat.tool-activity.running")).toBeNull();
    expect(screen.queryByLabelText("ai.chat.tool-activity.failed")).toBeNull();
  });

  it.each([
    { input: { section: "learning" }, summary: "ai.chat.tool-activity.settings-section.learning" },
    { input: { section: "ai" }, summary: "ai.chat.tool-activity.settings-section.ai" },
    { input: {}, summary: null },
  ])("renders a get_settings success row naming the asked section ($summary)", ({ input, summary }) => {
    render(
      <AIToolActivity
        calls={[call({ id: "c1", name: "get_settings", status: "success", input, output: { isTruncated: true } })]}
      />,
    );

    const trigger = screen.getByRole("button", { name: /ai\.chat\.tool-activity\.get-settings/ });
    expect(activityDots(trigger)).toHaveLength(summary === null ? 0 : 1);
    expect(screen.queryByText(/ai\.chat\.tool-activity\.settings-section\./)?.textContent ?? null).toBe(summary);
  });

  it.each([
    {
      input: { deckId: "01900000-0000-7000-8000-000000000001" },
      output: { deck: { title: "Spanish" } },
      summary: "Spanish",
    },
    { input: {}, output: { decks: [{ title: "Spanish" }] }, summary: null },
  ])("renders a get_lessons_today success row naming the asked deck ($summary)", ({ input, output, summary }) => {
    render(
      <AIToolActivity calls={[call({ id: "c1", name: "get_lessons_today", status: "success", input, output })]} />,
    );

    const trigger = screen.getByRole("button", { name: /ai\.chat\.tool-activity\.get-lessons-today/ });
    expect(activityDots(trigger)).toHaveLength(summary === null ? 0 : 1);
    expect(screen.queryByText("Spanish")?.textContent ?? null).toBe(summary);
  });

  it.each([
    {
      scenario: "full output",
      output: { totalCards: 40, cards: [{ fields: {} }, { fields: {} }], acceptedCount: 9 },
      count: 2,
    },
    { scenario: "card cap", output: { isTruncated: true, totalCards: 300, acceptedCount: 200 }, count: 200 },
    { scenario: "character budget", output: { isTruncated: true, totalCards: 40, acceptedCount: 2 }, count: 2 },
    { scenario: "empty result", output: { isTruncated: true, totalCards: 40, acceptedCount: 0 }, count: 0 },
    { scenario: "unknown returned count", output: { isTruncated: true, totalCards: 40 }, count: null },
  ])("uses the returned card count for $scenario", ({ output, count }) => {
    plural.mockClear();
    render(
      <AIToolActivity
        calls={[
          call({
            id: "c1",
            name: "get_deck_cards",
            status: "success",
            input: { deckId: 9 },
            output,
          }),
        ]}
      />,
    );

    expect(screen.getByText("ai.chat.tool-activity.get-deck-cards")).toBeTruthy();
    const expectedCalls = count === null ? [] : [[count, { other: "ai.chat.tool-activity.cards" }]];
    expect(plural.mock.calls).toEqual(expectedCalls);
    expect(screen.queryByText("ai.chat.tool-activity.cards") !== null).toBe(count !== null);
  });

  it.each([
    {
      scenario: "the cards array length",
      output: { cards: [{ fields: {} }, { fields: {} }, { fields: {} }] },
      pluralCalls: [[3, { other: "ai.chat.tool-activity.cards" }]],
      showsSkipped: false,
      dots: 1,
    },
    {
      scenario: "dropped cards",
      output: { cards: [{ fields: {} }, { fields: {} }, { fields: {} }], rejectedCount: 2 },
      pluralCalls: [
        [3, { other: "ai.chat.tool-activity.cards" }],
        [2, { other: "ai.chat.tool-activity.skipped" }],
      ],
      showsSkipped: true,
      dots: 2,
    },
    {
      scenario: "rejectedCount zero",
      output: { cards: [{ fields: {} }], rejectedCount: 0 },
      pluralCalls: [[1, { other: "ai.chat.tool-activity.cards" }]],
      showsSkipped: false,
      dots: 1,
    },
    {
      scenario: "a truncated output",
      output: { isTruncated: true, itemCount: 7, acceptedCount: 8, rejectedCount: 2, preview: '{"cards":[' },
      pluralCalls: [
        [8, { other: "ai.chat.tool-activity.cards" }],
        [2, { other: "ai.chat.tool-activity.skipped" }],
      ],
      showsSkipped: true,
      dots: 2,
    },
  ])("renders propose_cards counts for $scenario", ({ output, pluralCalls, showsSkipped, dots }) => {
    plural.mockClear();
    render(
      <AIToolActivity
        calls={[
          call({
            id: "c1",
            name: "propose_cards",
            status: "success",
            input: { deckId: 5, cards: [] },
            output,
          }),
        ]}
      />,
    );

    const trigger = screen.getByRole("button", { name: /ai\.chat\.tool-activity\.propose-cards/ });
    expect(screen.getByText("ai.chat.tool-activity.propose-cards")).toBeTruthy();
    expect(screen.getByText("ai.chat.tool-activity.cards")).toBeTruthy();
    expect(plural.mock.calls).toEqual(pluralCalls);
    expect(screen.queryByText("ai.chat.tool-activity.skipped") !== null).toBe(showsSkipped);
    expect(activityDots(trigger)).toHaveLength(dots);
  });

  it("labels the thinking icon as running once, hiding its highlight copy, until thinking ends", () => {
    const { rerender } = render(
      <AIToolActivity calls={[{ kind: "reasoning", id: "r1", text: "Quiet plan.", status: "running" }]} />,
    );

    const runningIcon = screen.getByLabelText("ai.chat.tool-activity.running");
    expect(runningIcon.nextElementSibling?.getAttribute("aria-hidden")).toBe("true");

    rerender(<AIToolActivity calls={[{ kind: "reasoning", id: "r1", text: "Quiet plan.", status: "done" }]} />);

    expect(screen.queryByLabelText("ai.chat.tool-activity.running")).toBeNull();
    expect(screen.getByText("ai.chat.tool-activity.thought")).toBeTruthy();
  });

  it("labels a running tool row's icon once, hiding its highlight copy", () => {
    render(<AIToolActivity calls={[call({ id: "c1", name: "get_deck_cards", status: "running", input: {} })]} />);

    const runningIcon = screen.getByLabelText("ai.chat.tool-activity.running");
    expect(runningIcon.nextElementSibling?.getAttribute("aria-hidden")).toBe("true");
  });

  it.each([
    {
      name: "add_deck",
      label: "ai.chat.tool-activity.add-deck",
      input: { title: "Spanish", templateId: "01900000-0000-7000-8000-000000000194" },
      error: "Template not found: 01900000-0000-7000-8000-000000000194",
    },
    {
      name: "list_decks",
      label: "ai.chat.tool-activity.list-decks",
      input: {},
      error: { message: "boom" },
    },
  ])("marks a failed $name row", ({ name, label, input, error }) => {
    render(<AIToolActivity calls={[call({ id: "c1", name, status: "error", input, error })]} />);

    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByLabelText("ai.chat.tool-activity.failed")).toBeTruthy();
    expect(screen.getByText("ai.chat.tool-activity.failed")).toBeTruthy();
  });

  it("marks a canceled row canceled, not failed", () => {
    render(
      <AIToolActivity
        calls={[call({ id: "c1", name: "add_deck", status: "canceled", input: { title: "Spanish" } })]}
      />,
    );

    expect(screen.getByText("ai.chat.tool-activity.add-deck")).toBeTruthy();
    expect(screen.getByText("ai.chat.tool-activity.canceled")).toBeTruthy();
    expect(screen.queryByLabelText("ai.chat.tool-activity.failed")).toBeNull();
    expect(screen.queryByLabelText("ai.chat.tool-activity.running")).toBeNull();
  });

  it("renders an unknown tool by protocol id", () => {
    render(
      <AIToolActivity calls={[call({ id: "c1", name: "search_cards", status: "success", input: { q: "hola" } })]} />,
    );

    expect(screen.getAllByText("search_cards").length).toBeGreaterThan(0);
    expect(screen.queryByText("ai.chat.tool-activity.list-decks")).toBeNull();
  });

  it("expands input and output below the row and collapses on a second press", () => {
    render(
      <AIToolActivity
        calls={[
          call({
            id: "c1",
            name: "get_deck_cards",
            status: "success",
            input: { deckId: 9 },
            output: { cards: [] },
          }),
        ]}
      />,
    );

    const trigger = screen.getByRole("button", { name: /ai\.chat\.tool-activity\.get-deck-cards/ });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("ai.chat.tool-activity.input")).toBeNull();

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("ai.chat.tool-activity.tool")).toBeTruthy();
    expect(screen.getByText("get_deck_cards")).toBeTruthy();
    expect(screen.getByText("ai.chat.tool-activity.input")).toBeTruthy();
    expect(screen.getByText("ai.chat.tool-activity.output")).toBeTruthy();
    expect(screen.getByText(/"deckId": 9/)).toBeTruthy();

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("ai.chat.tool-activity.input")).toBeNull();
  });

  it("expands a truncated input as the preview, not the wrapper object", () => {
    render(
      <AIToolActivity
        calls={[
          call({
            id: "c1",
            name: "propose_cards",
            status: "running",
            input: { isTruncated: true, itemCount: 2, preview: '{"deckId":1,"cards":[{' },
          }),
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /ai\.chat\.tool-activity\.propose-cards/ }));
    expect(screen.getByText("ai.chat.tool-activity.input-truncated")).toBeTruthy();
    expect(screen.getByText('{"deckId":1,"cards":[{')).toBeTruthy();
    expect(screen.queryByText(/isTruncated/)).toBeNull();
  });

  it("labels a truncated output as truncated and shows its preview", () => {
    render(
      <AIToolActivity
        calls={[
          call({
            id: "c1",
            name: "get_deck_cards",
            status: "success",
            input: { deckId: 9 },
            output: { isTruncated: true, itemCount: 40, preview: '{"cards":[{' },
          }),
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /ai\.chat\.tool-activity\.get-deck-cards/ }));
    expect(screen.getByText("ai.chat.tool-activity.output-truncated")).toBeTruthy();
    expect(screen.getByText('{"cards":[{')).toBeTruthy();
  });

  it("shows an output that cannot be serialized as plain text instead of failing the row", () => {
    const cyclic: Record<string, unknown> = { name: "cycle" };
    cyclic.self = cyclic;
    render(
      <AIToolActivity
        calls={[call({ id: "c1", name: "get_deck_cards", status: "success", input: { deckId: 9 }, output: cyclic })]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /ai\.chat\.tool-activity\.get-deck-cards/ }));
    expect(screen.getByText("ai.chat.tool-activity.output")).toBeTruthy();
    expect(screen.getByText("[object Object]")).toBeTruthy();
  });

  describe("activity elapsed time", () => {
    const startedAt = new Date("2026-07-01T12:00:00.000Z");

    afterEach(() => {
      vi.useRealTimers();
    });

    it("shows a live timer after a dot while a row is running", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-01T12:00:30.000Z"));

      render(
        <AIToolActivity
          calls={[
            {
              kind: "reasoning",
              id: "r1",
              text: "Quiet plan.",
              status: "running",
              startedAt,
              elapsedSeconds: null,
            },
            call({
              id: "c1",
              name: "list_decks",
              status: "running",
              startedAt,
              elapsedSeconds: null,
            }),
          ]}
        />,
      );

      const reasoningTrigger = screen.getByRole("button", { name: /ai\.chat\.tool-activity\.thinking/ });
      const toolTrigger = screen.getByRole("button", { name: /ai\.chat\.tool-activity\.list-decks/ });
      expect(activityDots(reasoningTrigger)).toHaveLength(1);
      expect(activityDots(toolTrigger)).toHaveLength(1);
      expect(reasoningTrigger.textContent).toContain("30");
      expect(toolTrigger.textContent).toContain("30");
    });

    it("shows a frozen elapsed time after a dot when a row is done", () => {
      render(
        <AIToolActivity
          calls={[
            {
              kind: "reasoning",
              id: "r1",
              text: "Quiet plan.",
              status: "done",
              startedAt,
              elapsedSeconds: 4,
            },
            call({
              id: "c1",
              name: "list_decks",
              status: "success",
              output: { decks: [] },
              startedAt,
              elapsedSeconds: 5,
            }),
          ]}
        />,
      );

      const reasoningTrigger = screen.getByRole("button", { name: /ai\.chat\.tool-activity\.thought/ });
      const toolTrigger = screen.getByRole("button", { name: /ai\.chat\.tool-activity\.list-decks/ });
      expect(activityDots(reasoningTrigger)).toHaveLength(1);
      expect(activityDots(toolTrigger)).toHaveLength(2);
      expect(reasoningTrigger.textContent).toMatch(/4/);
      expect(toolTrigger.textContent).toMatch(/5/);
    });

    it("hides the timer and separator when timestamps are missing", () => {
      render(
        <AIToolActivity
          calls={[
            { kind: "reasoning", id: "r1", text: "Quiet plan.", status: "done" },
            call({ id: "c1", name: "search_cards", status: "success", input: { q: "hola" } }),
          ]}
        />,
      );

      const reasoningTrigger = screen.getByRole("button", { name: /ai\.chat\.tool-activity\.thought/ });
      const toolTrigger = screen.getByRole("button", { name: /search_cards/ });
      expect(activityDots(reasoningTrigger)).toHaveLength(0);
      expect(activityDots(toolTrigger)).toHaveLength(0);
    });

    it("hides a frozen elapsed time under one second", () => {
      render(
        <AIToolActivity
          calls={[
            {
              kind: "reasoning",
              id: "r1",
              text: "Quiet plan.",
              status: "done",
              startedAt,
              elapsedSeconds: 0,
            },
            call({
              id: "c1",
              name: "list_decks",
              status: "success",
              output: { decks: [] },
              startedAt,
              elapsedSeconds: 0,
            }),
          ]}
        />,
      );

      const reasoningTrigger = screen.getByRole("button", { name: /ai\.chat\.tool-activity\.thought/ });
      const toolTrigger = screen.getByRole("button", { name: /ai\.chat\.tool-activity\.list-decks/ });
      expect(activityDots(reasoningTrigger)).toHaveLength(0);
      expect(activityDots(toolTrigger)).toHaveLength(1);
      expect(screen.queryByText("ai.chat.elapsed-time.periods.seconds")).toBeNull();
    });

    it("waits until one second has elapsed before showing a live timer", () => {
      vi.useFakeTimers();
      vi.setSystemTime(startedAt);

      render(
        <AIToolActivity
          calls={[
            {
              kind: "reasoning",
              id: "r1",
              text: "Quiet plan.",
              status: "running",
              startedAt,
              elapsedSeconds: null,
            },
            call({
              id: "c1",
              name: "search_cards",
              status: "running",
              startedAt,
              elapsedSeconds: null,
            }),
          ]}
        />,
      );

      const reasoningTrigger = screen.getByRole("button", { name: /ai\.chat\.tool-activity\.thinking/ });
      const toolTrigger = screen.getByRole("button", { name: /search_cards/ });
      expect(activityDots(reasoningTrigger)).toHaveLength(0);
      expect(activityDots(toolTrigger)).toHaveLength(0);
      expect(screen.queryByText("ai.chat.elapsed-time.periods.seconds")).toBeNull();

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(activityDots(reasoningTrigger)).toHaveLength(1);
      expect(activityDots(toolTrigger)).toHaveLength(1);
      expect(screen.getAllByText("ai.chat.elapsed-time.periods.seconds")).toHaveLength(2);
    });
  });

  it("keeps thinking collapsed while running and after it finishes", () => {
    const { rerender } = render(
      <AIToolActivity calls={[{ kind: "reasoning", id: "r1", text: "Quiet plan.", status: "running" }]} />,
    );

    const thinkingTrigger = screen.getByRole("button", { name: /ai\.chat\.tool-activity\.thinking/ });
    expect(thinkingTrigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("ai.chat.tool-activity.thinking")).toBeTruthy();
    expect(screen.getByLabelText("ai.chat.tool-activity.running")).toBeTruthy();
    expect(screen.queryByText("Quiet plan.")).toBeNull();

    fireEvent.click(thinkingTrigger);
    expect(thinkingTrigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Quiet plan.")).toBeTruthy();

    rerender(<AIToolActivity calls={[{ kind: "reasoning", id: "r1", text: "Quiet plan.", status: "done" }]} />);

    const thoughtTrigger = screen.getByRole("button", { name: /ai\.chat\.tool-activity\.thought/ });
    expect(thoughtTrigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Quiet plan.")).toBeTruthy();

    fireEvent.click(thoughtTrigger);
    expect(thoughtTrigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Quiet plan.")).toBeNull();
  });

  it("uses renderText for reasoning when provided", () => {
    render(
      <AIToolActivity
        renderText={(text) => <div data-testid="custom-reasoning">{text}</div>}
        calls={[{ kind: "reasoning", id: "r1", text: "**plan**", status: "running" }]}
      />,
    );

    expect(screen.queryByTestId("custom-reasoning")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /ai\.chat\.tool-activity\.thinking/ }));
    expect(screen.getByTestId("custom-reasoning").textContent).toBe("**plan**");
  });

  it("renders nothing when there are no calls", () => {
    const { container } = render(<AIToolActivity calls={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
