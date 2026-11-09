/**
 * Push gate step: no Rust crate in the Cargo workspace declares a dependency it does not use (`cargo machete`).
 * It scans `Cargo.toml` files and sources as text, without compiling.
 * CI installs a pinned version and fails without it; a local run skips the step when it is not installed.
 *
 * Usage: bun run check:rust-deps
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

// WHY: matches the version `.github/workflows/ci.yml` installs.
const MACHETE_VERSION = "0.9.2";

// WHY: the workspace members, not the repo root; a recursive scan would also reach crates under the gitignored `tmp/`.
function workspaceMembers(): string[] {
  const manifest = readFileSync("Cargo.toml", "utf8");
  const members = manifest.match(/^members\s*=\s*\[([^\]]*)\]/m)?.[1];
  if (!members) throw new Error("Cargo.toml has no [workspace] members list");
  return [...members.matchAll(/"([^"]+)"/g)].map(([, path]) => path);
}

const isInstalled = spawnSync("cargo", ["machete", "--version"], { stdio: "ignore" }).status === 0;

if (!isInstalled) {
  if (process.env.CI) {
    console.error("cargo machete is not installed; the CI workflow must install it.");
    process.exit(1);
  }
  console.log("Skipped the unused Rust dependency check: cargo machete is not installed.");
  console.log(`Install it with: cargo install cargo-machete --locked --version ${MACHETE_VERSION}`);
  process.exit(0);
}

const result = spawnSync("cargo", ["machete", ...workspaceMembers()], { stdio: "inherit" });
process.exit(result.status ?? 1);
