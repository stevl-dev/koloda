import { describe, expect, it } from "vitest";
import { DEFAULT_CHAT_PROMPT_TEMPLATE } from "./prompts";

describe("DEFAULT_CHAT_PROMPT_TEMPLATE", () => {
  it("tells the model to invent cards via propose_cards instead of picking existing ones", () => {
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toContain("propose_cards");
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toMatch(/random card/i);
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toMatch(/invent/i);
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toContain("list_decks");
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toContain("list_templates");
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toMatch(/do not ask the user to list templates/i);
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toContain("get_template");
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toMatch(/full field metadata/i);
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toMatch(/known templateId/i);
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toContain("add_deck");
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toMatch(/list_templates, then add_deck, then propose_cards/i);
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toMatch(/do not ask the user for ids/i);
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toMatch(/omit algorithmId unless the user asked/i);
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toContain("list_algorithms");
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toMatch(/users call algorithms presets/i);
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toMatch(/do not ask the user to list presets/i);
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toMatch(/do not ask the user for field titles/i);
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toMatch(/do not restate the cards/i);
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toMatch(/markdown table/i);
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toMatch(/0 cards/i);
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toMatch(/rejectedCount/i);
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toMatch(/short note/i);
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toContain("get_deck");
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toMatch(/one deck's metadata/i);
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toMatch(/do not ask the user for an id/i);
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).not.toMatch(/call list_decks and get_deck_cards first/i);
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).not.toMatch(/currently selected deck/i);
  });

  it("sends questions about the app to read_help_topic instead of memory", () => {
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toContain("read_help_topic");
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toMatch(/how the app works/i);
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toMatch(/not from memory/i);
  });

  it("sends questions about the app and sync to get_app_info", () => {
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toMatch(/which app they are in or whether sync works, call get_app_info/i);
  });

  it("sends questions about today's lesson amounts to get_lessons_today", () => {
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toMatch(/why a lesson offers the amounts it does, call get_lessons_today/i);
  });

  it("sends a request to change a setting to change_settings, and a what-if question to no tool", () => {
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toMatch(
      /asks you to change a learning or interface setting.*call change_settings/i,
    );
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toMatch(/so do not ask first/i);
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toMatch(/only asks what a value would do, answer without changing it/i);
  });

  it("sends questions about the user's own values to get_settings", () => {
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toContain("get_settings");
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toMatch(/daily limit/i);
    expect(DEFAULT_CHAT_PROMPT_TEMPLATE).toMatch(/help topics give only first-setup defaults/i);
  });
});
