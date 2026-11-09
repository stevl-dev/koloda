import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkTestTypecheck } from "./test-typecheck.ts";

type Tree = Record<string, string>;

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function json(value: unknown): string {
  return JSON.stringify(value);
}

// WHY: written outside the repo, so the fake packages never join the real workspace scan.
function writeTree(tree: Tree): string {
  const root = mkdtempSync(join(tmpdir(), "koloda-test-typecheck-"));
  roots.push(root);
  for (const [path, text] of Object.entries(tree)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

// A workspace where `libs/ui` has `.ts` and `.tsx` tests and every link is in place.
function wiredTree(): Tree {
  return {
    "tsconfig.json": json({ files: [], references: [{ path: "./libs/ui" }, { path: "./tools" }] }),
    "tools/tsconfig.json": json({ include: ["**/*.ts"] }),
    "libs/ui/tsconfig.json": json({
      files: [],
      references: [{ path: "./tsconfig.lib.json" }, { path: "./tsconfig.spec.json" }],
    }),
    "libs/ui/tsconfig.spec.json": json({
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      references: [{ path: "./tsconfig.lib.json" }],
    }),
    "libs/ui/src/lib/hotkeys.test.ts": "",
    "libs/ui/src/lib/select.test.tsx": "",
    "libs/settings/tsconfig.json": json({ files: [], references: [{ path: "./tsconfig.lib.json" }] }),
    "libs/settings/src/index.ts": "",
  };
}

describe("checkTestTypecheck", () => {
  it("passes when every package with tests is reachable, and needs no test config where there are no tests", () => {
    expect(checkTestTypecheck(writeTree(wiredTree()))).toEqual([]);
  });

  it("accepts a root reference that names the package config file", () => {
    const tree = wiredTree();
    tree["tsconfig.json"] = json({ references: [{ path: "./libs/ui/tsconfig.json" }, { path: "./tools" }] });
    expect(checkTestTypecheck(writeTree(tree))).toEqual([]);
  });

  it.each<{ name: string; change: (tree: Tree) => void; problems: string[] }>([
    {
      name: "the package config does not reference the test config",
      change: (tree) => {
        tree["libs/ui/tsconfig.json"] = json({ files: [], references: [{ path: "./tsconfig.lib.json" }] });
      },
      problems: ["libs/ui: tsconfig.json does not reference ./tsconfig.spec.json"],
    },
    {
      name: "the test config is missing",
      change: (tree) => {
        delete tree["libs/ui/tsconfig.spec.json"];
      },
      problems: ["libs/ui: tsconfig.spec.json is missing"],
    },
    {
      name: "the root config does not reference the package",
      change: (tree) => {
        tree["tsconfig.json"] = json({ files: [], references: [{ path: "./tools" }] });
      },
      problems: ["libs/ui: the root tsconfig.json does not reference ./libs/ui"],
    },
    {
      name: "the root config does not reference tools",
      change: (tree) => {
        tree["tsconfig.json"] = json({ files: [], references: [{ path: "./libs/ui" }] });
      },
      problems: ["tools: the root tsconfig.json does not reference ./tools"],
    },
    {
      name: "the test config leaves out one kind of test file",
      change: (tree) => {
        tree["libs/ui/tsconfig.spec.json"] = json({ include: ["src/**/*.test.ts"] });
      },
      problems: ["libs/ui: tsconfig.spec.json does not include src/**/*.test.tsx"],
    },
    {
      name: "an app gains its first test",
      change: (tree) => {
        tree["apps/web/tsconfig.json"] = json({ files: [], references: [{ path: "./tsconfig.app.json" }] });
        tree["apps/web/src/app/ai.test.ts"] = "";
      },
      problems: [
        "apps/web: the root tsconfig.json does not reference ./apps/web",
        "apps/web: tsconfig.json does not reference ./tsconfig.spec.json",
        "apps/web: tsconfig.spec.json is missing",
      ],
    },
  ])("fails when $name", ({ change, problems }) => {
    const tree = wiredTree();
    change(tree);
    expect(checkTestTypecheck(writeTree(tree))).toEqual(problems);
  });
});
