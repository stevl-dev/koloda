import { describe, expect, it } from "vitest";
import {
  buildSettingsModelRows,
  createAllowlistDraft,
  isSettingsModelRowSelected,
  setAllowlistMode,
  setAllowlistModelSelected,
  toWhitelistModelIdsUpdate,
} from "./ai-profile-models-allowlist";
import type { AIModel } from "@koloda/ai";

const gpt: AIModel = { id: "openai/gpt-4", name: "GPT-4", context_length: 128000 };
const claude: AIModel = { id: "anthropic/claude", name: "Claude", context_length: 200000 };
const vision: AIModel = { id: "openai/gpt-5", name: "GPT-5", context_length: 400000, has_image_input: true };
const reader: AIModel = { id: "local/reader", name: "Reader", context_length: 0, has_pdf_input: false };
const catalog = [gpt, claude];

describe("createAllowlistDraft", () => {
  it("uses All when the allowlist is unset", () => {
    expect(createAllowlistDraft(undefined)).toEqual({ mode: "all", selectedIds: [] });
  });

  it("uses Selected and copies stored ids", () => {
    expect(createAllowlistDraft(["openai/gpt-4"])).toEqual({ mode: "selected", selectedIds: ["openai/gpt-4"] });
  });
});

describe("setAllowlistMode", () => {
  it("restores the previous allowlist when switching from All to Selected", () => {
    const stored = createAllowlistDraft(["openai/gpt-4"]);
    const withAll = setAllowlistMode(stored, "all");
    expect(withAll.mode).toBe("all");
    expect(withAll.selectedIds).toEqual(["openai/gpt-4"]);
    expect(setAllowlistMode(withAll, "selected").selectedIds).toEqual(["openai/gpt-4"]);
  });

  it("leaves nothing checked when switching to Selected with no previous allowlist", () => {
    const draft = setAllowlistMode(createAllowlistDraft(undefined), "selected");
    expect(draft).toEqual({ mode: "selected", selectedIds: [] });
  });
});

describe("setAllowlistModelSelected", () => {
  it("ignores checkbox changes while All is selected", () => {
    const draft = createAllowlistDraft(undefined);
    expect(setAllowlistModelSelected(draft, "openai/gpt-4", false)).toEqual(draft);
    expect(setAllowlistModelSelected(draft, "openai/gpt-4", true)).toEqual(draft);
  });

  it("toggles ids while Selected is active", () => {
    const empty = createAllowlistDraft([]);
    const withGpt = setAllowlistModelSelected(empty, "openai/gpt-4", true);
    expect(withGpt.selectedIds).toEqual(["openai/gpt-4"]);
    expect(setAllowlistModelSelected(withGpt, "openai/gpt-4", false).selectedIds).toEqual([]);
  });
});

describe("toWhitelistModelIdsUpdate", () => {
  it("writes null when All is selected", () => {
    expect(toWhitelistModelIdsUpdate(createAllowlistDraft(undefined))).toBeNull();
    expect(toWhitelistModelIdsUpdate(setAllowlistMode(createAllowlistDraft(["openai/gpt-4"]), "all"))).toBeNull();
  });

  it("writes the selected ids when Selected is active, including an empty allowlist", () => {
    expect(toWhitelistModelIdsUpdate(createAllowlistDraft([]))).toEqual([]);
    expect(toWhitelistModelIdsUpdate(createAllowlistDraft(["openai/gpt-4"]))).toEqual(["openai/gpt-4"]);
  });
});

describe("buildSettingsModelRows", () => {
  it("lists catalog models and keeps stale allowlist ids checked", () => {
    const draft = createAllowlistDraft(["openai/gpt-4", "gone/model"]);
    expect(buildSettingsModelRows(catalog, draft, "")).toEqual([
      { id: "openai/gpt-4", name: "GPT-4", hasUnknownImageInput: true, hasUnknownPdfInput: true },
      { id: "anthropic/claude", name: "Claude", hasUnknownImageInput: true, hasUnknownPdfInput: true },
      { id: "gone/model", name: "gone/model", hasUnknownImageInput: false, hasUnknownPdfInput: false },
    ]);
    expect(isSettingsModelRowSelected(draft, "openai/gpt-4")).toBe(true);
    expect(isSettingsModelRowSelected(draft, "gone/model")).toBe(true);
    expect(isSettingsModelRowSelected(draft, "anthropic/claude")).toBe(false);
  });

  it("does not list stale ids while All is selected", () => {
    const draft = setAllowlistMode(createAllowlistDraft(["gone/model"]), "all");
    expect(buildSettingsModelRows(catalog, draft, "")).toEqual([
      { id: "openai/gpt-4", name: "GPT-4", hasUnknownImageInput: true, hasUnknownPdfInput: true },
      { id: "anthropic/claude", name: "Claude", hasUnknownImageInput: true, hasUnknownPdfInput: true },
    ]);
    expect(isSettingsModelRowSelected(draft, "openai/gpt-4")).toBe(true);
  });

  it("marks only catalog models with unknown image or PDF input", () => {
    const draft = createAllowlistDraft(["gone/model"]);
    const rows = buildSettingsModelRows([gpt, vision, reader], draft, "");
    expect(rows.map((row) => [row.id, row.hasUnknownImageInput, row.hasUnknownPdfInput])).toEqual([
      ["openai/gpt-4", true, true],
      ["openai/gpt-5", false, true],
      ["local/reader", true, false],
      ["gone/model", false, false],
    ]);
  });

  it("filters catalog and stale rows by name or id", () => {
    const draft = createAllowlistDraft(["gone/model"]);
    expect(buildSettingsModelRows(catalog, draft, "claude")).toEqual([
      { id: "anthropic/claude", name: "Claude", hasUnknownImageInput: true, hasUnknownPdfInput: true },
    ]);
    expect(buildSettingsModelRows(catalog, draft, "gone")).toEqual([
      { id: "gone/model", name: "gone/model", hasUnknownImageInput: false, hasUnknownPdfInput: false },
    ]);
  });
});
