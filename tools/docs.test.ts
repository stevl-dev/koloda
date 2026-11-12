import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

function listMarkdown(dir: string): string[] {
  return readdirSync(join(root, dir))
    .filter((name) => name.endsWith(".md"))
    .map((name) => join(dir, name));
}

function read(relPath: string): string {
  return readFileSync(join(root, relPath), "utf8");
}

// WHY: guides also write shorthand relative to a package (`live/`, `tests/domain/`) and bare package names
// (`@lingui/react`). Only spans that start with a top-level repo entry are repo paths.
const topLevel = new Set(readdirSync(root));

// WHY: build outputs exist only after a build, so a path into them would pass or fail by machine.
const buildOutputs = new Set(["dist", "target"]);

// WHY: placeholders (`<slug>`, `…`), globs (`*`), and ranges (`..`) are not literal paths.
function pathSpans(markdown: string): string[] {
  const spans = [...markdown.matchAll(/`([^`\n]+)`/g)].map((match) => match[1]);
  return spans.filter(
    (span) =>
      span.includes("/") &&
      topLevel.has(span.split("/")[0]) &&
      !buildOutputs.has(span.split("/")[0]) &&
      !/\s/.test(span) &&
      !/[<>*{}§|…]/.test(span) &&
      !span.includes(".."),
  );
}

const skippedDirs = new Set(["node_modules", "target", "dist", "tmp", "tasks"]);

function allFiles(isWanted: (name: string) => boolean, dir = ""): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") || skippedDirs.has(entry.name)) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return allFiles(isWanted, path);
    return isWanted(entry.name) ? [path] : [];
  });
}

function allMarkdown(): string[] {
  return allFiles((name) => name.endsWith(".md"));
}

function withoutFences(markdown: string): string {
  return markdown.replace(/^(```|~~~)[\s\S]*?^\1.*$/gm, "");
}

