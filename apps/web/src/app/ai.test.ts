import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DB } from "@koloda/db-sqlite";
import { addAIProfile, getAIProfiles, removeAIProfile, updateAIProfile } from "./ai";

const { store } = vi.hoisted(() => ({ store: new Map<string, unknown>() }));

// WHY: The host adapter under test owns validation and merge order; the SQL layer
// has its own integration suite. A Map-backed store keeps those concerns separate.
vi.mock("@koloda/db-sqlite", () => ({
  getSettings: async (_db: unknown, name: string) => {
    const content = store.get(name);
    return content === undefined ? null : { name, content };
  },
  setSettings: async (_db: unknown, row: { name: string; content: unknown }) => {
    store.set(row.name, row.content);
    return row;
  },
}));

// WHY: the writes run in `db.transaction`; the Map store has no lock, so the transaction only passes the handle on.
// `ai.integration.test.ts` covers the locking on a real database.
const TEST_DB = { transaction: (fn: (tx: DB) => Promise<unknown>) => fn(TEST_DB) } as unknown as DB;

const PROFILE_ID = "01900000-0000-7000-8000-000000000001";
const CREATED_AT = "2026-01-01T00:00:00.000Z";

function seedAiSettings(profiles: unknown[]) {
  store.set("ai", { profiles });
}

function storedProfiles(): Array<Record<string, unknown>> {
  const content = store.get("ai") as { profiles: Array<Record<string, unknown>> };
  return content.profiles;
}

