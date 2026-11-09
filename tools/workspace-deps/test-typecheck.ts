import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import ts from "typescript";

// INVARIANT: every package with tests keeps `tsconfig.spec.json` beside its `tsconfig.json`, which references it,
// and the root `tsconfig.json` references the package, so `tsc -b` reaches its tests.
const TEST_CONFIG = "tsconfig.spec.json";
const TEST_FILE = /\.test\.(ts|tsx)$/;
const TOOLS_DIR = "tools";

function toPosix(path: string): string {
  return path.split(sep).join("/");
}

function readConfig(path: string): { include?: unknown; references?: unknown } | null {
  if (!existsSync(path)) return null;
  const { config, error } = ts.readConfigFile(path, ts.sys.readFile);
  return error ? null : config;
}

// WHY: a reference may name a config file or a directory that holds `tsconfig.json`, as `tsc -b` allows.
function referencedConfigs(configPath: string): string[] {
  const references = readConfig(configPath)?.references;
  if (!Array.isArray(references)) return [];
  const dir = resolve(configPath, "..");
  return references.flatMap((reference: { path?: unknown }) => {
    if (typeof reference?.path !== "string") return [];
    const target = resolve(dir, reference.path);
    return [target.endsWith(".json") ? target : join(target, "tsconfig.json")];
  });
}

function testExtensions(pkgDir: string): Set<string> {
  const extensions = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === "dist") continue;
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      const match = TEST_FILE.exec(entry);
      if (match?.[1]) extensions.add(match[1]);
    }
  };
  const srcDir = join(pkgDir, "src");
  if (existsSync(srcDir)) walk(srcDir);
  return extensions;
}

function packageProblems(root: string, pkgDir: string, rootReferences: string[]): string[] {
  const extensions = testExtensions(pkgDir);
  if (extensions.size === 0) return [];

  const name = toPosix(relative(root, pkgDir));
  const packageConfig = join(pkgDir, "tsconfig.json");
  const testConfig = join(pkgDir, TEST_CONFIG);
  const problems: string[] = [];

  if (!rootReferences.includes(packageConfig)) {
    problems.push(`${name}: the root tsconfig.json does not reference ./${name}`);
  }
  if (!referencedConfigs(packageConfig).includes(testConfig)) {
    problems.push(`${name}: tsconfig.json does not reference ./${TEST_CONFIG}`);
  }

  const config = readConfig(testConfig);
  if (!config) {
    problems.push(`${name}: ${TEST_CONFIG} is missing`);
    return problems;
  }
  const include = Array.isArray(config.include) ? config.include : [];
  for (const extension of [...extensions].sort()) {
    const pattern = `src/**/*.test.${extension}`;
    if (!include.includes(pattern)) problems.push(`${name}: ${TEST_CONFIG} does not include ${pattern}`);
  }
  return problems;
}

export function checkTestTypecheck(root: string): string[] {
  const rootReferences = referencedConfigs(join(root, "tsconfig.json"));
  const problems: string[] = [];

  if (!rootReferences.includes(join(root, TOOLS_DIR, "tsconfig.json"))) {
    problems.push(`${TOOLS_DIR}: the root tsconfig.json does not reference ./${TOOLS_DIR}`);
  }

  for (const parent of ["libs", "apps"]) {
    const parentDir = join(root, parent);
    if (!existsSync(parentDir)) continue;
    for (const entry of readdirSync(parentDir).sort()) {
      const pkgDir = join(parentDir, entry);
      if (statSync(pkgDir).isDirectory()) problems.push(...packageProblems(root, pkgDir, rootReferences));
    }
  }
  return problems;
}
