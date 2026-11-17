# Koloda crate correctness and security fixes

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, agents/RUST.md, docs/decisions/TS-RUST-DOMAIN-MIRRORING.md, crates/koloda/src/repo/sync/README.md, crates/koloda-sync-proto/PROTOCOL.md, docs/specs/AI-PROVIDERS.md, docs/specs/CARDS.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/MARKDOWN.md, agents/VERIFY.md, agents/REVIEW.md
Flow: local

## Intent

Settle every finding of the correctness and security audit of the `koloda` crate (`crates/koloda`) at `775d993a`.
Its report was `tmp/audits/koloda-correctness-security.md`, which git ignores.
This file restates every finding and its evidence, so neither the next session nor the archive reader needs it.
The audit ran `cargo test -p koloda` (every suite passed), and reproduced findings 1, 2, 3, and 5 with temporary probe
tests that it then removed.
Its verdict: the crate is in good shape; nothing is Must-fix.
The four Should-fix findings sit where sync, or a second way to write, meets code that is right on its own.
Each finding was checked again against `537bfe0d` when this task was scheduled, and each still holds.

Done when:

- a generic settings write cannot change, add, or drop an AI profile on desktop;
- a card's review history reads oldest first on both hosts, including after a sync;
- saving a card, deck, template, or algorithm with nothing changed leaves its update time alone on both hosts;
- a remote envelope whose content, scheduling numbers, timestamps, or stability the crate's readers or validators
  refuse holds its lane as corrupt instead of applying;
- `bun run check:push` is green.

## Scope

Findings, numbered as in the report.
Line numbers are at `537bfe0d` unless a line says otherwise.

- 1. Risk, Should-fix: the generic settings write can rewrite AI profiles, which moves a stored API key to another
  provider and base URL.
  Decision: fixed by item 1.
  - `crates/koloda/src/repo/settings.rs:97-130` (`set_settings`) and `:191-204` (`patch_settings`) take any settings
    name, `ai` included.
    Both are renderer commands (`apps/electron/src-rust/src/lib.rs:527-542`, `apps/electron/src/data-ipc.ts:54-55`).
  - For `ai` the document is checked for shape only (`crates/koloda/src/domain/settings_ai.rs:52-63`):
    each profile needs a unique id, no stored key, and a base URL that parses.
  - The rule that a profile keeps its provider is checked only in `update_ai_profile`
    (`crates/koloda/src/repo/ai.rs:290-292`).
  - The API key and the custom header values are stored under the profile id with no provider
    (`repo/ai.rs:18-66`), and `get_ai_profile_secrets` (`:202-224`) puts them into whichever provider the stored
    profile names.
    Only `remove_ai_profile` (`:352-373`) removes them.
  - Audit probe: add an OpenAI profile with a key, then `patch_settings` for `ai` with a `profiles` array that keeps
    the id and names `ollama` with another base URL.
    `get_ai_profile_secrets` then returned `Ollama { base_url: "https://evil.example", api_key: Some("sk-secret") }`,
    and a chat run on that profile sends the key there (`libs/ai/src/lib/chat-stream.ts:249` at `775d993a`).
    A second `patch_settings` with `profiles: []` removed the profile and left its key in the store.
  - The OpenAI-compatible provider landed after the audit; its header values are kept the same way, so they are
    moved or left behind the same way.
  - It breaks `docs/specs/AI-PROVIDERS.md` §Editing a Profile ("An edit that names another provider fails with an
    error and changes nothing") and §Storage ("Deleting a profile removes its key and header values").
  - No screen takes this path today: the assistant settings form writes `assistant` only
    (`libs/assistant-react/src/lib/ui/assistant-settings.tsx:35-37` at `775d993a`).
    The crate keeps keys away from the renderer on purpose (`repo/ai.rs:200-201`); this path hands them to a
    renderer that runs foreign script one request later.
  - The web host keeps keys in the same browser database as the rest of the profile (§Storage), so it has no key
    boundary to protect and is out of scope.
- 2. Risk, Should-fix: remote apply stores content and scheduling numbers that the crate's own readers refuse, and one
  such row fails every list read of its kind.
  Decision: fixed by item 4.
  - `breaks_domain_rule` (`crates/koloda/src/repo/sync/apply.rs:223-233`) checks a review and the learning keys only;
    every other payload passes.
  - Card, template, and algorithm content are stored as the text received (`write_group`, `apply.rs:702-729`), and
    so is the content of their creates.
    Scheduling numbers are stored as the received `i64` (`insert_card`, `apply.rs:497-522`; `write_scheduling`,
    `:732-752`).
  - The readers parse on every read: `get_card_row` (`crates/koloda/src/repo/cards.rs:25-27`),
    `get_template_row` (`repo/templates.rs:20-22`), `get_algorithm_row` (`repo/algorithms.rs:22-24`), and the lesson
    readers (`repo/lessons.rs:243`, `:286`).
    A timestamp outside chrono's range fails to serialize (`crates/koloda/src/domain/time.rs:27-28`, `:39-40` at
    `775d993a`).
  - Audit probe A: a `templates.structure` envelope with content `{"fields":7}` applied with no hold, and
    `get_templates` then failed with `db.get` for the whole list.
    `update_template` reads the row the same way (`repo/templates.rs:237` at `775d993a`), so the app cannot repair it.
  - Audit probe B: a `cards.scheduling` envelope with `state` 9,000,000,000 applied, and `get_cards` for that deck
    then failed ("Integer 9000000000 out of range at index 4").
  - Traced, not run: algorithm content, card content, and an out-of-range `due_at` or `created_at` fail their readers
    the same way.
  - A lying device is outside the trust model; another app version is not.
    `content` is JSON inside one payload string, so its shape can change with no new payload key, which is the only
    change `PROTOCOL.md` §Corrupt envelopes ties to a schema raise.
    That section already holds a learning value for this reason: "applied, it would break every read of the
    document".
    The comment at `apply.rs:219-222` claims every fallible conversion is checked; the ones made on read are not.
  - Related, and not this finding: the deferred handoff "sync apply stores card content as received" is about extra
    keys, not unreadable content.
    Sync audit finding 4 (header values never checked) is the same family and stays out of this task, by the human's
    call.