describe("web AI profile save path", () => {
  beforeEach(() => {
    store.clear();
  });

  it.each([
    { name: "blank", apiKey: "" },
    { name: "null", apiKey: null },
  ])("rejects a $name required apiKey on create and persists nothing", async ({ apiKey }) => {
    await expect(
      addAIProfile(TEST_DB, { title: "OpenRouter", secrets: { provider: "openrouter", apiKey } }),
    ).rejects.toMatchObject({ name: "AppError", code: "validation.settings-ai.providers.api-key" });
    expect(store.has("ai")).toBe(false);
  });

  it("persists a keyed profile with hasSecrets derived from the sent key", async () => {
    // WHY: Web keeps the usable key in the settings row (no keyring) and redacts
    // on public reads — assert the stored form, not the redacted public one.
    await addAIProfile(TEST_DB, { title: "OR", secrets: { provider: "openrouter", apiKey: "sk-or" } });
    expect(storedProfiles()).toHaveLength(1);
    expect(storedProfiles()[0]).toMatchObject({
      secrets: { provider: "openrouter", apiKey: "sk-or" },
      hasSecrets: true,
    });
  });

  it("stores an ollama profile created without an apiKey as keyless", async () => {
    await addAIProfile(TEST_DB, { secrets: { provider: "ollama", baseUrl: "http://localhost:11434" } });

    expect(storedProfiles()[0]).toMatchObject({ hasSecrets: false });
    expect(storedProfiles()[0]?.secrets).toEqual({ provider: "ollama", baseUrl: "http://localhost:11434" });
    expect((await getAIProfiles(TEST_DB))[0]?.hasSecrets).toBe(false);
  });

  it("rejects a blank apiKey on update and leaves the stored profile unchanged", async () => {
    seedAiSettings([
      {
        id: PROFILE_ID,
        title: "OpenRouter",
        secrets: { provider: "openrouter", apiKey: "sk-or" },
        hasSecrets: true,
        createdAt: CREATED_AT,
      },
    ]);

    await expect(
      updateAIProfile(TEST_DB, { id: PROFILE_ID, secrets: { provider: "openrouter", apiKey: "  " } }),
    ).rejects.toMatchObject({ code: "validation.settings-ai.providers.api-key" });

    expect(storedProfiles()[0]?.secrets).toEqual({ provider: "openrouter", apiKey: "sk-or" });
  });

  it("keeps the stored key when an ollama edit omits the apiKey", async () => {
    seedAiSettings([
      {
        id: PROFILE_ID,
        title: "Local",
        secrets: { provider: "ollama", baseUrl: "http://localhost:11434", apiKey: "local-key" },
        hasSecrets: true,
        createdAt: CREATED_AT,
      },
    ]);

    await updateAIProfile(TEST_DB, {
      id: PROFILE_ID,
      secrets: { provider: "ollama", baseUrl: "http://127.0.0.1:11434", apiKey: "" },
    });

    expect(storedProfiles()[0]?.secrets).toEqual({
      provider: "ollama",
      baseUrl: "http://127.0.0.1:11434",
      apiKey: "local-key",
    });
  });

  // Twin: openai_compatible_edit_keeps_removes_and_sets_headers (crates/koloda/tests/integration/ai_integration_tests.rs).
  it("keeps, removes, and sets OpenAI-compatible header values on edit", async () => {
    await addAIProfile(TEST_DB, {
      secrets: {
        provider: "openaiCompatible",
        baseUrl: "http://localhost:8000/v1",
        headers: { "X-Kept": "kept", "X-Dropped": "dropped" },
      },
    });
    const profileId = storedProfiles()[0]!.id as string;

    await updateAIProfile(TEST_DB, {
      id: profileId,
      secrets: {
        provider: "openaiCompatible",
        baseUrl: "http://localhost:8000/v1",
        headers: { "X-Kept": null, "X-Added": "added" },
      },
    });

    expect(storedProfiles()[0]?.secrets).toEqual({
      provider: "openaiCompatible",
      baseUrl: "http://localhost:8000/v1",
      headers: { "X-Kept": "kept", "X-Added": "added" },
    });
  });

  // Twin: openai_compatible_kept_header_without_stored_value_is_rejected_and_changes_nothing
  // (crates/koloda/tests/integration/ai_integration_tests.rs).
  it("rejects a kept header with no stored value and changes nothing", async () => {
    const secrets = (headers: Record<string, string | null>) => ({
      provider: "openaiCompatible" as const,
      baseUrl: "http://localhost:8000/v1",
      headers,
    });

    await expect(addAIProfile(TEST_DB, { secrets: secrets({ "X-Missing": null }) })).rejects.toMatchObject({
      code: "validation.settings-ai.providers.headers",
    });
    expect(store.has("ai")).toBe(false);

    await addAIProfile(TEST_DB, { secrets: secrets({ "X-Team": "team-1" }) });
    const profileId = storedProfiles()[0]!.id as string;
    await expect(
      updateAIProfile(TEST_DB, { id: profileId, secrets: secrets({ "X-Missing": null }) }),
    ).rejects.toMatchObject({ code: "validation.settings-ai.providers.headers" });
    expect(storedProfiles()[0]?.secrets).toEqual(secrets({ "X-Team": "team-1" }));
  });

  it("profile writes keep the assistant settings", async () => {
    // Twin: profile_writes_keep_the_assistant_settings (crates/koloda/tests/integration/ai_integration_tests.rs).
    const assistant = { temperature: 0.7, chatPromptTemplate: "mine", chatPromptMode: "custom" };
    store.set("ai", { profiles: [], assistant });
    const storedAssistant = () => (store.get("ai") as { assistant?: unknown }).assistant;

    await addAIProfile(TEST_DB, { title: "OR", secrets: { provider: "openrouter", apiKey: "sk-or" } });
    expect(storedAssistant()).toEqual(assistant);

    const profileId = storedProfiles()[0]!.id as string;
    await updateAIProfile(TEST_DB, { id: profileId, title: "Renamed" });
    expect(storedAssistant()).toEqual(assistant);

    await removeAIProfile(TEST_DB, { id: profileId });
    expect(storedAssistant()).toEqual(assistant);
  });

  it("rejects a provider change on update", async () => {
    // Twin: update_ai_profile_rejects_a_provider_change (crates/koloda/tests/integration/ai_integration_tests.rs).
    seedAiSettings([
      {
        id: PROFILE_ID,
        title: "OpenRouter",
        secrets: { provider: "openrouter", apiKey: "sk-or" },
        hasSecrets: true,
        createdAt: CREATED_AT,
      },
    ]);

    await expect(
      updateAIProfile(TEST_DB, {
        id: PROFILE_ID,
        title: "Local model",
        secrets: { provider: "ollama", baseUrl: "http://localhost:11434" },
      }),
    ).rejects.toMatchObject({ code: "validation.ai-providers.provider.changed" });

    expect(storedProfiles()[0]).toMatchObject({
      title: "OpenRouter",
      secrets: { provider: "openrouter", apiKey: "sk-or" },
    });
  });

  it("removes the title when an update sends an empty one", async () => {
    // Twin: update_ai_profile_removes_title_sent_empty (crates/koloda/tests/integration/ai_integration_tests.rs).
    seedAiSettings([
      {
        id: PROFILE_ID,
        title: "OpenRouter",
        secrets: { provider: "openrouter", apiKey: "sk-or" },
        hasSecrets: true,
        createdAt: CREATED_AT,
      },
    ]);

    await updateAIProfile(TEST_DB, { id: PROFILE_ID, title: "" });

    expect(storedProfiles()[0]?.title).toBeUndefined();
  });

  it("sets, preserves, and replaces the input model ids, and returns them on reads", async () => {
    // Twin: update_ai_profile_sets_preserves_and_replaces_input_model_ids
    // (crates/koloda/tests/integration/ai_integration_tests.rs).
    seedAiSettings([
      {
        id: PROFILE_ID,
        secrets: { provider: "openrouter", apiKey: "sk-or" },
        hasSecrets: true,
        createdAt: CREATED_AT,
      },
    ]);

    await updateAIProfile(TEST_DB, { id: PROFILE_ID, imageInputModelIds: ["local/vision"] });
    await updateAIProfile(TEST_DB, { id: PROFILE_ID, pdfInputModelIds: ["local/reader"] });
    await updateAIProfile(TEST_DB, { id: PROFILE_ID, whitelistModelIds: [] });
    const [read] = await getAIProfiles(TEST_DB);
    expect(read?.imageInputModelIds).toEqual(["local/vision"]);
    expect(read?.pdfInputModelIds).toEqual(["local/reader"]);

    await updateAIProfile(TEST_DB, { id: PROFILE_ID, imageInputModelIds: [], pdfInputModelIds: [] });
    expect(storedProfiles()[0]?.imageInputModelIds).toEqual([]);
    expect(storedProfiles()[0]?.pdfInputModelIds).toEqual([]);
  });

  it("throws not-found on update when the ai settings row is absent", async () => {
    // Twin: update_ai_profile_not_found (crates/koloda/tests/integration/ai_integration_tests.rs).
    await expect(updateAIProfile(TEST_DB, { id: PROFILE_ID, title: "X" })).rejects.toMatchObject({
      code: "not-found.ai-profile",
    });
    expect(store.has("ai")).toBe(false);
  });

  it("throws not-found on update when the profile is missing", async () => {
    seedAiSettings([{ id: "01900000-0000-7000-8000-000000000002", title: "Other", createdAt: CREATED_AT }]);

    await expect(updateAIProfile(TEST_DB, { id: PROFILE_ID, title: "X" })).rejects.toMatchObject({
      code: "not-found.ai-profile",
    });
  });

  it("reports not-found before validating secrets when the profile is missing", async () => {
    // Error precedence must mirror desktop: the lookup fails before input validation.
    seedAiSettings([{ id: "01900000-0000-7000-8000-000000000002", title: "Other", createdAt: CREATED_AT }]);

    await expect(
      updateAIProfile(TEST_DB, { id: PROFILE_ID, secrets: { provider: "openrouter", apiKey: "" } }),
    ).rejects.toMatchObject({ code: "not-found.ai-profile" });
  });

  it("creates the default ai row on remove when the settings row is absent", async () => {
    // Twin: remove_ai_profile_creates_default_row_when_settings_absent
    // (crates/koloda/tests/integration/ai_integration_tests.rs).
    await removeAIProfile(TEST_DB, { id: PROFILE_ID });
    expect(storedProfiles()).toEqual([]);
  });
});

