import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// WHY: the files sit outside this package, so they are listed in the `test` Nx inputs (project.json); without that,
// Nx replays a cached pass after one changes. File shape: `crates/koloda/tests/cases/README.md`.
const CASES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../crates/koloda/tests/cases");

export type RuleOutcome = { accepted: true; stored?: unknown } | { code: string } | { allowed: boolean };

export type RuleCase = {
  name: string;
  /** `undefined` when the case omits the field. */
  input: unknown;
  expect: RuleOutcome;
};

type RawCase = {
  name: string;
  input?: unknown;
  expect: RuleOutcome | { ts: RuleOutcome; rust: RuleOutcome };
  divergence?: string;
};

type RawTable = { rule: string; cases: RawCase[] };

export function readRuleCases(file: string, rule: string): RuleCase[] {
  const tables = JSON.parse(readFileSync(resolve(CASES_DIR, file), "utf8")) as RawTable[];
  const table = tables.find((candidate) => candidate.rule === rule);
  if (!table) throw new Error(`${file} has no "${rule}" table`);
  return table.cases.map(({ name, input, expect: answer, divergence }) => {
    const isSplit = "ts" in answer;
    if (isSplit !== (divergence !== undefined)) {
      throw new Error(`${name}: a two-answer case, and only one, names its divergence`);
    }
    return { name, input: expand(input), expect: isSplit ? answer.ts : answer };
  });
}

function expand(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(expand);
  if (value === null || typeof value !== "object") return value;
  const entries = Object.entries(value);
  if (entries.length === 2 && "repeat" in value && "times" in value) {
    return String(value.repeat).repeat(Number(value.times));
  }
  return Object.fromEntries(entries.map(([key, item]) => [key, expand(item)]));
}

type ParseResult = { data?: unknown; error?: { issues: ReadonlyArray<{ message: string }> } };

/**
 * The outcome a parse produced, in the shape of `ruleCase.expect`.
 * `stored` reads the normalized value from the parsed data; `null` stands for absent.
 */
export function observeRuleOutcome<R extends ParseResult>(
  ruleCase: RuleCase,
  result: R,
  stored: (data: NonNullable<R["data"]>) => unknown,
): RuleOutcome {
  const code = result.error?.issues[0]?.message;
  if (code !== undefined) return { code };
  if (!("stored" in ruleCase.expect)) return { accepted: true };
  return { accepted: true, stored: stored(result.data as NonNullable<R["data"]>) ?? null };
}
