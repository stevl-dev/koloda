import { describe, expect, it } from "vitest";
import { checkState, landingBranch, taskGateProblems, taskSlug, waitStep } from "./land.ts";
import type { CheckRun, TaskCommit } from "./land.ts";

const sha = "0123456789abcdef0123456789abcdef01234567";

function checkRun(overrides: Partial<CheckRun>): CheckRun {
  return {
    status: "completed",
    conclusion: "success",
    html_url: "https://github.com/o/r/runs/1",
    app: { slug: "github-actions" },
    ...overrides,
  };
}

const slug = "entity-notes";
const live = `tasks/live/${slug}.md`;
const archived = `tasks/archive/${slug}.md`;

const archiveDone = `# Entity notes

Status: done
Guides: none

## Outcome

Notes shipped.

Spec: none — notes have no user-visible behavior yet
Review: none
Change rounds: 0
`;

function commit(overrides: Partial<TaskCommit>): TaskCommit {
  return { trailers: [slug], changes: ["M src/app.ts"], ...overrides };
}

const addCommit = commit({ changes: [`A ${live}`] });
const workCommit = commit({});
const archiveCommit = commit({ changes: [`A ${archived}`, `D ${live}`] });
const train = [addCommit, workCommit, archiveCommit];

describe("landingBranch", () => {
  it("keeps a task branch", () => {
    expect(landingBranch("task/entity-notes", sha)).toBe("task/entity-notes");
  });

  it("uses a land branch from main or a detached HEAD", () => {
    expect(landingBranch("main", sha)).toBe("land/01234567");
    expect(landingBranch(null, sha)).toBe("land/01234567");
  });
});

describe("taskSlug", () => {
  it("reads the slug from a task branch", () => {
    expect(taskSlug("task/entity-notes", [])).toBe("entity-notes");
  });

  it("reads the slug from the trailers when the branch is not a task branch", () => {
    expect(taskSlug("main", [commit({})])).toBe("entity-notes");
    expect(taskSlug(null, [commit({})])).toBe("entity-notes");
  });

  it("is null when nothing names a task", () => {
    expect(taskSlug("main", [commit({ trailers: [] })])).toBeNull();
  });
});

describe("taskGateProblems", () => {
  it("passes a train of Add, work, then Archive", () => {
    expect(taskGateProblems(slug, train, archiveDone)).toEqual([]);
  });

  it("rejects a commit without this task's trailer", () => {
    const problems = taskGateProblems(slug, [addCommit, commit({ trailers: [] }), archiveCommit], archiveDone);
    expect(problems).toEqual([expect.stringContaining("commit 2 must carry exactly one")]);
  });

  it("rejects a commit that names another task", () => {
    const problems = taskGateProblems(slug, [addCommit, commit({ trailers: ["other"] }), archiveCommit], archiveDone);
    expect(problems).toEqual([expect.stringContaining("commit 2 must carry exactly one")]);
  });

  it("requires the Add commit to be the oldest", () => {
    const problems = taskGateProblems(slug, [workCommit, addCommit, archiveCommit], archiveDone);
    expect(problems).toEqual([expect.stringContaining("the oldest commit must be the Add commit")]);
  });

  it("requires the Archive commit to be the newest and to move the live file", () => {
    const problems = taskGateProblems(slug, [addCommit, archiveCommit, workCommit], archiveDone);
    expect(problems).toEqual([expect.stringContaining("the newest commit must be the Archive commit")]);
    const noMove = commit({ changes: [`A ${archived}`] });
    expect(taskGateProblems(slug, [addCommit, noMove], archiveDone)).toEqual([
      expect.stringContaining("the newest commit must be the Archive commit"),
    ]);
  });

  it("rejects an archive that is not done or has no Outcome", () => {
    const notDone = archiveDone.replace("Status: done", "Status: ready");
    expect(taskGateProblems(slug, train, notDone)).toEqual([expect.stringContaining("Status: done")]);
    const noOutcome = archiveDone.slice(0, archiveDone.indexOf("Notes shipped."));
    expect(taskGateProblems(slug, train, noOutcome)).toEqual([
      expect.stringContaining("fill in Outcome"),
      expect.stringContaining("`Review:`"),
      expect.stringContaining("`Change rounds: <N>`"),
      expect.stringContaining("`Spec:`"),
    ]);
  });

  it("requires a Review line with a value in Outcome", () => {
    const noReview = archiveDone.replace("Review: none\n", "");
    expect(taskGateProblems(slug, train, noReview)).toEqual([`${archived} must have a \`Review:\` line in Outcome`]);
    const emptyReview = archiveDone.replace("Review: none", "Review:");
    expect(taskGateProblems(slug, train, emptyReview)).toEqual([expect.stringContaining("`Review:`")]);
  });

  it("requires a Change rounds line with a whole number in Outcome", () => {
    const noRounds = archiveDone.replace("Change rounds: 0\n", "");
    expect(taskGateProblems(slug, train, noRounds)).toEqual([
      `${archived} must have a \`Change rounds: <N>\` line in Outcome`,
    ]);
    for (const value of ["", "two", "1.5"]) {
      const badRounds = archiveDone.replace("Change rounds: 0", `Change rounds: ${value}`);
      expect(taskGateProblems(slug, train, badRounds)).toEqual([expect.stringContaining("`Change rounds: <N>`")]);
    }
  });

  it("finds the Review and Change rounds lines anywhere in Outcome", () => {
    const linesFirst = archiveDone.replace(
      "Review: none\nChange rounds: 0\n",
      "Review: none\nChange rounds: 2\n\n### Skipped findings\n\n- 3. Risk, Later: kept as is.\n",
    );
    expect(taskGateProblems(slug, train, linesFirst)).toEqual([]);
  });

  it("rejects a tip without the archive file", () => {
    expect(taskGateProblems(slug, train, null)).toEqual([expect.stringContaining("is missing at the tip")]);
  });

  describe("Spec line", () => {
    const spec = "docs/specs/NOTES.md";
    const specCommit = commit({ changes: [`M ${spec}`, "M src/app.ts"] });
    const specTrain = [addCommit, specCommit, archiveCommit];
    const withSpec = (value: string) =>
      archiveDone.replace("Spec: none — notes have no user-visible behavior yet", `Spec: ${value}`);

    it("passes the specs the task changed", () => {
      const other = "docs/specs/DECKS.md";
      const twoSpecs = [addCommit, specCommit, commit({ changes: [`M ${other}`] }), archiveCommit];
      expect(taskGateProblems(slug, twoSpecs, withSpec(`${spec}, ${other}`))).toEqual([]);
    });

    it("is required in Outcome", () => {
      const noSpec = archiveDone.replace(/^Spec: .*\n/m, "");
      expect(taskGateProblems(slug, train, noSpec)).toEqual([`${archived} must have a \`Spec:\` line in Outcome`]);
    });

    it("rejects none without a reason", () => {
      for (const value of ["none", "none —", "none, see the diff"]) {
        expect(taskGateProblems(slug, train, withSpec(value))).toEqual([
          expect.stringContaining("must give a reason after `Spec: none —`"),
        ]);
      }
    });

    it("rejects none when a commit changes a spec", () => {
      expect(taskGateProblems(slug, specTrain, archiveDone)).toEqual([
        `${archived} says \`Spec: none\`, but the task changes ${spec}`,
      ]);
    });

    it("rejects a named spec that no commit changes", () => {
      expect(taskGateProblems(slug, specTrain, withSpec(`${spec}, docs/specs/DECKS.md`))).toEqual([
        `${archived} names docs/specs/DECKS.md in \`Spec:\`, but no commit of the task changes it`,
      ]);
    });
  });
});