- 3. Risk, Should-fix: a card's review history has no order, and a review synced from another device lands out of
  order.
  Decision: fixed by item 2.
  - `get_reviews` selects by card with no `ORDER BY` (`crates/koloda/src/repo/reviews.rs:103-111`); the web twin
    does the same (`libs/db-sqlite/src/lib/reviews.ts:18`).
  - A remote review is inserted when it is pulled, carrying the time it was made (`apply.rs:831` at `775d993a`).
  - The list renders rows as returned (`libs/srs-react/src/lib/cards/card-reviews.tsx:25` at `775d993a`).
  - Audit probe: a local review at 1,800,000,000,000 then a pulled review made at 1,700,000,000,000 listed newest
    first, then oldest.
    Grading one card on two devices between syncs shows the history out of order on one of them.
  - `docs/specs/CARDS.md` §Review History does not state the order.
- 4. Risk, Later: stability accepts NaN and infinity.
  Decision: fixed by item 4.
  - `validate_stability` refuses only `stability < 0.0`, which is false for NaN
    (`crates/koloda/src/domain/progress.rs:27-35`); `validate_difficulty` (`:37-48`) refuses both.
  - The desktop command layer refuses a non-finite number before the crate sees it, so the open path is a remote
    review: `breaks_domain_rule` runs this validator (`apply.rs:225`).
    An infinite stability is stored, and `serde_json` writes it to the renderer as `null`.
- 5. Spec violation, Should-fix: saving with nothing changed moves `updated_at`, which no other device ever sees.
  Decision: fixed by item 3.
  - `update_card` sets `updated_at` on every save (`crates/koloda/src/repo/cards.rs:300-307`) and captures only when
    the content changed (`:309`).
  - The same shape in `update_deck` (`repo/decks.rs:163-216`), `update_template` (`repo/templates.rs:226-266`), and
    `update_algorithm` (`repo/algorithms.rs:186-229`).
    Web twins: `updateCard` (`libs/db-sqlite/src/lib/cards.ts:138-147`), `updateDeck` (`decks.ts:54-66`),
    `updateTemplate` (`templates.ts:77-92`), `updateAlgorithm` (`algorithms.ts:52-62`).
  - `docs/specs/CARDS.md` §Editing Cards: "The card's update timestamp changes only when content is edited."
  - `crates/koloda-sync-proto/PROTOCOL.md` (§`updated_at`): the column is `max(product_ts)` across the entity's
    registers, so the next remote group for the entity recomputes it (`apply.rs:1023-1032` at `775d993a`) and the
    time moves back.
  - Audit probe: saving a card with its own content took `updated_at` from none to a time while the outbox stayed at
    7 rows; a deck saved with its own values did the same.
    The Save button is enabled without a change (`libs/ui/src/lib/primitives/form/form.tsx:57-59` at `775d993a`),
    so this is one click.
- 6. Product decision, Later: an API key may go to a plain-http base URL on another host.
  Decision: skipped.
  - `require_base_url` accepts any URL that parses (`crates/koloda/src/domain/ai.rs:261-270`), and the optional key
    of an Ollama, LM Studio, or OpenAI-compatible profile is sent to it.
    `docs/specs/AI-PROVIDERS.md` §Validation asks only for a valid URL.
    The sync engine refuses an insecure server URL for its own token; the AI base URL has no such rule.
  - Skipped because refusing breaks ordinary setups: Ollama and LM Studio serve plain `http` only, and are often run
    on another machine on the local network, in a Docker network, or over Tailscale; vLLM and LiteLLM behind a key
    are common the same way.
    Every write of the `ai` document validates every profile (`SettingsName::normalize`), so one stored profile with
    such a URL would also fail every later AI settings save.
    A warning in the profile form would be the safe form, and is UI work outside this crate.

Resolved deferred entries: none.

Out: sync audit finding 4, the web host's AI profile writes (see finding 1), the deferred handoff on card content
keys, and any rule on AI base URLs.

## Open questions

None.

## Plan

