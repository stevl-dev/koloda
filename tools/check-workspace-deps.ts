/**
 * Tripwire: each libs package.json `dependencies` must match @koloda workspace
 * imports in that package's production sources (missing + phantom). Libs must
 * sit in the layer table; imports must follow layer/peer/exclusive rules.
 * Every package's test files, and `tools/`, must stay inside `tsc -b`.
 *
 * Usage: bun run tools/check-workspace-deps.ts
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkWorkspace, formatCheckFailures } from "./workspace-deps/contract.ts";
import { checkTestTypecheck } from "./workspace-deps/test-typecheck.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { results, staleLayers } = checkWorkspace(root);
const report = formatCheckFailures(results, staleLayers);
const typecheckProblems = checkTestTypecheck(root);

if (report == null && typecheckProblems.length === 0) {
  console.log("Workspace @koloda/* dependencies match imports and layer rules.");
  console.log("Every package's test files and tools/ are in the type check.");
  process.exit(0);
}

if (report != null) console.error(report);
if (typecheckProblems.length) {
  console.error(["Test type-check coverage failed:", ...typecheckProblems.map((problem) => `  ${problem}`)].join("\n"));
}
process.exit(1);