function headingsAndLabels(markdown: string): string[] {
  const text = withoutFences(markdown);
  const headings = [...text.matchAll(/^#{1,6} (.+)$/gm)].map((match) => match[1].trim());
  const labels = [...text.matchAll(/^\*\*([^*]+)\*\*/gm)].map((match) => match[1].replace(/[.:]$/, ""));
  return [...headings, ...labels];
}

// WHY: a pointer names a heading by its text, and a longer heading may continue after a colon or a parenthesis
// (`§Self-review` for "Self-review (agent, before the human's ask)"). A numbered step goes by its number
// (`§4` for "4. Add Electron titlebar colors").
function resolvesTo(headings: string[], name: string): boolean {
  return headings.some(
    (heading) =>
      heading === name ||
      heading.startsWith(`${name}:`) ||
      heading.startsWith(`${name} (`) ||
      (/^\d+$/.test(name) && heading.startsWith(`${name}. `)),
  );
}

function sectionBody(markdown: string, heading: string): string | null {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => line === `## ${heading}`);
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
}

describe("markdown paths", () => {
  // WHY: specs never name code; the "functional specs" block rejects paths in them.
  const docs = allMarkdown().filter((file) => !file.startsWith("docs/specs/"));

  it.each(docs)("%s names only paths that exist", (doc) => {
    const missing = pathSpans(read(doc)).filter((span) => !existsSync(join(root, span)));
    expect(missing).toEqual([]);
  });
});

describe("functional specs", () => {
  const specs = listMarkdown("docs/specs");

  it.each(specs)("%s opens with Scope, What it is, Core model", (spec) => {
    const headings = read(spec)
      .split("\n")
      .filter((line) => line.startsWith("## "))
      .slice(0, 3);
    expect(headings).toEqual(["## Scope", "## What it is", "## Core model"]);
  });

  // WHY: heading text is the pointer id, so one case convention keeps pointers predictable.
  it.each(specs)("%s uses Title Case headings", (spec) => {
    const lowercase = new Set(["a", "an", "the", "and", "or", "but", "on", "to", "of", "in", "for", "at", "by"]);
    const mandated = new Set(["What it is", "Core model"]);
    const headings = [...withoutFences(read(spec)).matchAll(/^#{2,6} (.+)$/gm)]
      .map((match) => match[1].trim())
      .filter((heading) => !mandated.has(heading));
    const miscased = headings.filter((heading) =>
      heading.split(" ").some((word, index) => {
        if (!/^[a-z]/.test(word)) return false;
        return index === 0 || !lowercase.has(word);
      }),
    );
    expect(miscased).toEqual([]);
  });

  it.each(specs)("%s has a Relationships section inside Core model", (spec) => {
    const markdown = read(spec);
    const core = markdown.indexOf("\n## Core model\n");
    const relationships = markdown.indexOf("\n### Relationships\n");
    const next = markdown.indexOf("\n## ", core + 1);
    expect(relationships).toBeGreaterThan(core);
    expect(next === -1 || relationships < next).toBe(true);
  });

  // WHY: a spec describes behavior and never names code. Source paths and file or symbol syntax are the tell.
  it.each(specs)("%s names no source paths or code symbols", (spec) => {
    const spans = [...withoutFences(read(spec)).matchAll(/`([^`\n]+)`/g)].map((match) => match[1]);
    const code = spans.filter(
      (span) =>
        /\.(ts|tsx|rs|sql|json|toml)$/.test(span) ||
        span.includes("::") ||
        span.endsWith("()") ||
        (span.includes("/") && topLevel.has(span.split("/")[0])),
    );
    expect(code).toEqual([]);
  });
});

describe("decisions", () => {
  const decisions = listMarkdown("docs/decisions").map((path) => path.split("/").pop() ?? path);
  const playbooks = listMarkdown("agents").map(read).join("\n");

  it.each(decisions)("%s is pointed at from INDEX or a playbook", (decision) => {
    expect(playbooks).toContain(decision);
  });
});

describe("archived tasks", () => {
  const archived = readdirSync(join(root, "tasks/archive"))
    .filter((name) => name.endsWith(".md"))
    .map((name) => join("tasks/archive", name));

  it("has at least one archived task", () => {
    expect(archived.length).toBeGreaterThan(0);
  });

  it.each(archived)("%s is Status: done with a non-empty Outcome", (task) => {
    const markdown = read(task);
    expect(markdown.split("\n")).toContain("Status: done");
    expect(sectionBody(markdown, "Outcome")).toBeTruthy();
  });
});

describe("deferred work", () => {
  const markdown = read("tasks/DEFERRED.md");
  const firstHeading = markdown.search(/^## /m);
  // INVARIANT: an entry is a top-level list item under a `##` heading; its field lines are indented under it.
  const entries =
    firstHeading === -1
      ? []
      : markdown
          .slice(firstHeading)
          .split(/^(?=- )/m)
          .filter((entry) => entry.startsWith("- "));

  // WHY: one test over all entries, because the file may hold none and Vitest fails a suite with no tests.
  it("names an archived task file in every entry's Source line", () => {
    const problems = entries.flatMap((entry) => {
      const title = entry.split("\n")[0];
      const source = entry.match(/^ +Source: `([^`]+)`/m)?.[1];
      if (!source) return [`${title} has no Source line`];
      const isArchived = source.startsWith("tasks/archive/") && existsSync(join(root, source));
      return isArchived ? [] : [`${title} names ${source}, which is not in tasks/archive/`];
    });
    expect(problems).toEqual([]);
  });
});

describe("section pointers", () => {
  const files = allMarkdown();
  const byName = new Map<string, string[]>();
  for (const file of files) {
    const name = file.split("/").pop() ?? file;
    byName.set(name, [...(byName.get(name) ?? []), file]);
  }

  // WHY: code comments point into the docs too. This file is skipped: its strings show the syntax.
  const sources = allFiles((name) => /\.(ts|tsx|mts|mjs|js|rs|css|yml)$/.test(name)).filter(
    (file) => file !== "tools/docs.test.ts" && read(file).includes("§"),
  );

  // `FILE.md (§Heading)` points into FILE.md; a bare `(§Heading)` points into the file it is written in.
  // WHY: a placeholder such as `FILE.md (§Section)` or `(§…)` documents the syntax and points at nothing.
  const pointer = /(?:([\w./-]+\.md)`?\s*)?\((§[^)\n]*)\)/g;
  // `FILE.md §Heading` or `FILE.md §One, §Two`; the names are read from the rest of the line.
  const barePointer = /([\w./-]+\.md)`?[ \t]+(?=§)/g;

  function targetFile(from: string, named: string | undefined): string | null {
    if (!named) return from;
    if (named.includes("/")) return existsSync(join(root, named)) ? named : null;
    const matches = byName.get(named) ?? [];
    return matches.length === 1 ? matches[0] : null;
  }

  // WHY: a comment wrapped mid-heading leaves only the heading's start on the line (`TEMPLATES.md §Deleting`), so a
  // last name that runs to the end of the line may be a prefix of the heading.
  function bareNames(line: string): { name: string; isCut: boolean }[] {
    const names: { name: string; isCut: boolean }[] = [];
    let rest = line;
    while (rest.startsWith("§")) {
      // A name ends at a closing mark, a sentence end, or a comma; `, §` starts another name in the same file.
      const end = rest.search(/[)(;'"`|]|[.,:](?:\s|$)|\*\/|$/);
      const name = rest.slice(1, end).trim();
      rest = rest.slice(end);
      names.push({ name, isCut: /^\s*(\*\/)?\s*$/.test(rest) });
      if (!/^,\s*§/.test(rest)) break;
      rest = rest.replace(/^,\s*/, "");
    }
    return names;
  }

  function unresolved(file: string): string[] {
    const problems: string[] = [];
    const isMarkdown = file.endsWith(".md");
    const text = isMarkdown ? withoutFences(read(file)) : read(file);
    for (const match of text.matchAll(pointer)) {
      if (match[1] === "FILE.md" || match[2].includes("…") || (!isMarkdown && !match[1])) continue;
      const target = targetFile(file, match[1]);
      if (!target) {
        problems.push(`${match[1]} does not name exactly one file`);
        continue;
      }
      const known = headingsAndLabels(read(target));
      for (const part of match[2].split("§").map((text) => text.trim().replace(/,$/, "").trim())) {
        if (!part) continue;
        // WHY: `(§Field groups and merge, Apply rule)` lists several headings under one pointer.
        const names = resolvesTo(known, part) ? [] : part.split(",").map((name) => name.trim());
        const missing = names.filter((name) => !resolvesTo(known, name));
        if (missing.length > 0) problems.push(`${match[1] ?? "this file"} has no section ${missing.join(", ")}`);
      }
    }
    for (const match of text.matchAll(barePointer)) {
      if (match[1] === "FILE.md") continue;
      const target = targetFile(file, match[1]);
      if (!target) {
        problems.push(`${match[1]} does not name exactly one file`);
        continue;
      }
      const known = headingsAndLabels(read(target));
      const line = text.slice((match.index ?? 0) + match[0].length).split("\n")[0];
      for (const { name, isCut } of bareNames(line)) {
        if (!name || name.includes("…") || resolvesTo(known, name)) continue;
        if (isCut && known.some((heading) => heading.startsWith(name))) continue;
        problems.push(`${match[1]} has no section ${name}`);
      }
    }
    return problems;
  }

  it.each([...files, ...sources])("%s points only at sections that exist", (file) => {
    expect(unresolved(file)).toEqual([]);
  });
});

describe("identifiers in guides", () => {
  const guides = [
    "AGENTS.md",
    ...listMarkdown("agents"),
    ...["libs", "apps", "crates"].flatMap((dir) =>
      readdirSync(join(root, dir))
        .map((name) => join(dir, name, "README.md"))
        .filter((file) => existsSync(join(root, file))),
    ),
  ];

  // WHY: these names are absent on purpose. `agents/ASSISTANT-MAP.md` (§Do not reintroduce) and two package READMEs
  // forbid the first four, and `agents/DEPENDENCIES.md` keeps the `package.json` key `trustedDependencies` out.
  const absentOnPurpose = new Set([
    "getChatStreamGenerator",
    "getStreamGenerator",
    "resolveDataAccess",
    "useAssistantChat",
    "trustedDependencies",
  ]);

  const tracked = spawnSync("git", ["ls-files", "libs", "apps", "crates", "tools", ".github", "package.json"], {
    cwd: root,
    encoding: "utf8",
  }).stdout.split("\n");
  // WHY: this file is skipped: it holds the allow-list, which would make every allowed name occur.
  const sourceWords = new Set(
    tracked
      .filter((file) => /\.(ts|tsx|rs|json|mjs|css|toml|yml)$/.test(file) && file !== "tools/docs.test.ts")
      .filter((file) => existsSync(join(root, file)))
      .flatMap((file) => read(file).match(/[A-Za-z_$][\w$]*/g) ?? []),
  );

  function camelCaseSpans(markdown: string): string[] {
    const spans = [...withoutFences(markdown).matchAll(/`([^`\n]+)`/g)].map((match) => match[1]);
    return spans.filter((span) => /^[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*$/.test(span));
  }

  it.each(guides)("%s names only identifiers that exist in source", (file) => {
    const missing = camelCaseSpans(read(file)).filter((name) => !absentOnPurpose.has(name) && !sourceWords.has(name));
    expect([...new Set(missing)]).toEqual([]);
  });

  it("allows only names that are still absent from source", () => {
    expect([...absentOnPurpose].filter((name) => sourceWords.has(name))).toEqual([]);
  });
});
