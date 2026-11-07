import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { changedCatalogs, snapshotCatalogs } from "./check-i18n.ts";

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
    const before = snapshotCatalogs(root);

    // Extract edits one lib catalog and adds a locale; compile rewrites one file and another goes away.
    write("libs/ui/locales/ru/messages.po", "ui ru, new message");
    write("libs/app/locales/en/messages.po", "app en");
    write("apps/web/src/app/locales/en.ts", "compiled en, new message");
    rmSync(join(root, "apps/web/src/app/locales/ru.ts"));
    write("libs/ui/src/form.tsx", "source edited");

    expect(changedCatalogs(before, snapshotCatalogs(root))).toEqual([
      "apps/web/src/app/locales/en.ts",
      "apps/web/src/app/locales/ru.ts",
      "libs/app/locales/en/messages.po",
      "libs/ui/locales/ru/messages.po",
    ]);
  });
});
