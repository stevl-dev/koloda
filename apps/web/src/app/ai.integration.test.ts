import { applyPendingMigrations, getSettings, openDb, patchSettings, setSettings } from "@koloda/db-sqlite";
import type { DB } from "@koloda/db-sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addAIProfile, removeAIProfile, updateAIProfile } from "./ai";

const ASSISTANT = { temperature: 0.7, chatPromptTemplate: "mine", chatPromptMode: "custom" } as const;
const PATCHED_ASSISTANT = { ...ASSISTANT, temperature: 0.2 };

// WHY: a second door to `ai.test.ts`: the overlap needs the real per-statement lock, which the Map store lacks.
describe("web AI profile writes on a real database", () => {
  let db: DB;

  beforeEach(async () => {
    db = await openDb({ idbName: `koloda-web-ai-${crypto.randomUUID()}` });
    await applyPendingMigrations(db);
  });

  afterEach(async () => {
    await db.close();
  });

  async function addProfile() {
    await addAIProfile(db, { title: "OR", secrets: { provider: "openrouter", apiKey: "sk-or" } });
    const stored = await getSettings<"ai">(db, "ai");
    return stored!.content.profiles[0]!.id;
  }

  const WRITES: Array<{ name: string; write: (profileId: string) => Promise<void> }> = [
    {
      name: "add",
      write: () => addAIProfile(db, { title: "OR 2", secrets: { provider: "openrouter", apiKey: "sk-or-2" } }),
    },
    { name: "update", write: (id) => updateAIProfile(db, { id, title: "Renamed" }) },
    { name: "remove", write: (id) => removeAIProfile(db, { id }) },
  ];

  it.each(WRITES)("keeps an assistant patch that overlaps a profile $name", async ({ write }) => {
    await setSettings<"ai">(db, { name: "ai", content: { profiles: [], assistant: ASSISTANT } });
    const profileId = await addProfile();

    // Both start before either is awaited, so their reads and writes queue on the lock together
    await Promise.all([write(profileId), patchSettings(db, { name: "ai", content: { assistant: PATCHED_ASSISTANT } })]);

    const stored = await getSettings<"ai">(db, "ai");
    expect(stored?.content.assistant).toEqual(PATCHED_ASSISTANT);
  });
});
