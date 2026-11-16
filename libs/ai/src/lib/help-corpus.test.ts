import { describe, expect, it } from "vitest";
import { readHelpTopic } from "./help-corpus";
import { HELP_TOPIC_IDS } from "./help-corpus.generated";

describe("readHelpTopic", () => {
  it("returns every topic whole, from its title to its last section", () => {
    for (const id of HELP_TOPIC_IDS) {
      const read = readHelpTopic(id);
      expect(read.section).toBeUndefined();
      expect(read.markdown.startsWith(`# ${read.title}\n`)).toBe(true);
      expect(read.markdown.match(/^## /gm)?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("returns one section up to the next heading of its level", () => {
    const read = readHelpTopic("learning-settings", "Daily Limits");

    expect(read).toMatchObject({ title: "Learning Settings", section: "Daily Limits" });
    expect(read.markdown.startsWith("## Daily Limits\n")).toBe(true);
    expect(read.markdown).toContain("On first setup, Total is 200.");
    expect(read.markdown).not.toContain("## Learning Day");
    expect(read.markdown).not.toContain("## Defaults");
  });

  it("includes a section's subsections, and a subsection alone stops at the next section", () => {
    const parent = readHelpTopic("learning-settings", "Core model");
    expect(parent.markdown).toContain("### Relationships");
    expect(parent.markdown).not.toContain("## Defaults");

    const child = readHelpTopic("learning-settings", "Relationships");
    expect(child.markdown.startsWith("### Relationships\n")).toBe(true);
    expect(child.markdown).not.toContain("## Defaults");
  });

  it("matches a section heading regardless of case and surrounding spaces", () => {
    expect(readHelpTopic("learning-settings", "  daily limits ").section).toBe("Daily Limits");
  });

  it("rejects an unknown topic and lists the topics", () => {
    expect(() => readHelpTopic("billing")).toThrow(/Unknown help topic "billing"\. Topics: .*learning-settings/);
  });

  it("rejects an unknown section and lists that topic's sections", () => {
    expect(() => readHelpTopic("learning-settings", "Billing")).toThrow(
      /no section "Billing"\. Sections: Scope, What it is, Core model, Relationships, Defaults, Daily Limits/,
    );
  });
});