- [x] 1. Keep AI profiles out of the generic settings writes
  Goal: finding 1.
  `set_settings` and `patch_settings` in `crates/koloda/src/repo/settings.rs` are renderer commands and today write
  the whole `ai` document, profiles included.
  For `SettingsName::Ai`, make both keep the stored `profiles` and take only the rest of the document (`assistant`).
  Profiles stored by nothing (no `ai` row yet) stay an empty list.
  Profile writes in `crates/koloda/src/repo/ai.rs` (`set_ai_settings` and its callers) go through a crate-private
  writer that keeps today's behavior, so `add_ai_profile`, `update_ai_profile`, `remove_ai_profile`, and the
  allowlist writes still change profiles.
  Leave a `// INVARIANT` at the public writes naming why (keys are stored by profile id, AI-PROVIDERS.md §Editing a
  Profile and §Storage).
  Constraints: `crates/koloda` only (`repo/settings.rs`, `repo/ai.rs`, and their tests).
  The Electron command layer and the web host do not change.
  Done when:
  - integration tests in `crates/koloda/tests/integration/ai_integration_tests.rs` or `settings_integration_tests.rs`:
    a `patch_settings` and a `set_settings` for `ai` that change a profile's provider and base URL leave the profile
    and its secrets as they were; one with `profiles: []` leaves the profile and its key; one that changes
    `assistant` still saves it;
  - the existing AI and settings tests pass;
  - `cargo test -p koloda` passes.
  Commit: Keep AI profiles out of the generic settings writes
  Depends on: none
- [x] 2. Order a card's review history by time
  Goal: finding 3.
  `get_reviews` in `crates/koloda/src/repo/reviews.rs` and `getReviews` in `libs/db-sqlite/src/lib/reviews.ts` add
  `ORDER BY created_at, id`, so the history reads oldest first on both hosts, as it did before sync.
  State the order in `docs/specs/CARDS.md` §Review History.
  Constraints: those two functions, their tests, and that spec section.
  Done when:
  - a Rust integration test and a `libs/db-sqlite` integration test insert a later review before an earlier one and
    read them oldest first;
  - `cargo test -p koloda` and `bun run test:libs` pass.
  Commit: Order a card's review history by time
  Depends on: none
- [ ] 3. Move update times only when a save changes something
  Goal: finding 5.
  In `update_card`, `update_deck`, `update_template`, and `update_algorithm` (`crates/koloda/src/repo/`), set
  `updated_at` only when a field that captures for sync changed, decided from the row the transaction reads, as the
  capture already is.
  A save with nothing changed writes nothing and returns the stored row.
  Mirror it in the web twins `updateCard`, `updateDeck`, `updateTemplate`, and `updateAlgorithm`
  (`libs/db-sqlite/src/lib/`), so the hosts stay alike.
  The optimizer's content write (`repo/algorithms.rs:305`) changes content and keeps its update.
  Constraints: those eight functions and their tests; no schema change.
  Done when:
  - for each of the four kinds, on both hosts, a test saves the stored values and finds `updated_at` unchanged, and a
    test that changes one field finds it moved;
  - `cargo test -p koloda` and `bun run test:libs` pass.
  Commit: Move update times only when a save changes something
  Depends on: none
- [ ] 4. Hold remote envelopes the crate's readers would refuse
  Goal: findings 2 and 4.
  Extend `breaks_domain_rule` (`crates/koloda/src/repo/sync/apply.rs`) so a payload is corrupt when applying it would
  store a value the crate's readers or validators refuse:
  card, template, and algorithm content (creates and update groups) that does not parse as its reader parses it
  (`get_card_row`, `get_template_row`, `get_algorithm_row`);
  card scheduling numbers (create and `cards.scheduling`) that do not convert as the row mappers convert them;
  and timestamps that `domain/time.rs` cannot serialize.
  Reuse the parsers and conversions the readers use, so the check and the read cannot drift.
  `validate_stability` (`crates/koloda/src/domain/progress.rs`) refuses a non-finite stability, as
  `validate_difficulty` already does.
  Correct the `// INVARIANT` above `breaks_domain_rule` to what it now checks.
  Name the new cases in `crates/koloda-sync-proto/PROTOCOL.md` §Corrupt envelopes, beside the learning values.
  Constraints: `apply.rs`, `domain/progress.rs`, the readers only where a parse or conversion must be shared,
  `PROTOCOL.md` §Corrupt envelopes, and their tests.
  Header values (sync audit finding 4) are out.
  Done when:
  - sync apply tests in `crates/koloda/tests/integration/`: a `templates.structure` envelope with content
    `{"fields":7}`, a `cards.scheduling` envelope with `state` 9,000,000,000, a card create with unreadable content,
    an algorithm content group that does not parse, and a review with infinite stability each hold as
    `CorruptEnvelope`, and the list reads of their kinds still succeed;
  - a domain test refuses NaN and infinite stability;
  - the existing sync apply tests pass;
  - `cargo test -p koloda` passes.
  Commit: Hold remote envelopes the crate's readers would refuse
  Depends on: none

## Outcome

<what shipped>

Spec: docs/specs/CARDS.md
Review: not run
Change rounds: 0
