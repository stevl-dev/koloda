# Upgrading a Dependency

How to move an npm package, a crate, Bun, or the Rust toolchain to a newer version.
Adding a new dependency is not covered here.

## Read What Changed

1. Find the range: the installed version (`bun.lock`, `Cargo.lock`, `package.json` `packageManager`,
   `rust-toolchain.toml`) and the target.
2. Read the release notes or migration guide for every release in that range, fetched from the source.
   Do not rely on memory: it may not cover the target version, or may mix it up with others.
   If you cannot fetch them, say so and stop.
3. List what the range changes: removed or renamed APIs, changed defaults, changed behavior, new requirements.

## Apply It

1. Search the codebase for each item on the list, including config files, CSS, and tests.
   The type checker finds removed APIs, but not a changed default or a config key it does not type.
2. Update with the package manager (`bun add`, `cargo update`), never by editing a lockfile.
3. Move packages that must stay in step together, such as `nx` and `@nx/*`.
   Otherwise, one package per commit.
4. Delete workarounds the new version makes unnecessary, such as a polyfill it now provides.

## Commit

The subject names the package and the target version.
The body states the range and each change that touched the code, or that none did.
It also names any transitive version change in the lockfile that the human should see.

## Verify

Run `bun run check:push`.
If the package runs in the app, not only in tests or tooling, add a Manual verify block (`agents/VERIFY.md`).