describe("checkState", () => {
  it("is missing until GitHub Actions reports a run", () => {
    expect(checkState([])).toEqual({ kind: "missing" });
    expect(checkState([checkRun({ app: { slug: "other-app" } })])).toEqual({ kind: "missing" });
  });

  it("is pending while the run is not completed", () => {
    expect(checkState([checkRun({ status: "in_progress", conclusion: null })]).kind).toBe("pending");
  });

  it("passes only on success", () => {
    expect(checkState([checkRun({})]).kind).toBe("success");
    expect(checkState([checkRun({ conclusion: "cancelled" })])).toEqual({
      kind: "failure",
      url: "https://github.com/o/r/runs/1",
      conclusion: "cancelled",
    });
  });
});

describe("waitStep", () => {
  const minute = 60_000;
  const pending = { kind: "pending", url: "https://github.com/o/r/runs/1" } as const;

  it("keeps waiting through a failed poll after the run appeared", () => {
    expect(waitStep(null, true, 4 * minute, sha)).toEqual({ kind: "wait" });
    expect(waitStep({ kind: "missing" }, true, 4 * minute, sha)).toEqual({ kind: "wait" });
  });

  it("fails when no run appeared within three minutes, failed polls included", () => {
    expect(waitStep(null, false, 3 * minute, sha)).toEqual({ kind: "wait" });
    for (const state of [null, { kind: "missing" } as const]) {
      expect(waitStep(state, false, 3 * minute + 1, sha)).toEqual({
        kind: "fail",
        message: expect.stringContaining("no `checks` run appeared for 01234567"),
      });
    }
  });

  it("fails a run still going after thirty minutes", () => {
    expect(waitStep(pending, true, 30 * minute, sha)).toEqual({ kind: "wait" });
    expect(waitStep(pending, true, 30 * minute + 1, sha)).toEqual({
      kind: "fail",
      message: expect.stringContaining("still running on 01234567"),
    });
  });

  it("ends on the run's conclusion", () => {
    expect(waitStep({ kind: "success", url: pending.url }, true, 0, sha)).toEqual({ kind: "done" });
    expect(waitStep({ kind: "failure", url: pending.url, conclusion: "cancelled" }, true, 0, sha)).toEqual({
      kind: "fail",
      message: `\`checks\` cancelled on 01234567: ${pending.url}`,
    });
  });
});
