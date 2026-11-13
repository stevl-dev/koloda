import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { changedCatalogs, positionalPlaceholders, snapshotCatalogs } from "./check-i18n.ts";

let root: string | null = null;

function write(path: string, content: string) {
  if (root == null) throw new Error("no fixture root");
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
}

afterEach(() => {
  if (root != null) rmSync(root, { recursive: true, force: true });
  root = null;
});

describe("changedCatalogs", () => {
  it("names catalogs and compiled files that changed, appeared, or went away, and nothing else", () => {
    root = mkdtempSync(join(tmpdir(), "check-i18n-"));
    write("libs/ui/locales/en/messages.po", "ui en");
    write("libs/ui/locales/ru/messages.po", "ui ru");
    write("libs/ui/src/form.tsx", "source");
    write("apps/web/locales/en/messages.po", "web en");
    write("apps/web/src/app/locales/en.ts", "compiled en");
    write("apps/web/src/app/locales/ru.ts", "compiled ru");
    write("apps/mobile/src/locales/en.ts", "compiled mobile en");
    const before = snapshotCatalogs(root);

    // Extract edits one lib catalog and adds a locale; compile rewrites one file and another goes away.
    write("libs/ui/locales/ru/messages.po", "ui ru, new message");
    write("libs/app/locales/en/messages.po", "app en");
    write("apps/web/src/app/locales/en.ts", "compiled en, new message");
    rmSync(join(root, "apps/web/src/app/locales/ru.ts"));
    write("apps/mobile/src/locales/en.ts", "compiled mobile en, new message");
    write("libs/ui/src/form.tsx", "source edited");

    expect(changedCatalogs(before, snapshotCatalogs(root))).toEqual([
      "apps/mobile/src/locales/en.ts",
      "apps/web/src/app/locales/en.ts",
      "apps/web/src/app/locales/ru.ts",
      "libs/app/locales/en/messages.po",
      "libs/ui/locales/ru/messages.po",
    ]);
  });
});

describe("positionalPlaceholders", () => {
  it("flags numbered placeholders and plurals in msgids, not named ones or translations", () => {
    const po = [
      'msgid "form.created-at {0}"',
      'msgstr "Created {0}"',
      'msgid "{0, plural, other {review-count}}"',
      'msgstr "{0, plural, one {# review} other {# reviews}}"',
      'msgid "lesson.progress.label {position} {total}"',
      'msgstr "Card {position} of {total}"',
      'msgid "{count, plural, other {used-by-decks}}"',
      'msgstr "Used by {count, plural, one {# deck} other {# decks}}"',
    ].join("\n");
    const snapshot = new Map([
      ["libs/ui/locales/en/messages.po", po],
      ["apps/web/src/app/locales/en.ts", 'msgid "compiled {0}"'],
    ]);

    expect(positionalPlaceholders(snapshot)).toEqual([
      "libs/ui/locales/en/messages.po: form.created-at {0}",
      "libs/ui/locales/en/messages.po: {0, plural, other {review-count}}",
    ]);
  });
});
