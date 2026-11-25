import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TestDb } from "../test/test-helpers";
import { createTestDb } from "../test/test-helpers";
import { deleteConversation, getConversation, getConversations, setConversation } from "./conversations";

describe("conversations repository integration", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await testDb.close();
  });

  it("round-trips a conversation's state and title through save, get, and list", async () => {
    const { db } = testDb;
    const createdAt = new Date(1700000000000);
    const startedAt = new Date(1700000005000);
    const state = {
      id: "conv-1",
      createdAt,
      messages: [{ id: "msg-1", role: "user", parts: [{ type: "text", text: "hello" }] }],
      runs: { "run-1": { id: "run-1", status: "success", startedAt } },
      activeRunId: null,
    };
    // WHY: state is stored as JSON text, so nested Dates come back as ISO strings.
    const storedState = {
      ...state,
      createdAt: createdAt.toISOString(),
      runs: { "run-1": { ...state.runs["run-1"], startedAt: startedAt.toISOString() } },
    };

    const saved = await setConversation(db, { id: "conv-1", state, title: "My title" });
    await setConversation(db, { id: "conv-untitled", state: { ...state, id: "conv-untitled" } });
    const loaded = await getConversation(db, "conv-1");
    const untitled = await getConversation(db, "conv-untitled");
    const list = await getConversations(db);

    expect(saved).toEqual(loaded);
    expect(loaded).toMatchObject({ id: "conv-1", title: "My title", state: storedState });
    expect(loaded!.createdAt).toBeInstanceOf(Date);
    expect(untitled!.title).toBeNull();
    expect(Object.fromEntries(list.map((item) => [item.id, item.title]))).toEqual({
      "conv-1": "My title",
      "conv-untitled": null,
    });
  });

  it("overwrites state and title on conflict", async () => {
    const { db } = testDb;
    const state = { id: "conv-1", createdAt: new Date(1700000000000), messages: [], runs: {}, activeRunId: null };
    const nextState = {
      ...state,
      messages: [{ id: "msg-1", role: "user", parts: [{ type: "text", text: "hi" }] }],
    };

    await setConversation(db, { id: "conv-1", state, title: "Old title" });
    await setConversation(db, { id: "conv-1", state: nextState, title: "New title" });
    const loaded = await getConversation(db, "conv-1");

    expect(loaded).toMatchObject({
      title: "New title",
      state: { ...nextState, createdAt: state.createdAt.toISOString() },
    });
  });

  it("preserves the provided updatedAt on subsequent saves", async () => {
    const { db } = testDb;
    const id = "conv-pinned";
    const state = {
      id,
      createdAt: new Date(1700000000000),
      messages: [],
      runs: {},
      activeRunId: null,
      deckId: null,
    };
    const pinned = new Date(1650000000000);

    await setConversation(db, { id, state, updatedAt: pinned });
    const reloaded = await getConversation(db, id);
    expect(reloaded!.updatedAt).toEqual(pinned);

    // A follow-up save that explicitly passes the same timestamp must not
    // advance it. This guards against model/profile/parameter changes silently
    // bumping the sidebar order.
    const after = await setConversation(db, { id, state, updatedAt: pinned });
    expect(after.updatedAt).toEqual(pinned);
  });

  it("stamps the save time as updatedAt when updatedAt is omitted", async () => {
    const { db } = testDb;
    const id = "conv-default";
    const state = {
      id,
      createdAt: new Date(1700000000000),
      messages: [],
      runs: {},
      activeRunId: null,
      deckId: null,
    };
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(1_750_000_000_000);

    const saved = await setConversation(db, { id, state });

    expect(saved.updatedAt).toEqual(new Date(1_750_000_000_000));
  });

  it("keeps the first save's createdAt when a later save conflicts", async () => {
    const { db } = testDb;
    const state = {
      id: "conv-created",
      createdAt: new Date(1700000000000),
      messages: [],
      runs: {},
      activeRunId: null,
      deckId: null,
    };
    vi.useFakeTimers({ toFake: ["Date"] });

    vi.setSystemTime(1_000);
    await setConversation(db, { id: "conv-created", state });
    vi.setSystemTime(2_000);
    const updated = await setConversation(db, { id: "conv-created", state });

    expect(updated.createdAt).toEqual(new Date(1_000));
    expect(updated.updatedAt).toEqual(new Date(2_000));
  });

  // WHY: the hasTurns and isUnread rules are tested in @koloda/app; this proves the repo maps list rows through them.
  it("lists items derived from stored state, without the state column", async () => {
    const { db } = testDb;
    const createdAt = new Date(1700000000000);
    await setConversation(db, {
      id: "draft",
      title: null,
      state: { id: "draft", createdAt, messages: [], runs: {}, activeRunId: null, promptInput: "soon" },
    });
    await setConversation(db, {
      id: "with-turn",
      title: "hello",
      state: {
        id: "with-turn",
        createdAt,
        messages: [{ id: "msg-1", role: "user", parts: [{ type: "text", text: "hello" }] }],
        runs: { r1: { id: "r1", status: "success" } },
        activeRunId: null,
      },
    });

    const list = await getConversations(db);
    const byId = Object.fromEntries(list.map((item) => [item.id, item]));

    expect(byId.draft).toMatchObject({ hasTurns: false, isUnread: false });
    expect(byId["with-turn"]).toMatchObject({ hasTurns: true, isUnread: true });
    // INVARIANT: the list projection must not ship `state`.
    expect(list.some((item) => "state" in item)).toBe(false);
  });

  it("deletes a conversation", async () => {
    const { db } = testDb;
    const state = { id: "conv-1", createdAt: new Date(1700000000000), messages: [], runs: {}, activeRunId: null };
    await setConversation(db, { id: "conv-1", state });
    await setConversation(db, { id: "conv-2", state: { ...state, id: "conv-2" } });

    await deleteConversation(db, { id: "conv-1" });

    expect(await getConversation(db, "conv-1")).toBeNull();
    expect((await getConversations(db)).map((item) => item.id)).toEqual(["conv-2"]);
  });
});
