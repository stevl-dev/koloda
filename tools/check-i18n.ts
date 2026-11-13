/**
 * Push gate step: the Lingui catalogs and compiled catalogs must match the source.
 * Runs extract (`--clean`) and compile (`--strict`) for web, desktop, and mobile, then fails if any catalog file changed.
 * A message added without extract would ship its id; a `.po` edited without compile would ship old text.
 * The regenerated files stay in place, ready to commit.
 * It also fails on a positional placeholder (`{0}`) in a msgid: interpolate a plain identifier so Lingui names it.
 *
 * Usage: bun run check:i18n
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APPS = ["apps/web", "apps/electron-react", "apps/mobile"];

export type Snapshot = Map<string, string>;

function readDir(root: string, dir: string): string[] {
  const path = join(root, dir);
  return existsSync(path) ? readdirSync(path) : [];
}

function catalogPaths(root: string): string[] {
  const paths: string[] = [];
  for (const group of ["libs", "apps"]) {
    for (const pkg of readDir(root, group)) {
      for (const locale of readDir(root, `${group}/${pkg}/locales`)) {
        const po = `${group}/${pkg}/locales/${locale}/messages.po`;
        if (existsSync(join(root, po))) paths.push(po);
      }
    }
  }
  for (const app of readDir(root, "apps")) {
    // WHY: Expo Router treats every file under `src/app` as a route, so the mobile app compiles to `src/locales`.
    for (const dir of [`apps/${app}/src/app/locales`, `apps/${app}/src/locales`]) {
      for (const file of readDir(root, dir)) {
        if (file.endsWith(".ts")) paths.push(`${dir}/${file}`);
      }
    }
  }
  return paths;
}

export function snapshotCatalogs(root: string): Snapshot {
  return new Map(catalogPaths(root).map((path) => [path, readFileSync(join(root, path), "utf8")]));
}

export function changedCatalogs(before: Snapshot, after: Snapshot): string[] {
  const paths = new Set([...before.keys(), ...after.keys()]);
  return [...paths].filter((path) => before.get(path) !== after.get(path)).sort();
}

// WHY: one line per msgid is enough; Lingui's PO output does not wrap ids.
export function positionalPlaceholders(snapshot: Snapshot): string[] {
  const found: string[] = [];
  for (const [path, content] of snapshot) {
    if (!path.endsWith(".po")) continue;
    for (const [, id] of content.matchAll(/^msgid "(.*)"$/gm)) {
      if (/\{\d+[,}]/.test(id)) found.push(`${path}: ${id}`);
    }
  }
  return found;
}

function lingui(root: string, app: string, args: string[]): boolean {
  const proc = Bun.spawnSync(["bunx", "lingui", ...args], { cwd: join(root, app), stdout: "pipe", stderr: "pipe" });
  if (proc.exitCode === 0) return true;
  console.error(`lingui ${args.join(" ")} failed in ${app}:`);
  console.error(proc.stdout.toString() + proc.stderr.toString());
  return false;
}

if (import.meta.main) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const before = snapshotCatalogs(root);
  // WHY: a new message fails `compile --strict` (no translation yet); list the changed catalogs anyway,
  // since they name the lib that needs extract and translation.
  let isPassing = true;
  for (const app of APPS) {
    isPassing = lingui(root, app, ["extract", "--clean"]) && lingui(root, app, ["compile", "--strict"]) && isPassing;
  }
  const after = snapshotCatalogs(root);
  const changed = changedCatalogs(before, after);
  const positional = positionalPlaceholders(after);
  if (isPassing && changed.length === 0 && positional.length === 0) {
    console.log("Lingui catalogs and compiled catalogs match the source.");
    process.exit(0);
  }
  if (changed.length > 0) {
    console.error("Lingui extract or compile changed these files; translate and commit them (agents/I18N.md):");
    for (const path of changed) console.error(`  ${path}`);
  }
  if (positional.length > 0) {
    console.error("These messages have a positional placeholder; interpolate a named local instead (agents/I18N.md):");
    for (const entry of positional) console.error(`  ${entry}`);
  }
  process.exit(1);
}