describe("web AI profile read path", () => {
  beforeEach(() => {
    store.clear();
  });

  it("redacts stored keys and header values, and keeps local base URLs, header names, and model IDs", async () => {
    // Twin: test_redacted_profile_keeps_empty_allowlist_and_null_key (crates/koloda/tests/domain/ai_serde_tests.rs).
    // WHY: the stored hasSecrets is stale on purpose; the public flag must come from the stored key.
    seedAiSettings([
      {
        id: PROFILE_ID,
        secrets: { provider: "openrouter", apiKey: "sk-or" },
        hasSecrets: false,
        createdAt: CREATED_AT,
      },
      {
        id: "01900000-0000-7000-8000-000000000002",
        secrets: { provider: "ollama", baseUrl: "http://127.0.0.1:11434", apiKey: "ollama-key" },
        hasSecrets: false,
        createdAt: CREATED_AT,
      },
      {
        id: "01900000-0000-7000-8000-000000000003",
        secrets: {
          provider: "openaiCompatible",
          baseUrl: "http://localhost:8000/v1",
          headers: { "X-Team": "team-1" },
          modelIds: ["llama-3.1-8b"],
        },
        hasSecrets: false,
        createdAt: CREATED_AT,
      },
    ]);

    const profiles = await getAIProfiles(TEST_DB);

    expect(profiles.map(({ secrets, hasSecrets }) => ({ secrets, hasSecrets }))).toEqual([
      { secrets: { provider: "openrouter", apiKey: null }, hasSecrets: true },
      { secrets: { provider: "ollama", baseUrl: "http://127.0.0.1:11434", apiKey: null }, hasSecrets: true },
      {
        secrets: {
          provider: "openaiCompatible",
          baseUrl: "http://localhost:8000/v1",
          apiKey: null,
          headers: { "X-Team": null },
          modelIds: ["llama-3.1-8b"],
        },
        hasSecrets: false,
      },
    ]);
  });
});
