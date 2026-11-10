# Architecture Review Guide for AI Agents

This guide defines how an agent reviews the structure of one area and weighs whether it should change.
It runs only when the human asks for it.
Its output is a report with at most three proposals, not code changes.

An audit (`agents/AUDIT.md`) keeps every fix local and never recommends rewriting a module.
That keeps audits quiet, but it means structural problems only pile up as Later findings.
This review is where they are weighed together.
It is the only place an agent may recommend a structural change.

## Target and inputs

The prompt names one area: a package, a subsystem such as sync, or one primary spec with the code that implements it.
If you cannot restate the area's include and exclude in a short paragraph, ask to split it.

Load `agents/DECISIONS.md` and `agents/BACKWARDS-COMPATIBILITY.md`.
Then read, for the area:

- its primary spec, its decisions, and the README of each package in it (`Where it sits`, `Does NOT own`);
- its entries in `tasks/DEFERRED.md`: the skipped and needs-decision findings, open questions, and handoffs
  that earlier tasks left undone (`agents/TASKS.md` (§Deferred work));
- its git history since the area's last architecture review, or for the whole area if there was none.

From the history, measure:

- which files change together in the same commits;
- where follow-up and fix commits cluster, including commits that carry `Escapes:`;
- which findings recur across audits.

## What to look for

1. **The area as it is.**
   Components, data flow, and boundaries as the code has them, not as the README says.
   The report opens with this map; the human uses it to judge the proposals.
2. **Several conventions for one problem.**
   The same job done in two or three shapes across the area.
3. **Friction.**
   Files that always change together across a boundary, findings that keep coming back, deferred items piling up.
4. **Boundaries that do not hold.**
   A README `Does NOT own` line or a decision Ruling contradicted by imports or calls.

## Proposals

Make at most three proposals.
Each one is a draft decision in the `agents/DECISIONS.md` template, followed by its options.

Every proposal compares these options:

- **Do nothing.**
  Always present, and argued seriously: the cost of keeping things as they are, with evidence.
- **Consolidate locally.**
  The smallest change that removes most of the friction.
- **Change the structure.**
  Only if the evidence supports it.

For each option, state:

- the evidence it rests on: measured history, `file:line`, or cited findings;
- the rough cost in commits and files, and the net lines it adds or removes;
- what it puts at risk, and whether it can be undone once released (`agents/BACKWARDS-COMPATIBILITY.md`);
- what it unblocks or deletes.

A proposal whose only basis is taste is not a proposal.
Prefer the option that deletes more than it adds.

## Report

Write the report to `tmp/audits/<slug>-architecture.md`, creating the directory if needed.
`tmp/` is gitignored; the report is ephemeral.

Structure, in this order:

1. Title, the area, and the reviewed commit hash.
2. Scope read: specs, decisions, packages, deferred entries, and the history range.
3. The map: the area as it is (§What to look for).
4. Findings for items 2–4, each with evidence.
5. Proposals, at most three, each with its options.

## After the report

Deliver the report and stop.
Do not change code or write a decision in the review session.

The human decides each proposal.

- Accepted: a decision is written or updated per `agents/DECISIONS.md`, and a task implements it per `agents/TASKS.md`.
- Rejected: the human picks where the rejection is recorded, usually Rejected designs of the area's decision,
  so the next review does not propose it again.

## Checklist

- [ ] Area restated and bounded.
- [ ] Deferred entries and git history for the area read; measurements cited.
- [ ] The map describes the code as it is.
- [ ] At most three proposals, each a draft decision.
- [ ] Every proposal has a seriously argued "do nothing" option.
- [ ] Every option states evidence, cost, net lines, risk, and reversibility.
- [ ] No code changed; report written to `tmp/audits/<slug>-architecture.md`.
