# Ways of working

How this project is run **as if it were a real QA job** — not "code until it works",
but a repeatable lifecycle: ticket → branch → PR → CI → review → merge, on a sprint
cadence, with bugs, flaky tests, maintenance, and app changes handled the way a team
handles them.

> New here? Read this, then the [flaky policy](flaky-policy.md), [metrics](metrics.md),
> and the current sprint under [`docs/sprints/`](../sprints/). Contribution mechanics
> live in [CONTRIBUTING.md](../../CONTRIBUTING.md); the _why_ behind the architecture
> is in [ADRs](../adr/).
>
> 📘 **This file is a reference card — it assumes you already know the vocabulary.**
> To _learn_ the process itself (STLC, one ticket end-to-end, bug lifecycle, test-design
> techniques, who decides what), read [workflow-explained.md](workflow-explained.md) —
> the process-side counterpart to
> [framework-flow-explained.md](../framework-flow-explained.md).

## 1. Everything is a ticket

Work is tracked as **GitHub Issues** on a **Project (Kanban) board**. Nothing gets
coded without an issue — the same discipline as a real backlog.

**Issue types** (templates in `.github/ISSUE_TEMPLATE/`):

| Template             | Label               | When                                            |
| -------------------- | ------------------- | ----------------------------------------------- |
| 🐞 Bug report        | `type/bug`          | A defect in the app under test or the framework |
| ✨ Feature test task | `type/feature-test` | Automate a new/untested flow                    |
| 🎲 Flaky test        | `type/flaky`        | A non-deterministic test to quarantine + fix    |
| 🧹 Tech debt         | `type/tech-debt`    | Refactor, dependency/version bump, CI upkeep    |

**Labels** are version-controlled in [`.github/labels.yml`](../../.github/labels.yml)
and synced automatically (`type/*`, `priority/P0–P3`, `status/*`, `area/*`).

**Board columns:** `Backlog → Ready → In progress → In review → Done`.

### Severity vs Priority

Two different questions, deliberately kept separate — **severity** is decided by the
tester from evidence, **priority** is a business call that can override it.

|              | Question it answers                               | Who sets it                      |
| ------------ | ------------------------------------------------- | -------------------------------- |
| **Severity** | How bad is the technical impact if it happens?    | Reporter (QA), from the evidence |
| **Priority** | How soon must it be fixed, given everything else? | Whoever owns the backlog         |

**Severity scale** (used in [`docs/bug-reports/`](../bug-reports/)):

| Severity     | Meaning                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------- |
| **Critical** | Data loss/exposure, auth bypass, or the core purchase flow is impossible. No workaround. |
| **High**     | A main flow is broken or silently wrong; a workaround exists but is not obvious.         |
| **Medium**   | A secondary flow is wrong, or a main flow is wrong only in an edge case.                 |
| **Low**      | Cosmetic, wording, or a rare edge case with no user impact.                              |

**Priority scale** (the `priority/P0–P3` labels):

| Priority | Expectation                                                      |
| -------- | ---------------------------------------------------------------- |
| **P0**   | Drop everything — `main` is red, or the suite cannot run at all. |
| **P1**   | Committed to the current sprint.                                 |
| **P2**   | Next sprint / when the area is touched anyway.                   |
| **P3**   | Backlog; may never be done, and that is a valid outcome.         |

> The two are **not** a straight line. [BUG-001](../bug-reports/BUG-001-registration-drops-security-answer.md)
> is `High` severity but only `P2` — the data loss is real, but it affects a rarely used
> account-recovery path. Conversely a `Low`-severity typo on the checkout button could be
> `P1` if it is on every screenshot in a demo. **Never merge the two into one field** —
> doing so is how "important but not urgent" bugs get lost.

## 2. Sprint cadence (2 weeks)

Each sprint is a GitHub **Milestone**. One planning issue, one retro per sprint.

1. **Planning** — pull 3–5 issues from the backlog into the milestone; set a sprint goal.
2. **Build** — work the board; keep WIP low (finish before starting).
3. **Review / demo** — update Allure + write the sprint [test report](metrics.md).
4. **Retro** — record what to keep/change in [`docs/sprints/`](../sprints/) (use the
   [retro template](../sprints/retro-template.md)).

## 3. Branch & PR flow

**No direct commits to `main`.** Every change:

1. Branch off `main`: `feat/<ticket>`, `fix/<ticket>`, `flaky/<ticket>`, `chore/<ticket>`.
2. One **ticket per PR**, kept small. Fill in the PR template; link the issue (`Closes #NN`).
3. **Self-review** the diff before requesting review — read it as a reviewer would.
4. CI must be **green** (checks + smoke; nightly for cross-browser).
5. Squash-merge, delete the branch.

### Branch protection (one-time setup on GitHub)

Settings → Branches → Add rule for `main`:

- ✅ Require a pull request before merging
- ✅ Require status checks to pass → select **`checks`** and **`smoke`**
- ✅ Require branches to be up to date before merging
- ✅ (optional) Require conversation resolution

> Full click-by-click setup for labels, the board, the backlog, and this rule:
> [github-setup.md](github-setup.md).

### When `main` goes red

Branch protection makes this rare, but nightly runs and flaky tests can still break it.
A red `main` blocks everyone, so it outranks whatever is in progress:

1. **Stop merging.** No new PRs go in while `main` is red — a second change on top makes
   the cause ambiguous.
2. **Revert first, diagnose second.** If a specific commit is implicated, revert it to get
   back to green, then investigate from a branch. Rolling forward with a speculative fix
   is only acceptable when the fix is obvious and small.
3. **File it as `P0`.** Even if it is fixed in ten minutes — the ticket is what makes the
   incident visible in the sprint metrics.
4. **Decide: bug or flake?** A real regression → a test correctly caught it, fix the code.
   A non-deterministic failure → it goes through the [flaky policy](flaky-policy.md)
   (quarantine + root-cause), **not** a retry bump to make the red go away.
5. **Close the loop.** Whatever the cause, something must prevent a silent repeat: a
   regression test, a stricter check, or a documented quirk in
   [exploratory-notes.md](../exploratory-notes.md).

> The rule behind all five: **a red pipeline that people learn to ignore is worse than no
> pipeline at all.** Red must always mean "stop and look".

## 4. Definition of Ready / Done

**Ready** (before work starts): clear acceptance criteria, priority set, dependencies known.

**Done** (before merge):

- Follows the test rules — per-test data (parallel-safe), **no hard waits**, tagged for CI.
- `npm run typecheck && npm run lint && npm run test:unit` pass; relevant suite green (chromium) + CI green.
- Traceability updated (`docs/test-cases.md`) if coverage changed.
- Bug → a regression test locks the fix. Flaky → root-caused, not just retried.
- Docs updated (counts, ADR if a structural decision).

## 5. The five work streams

A real QA role isn't one activity — it's these, every sprint:

| Stream            | What it looks like here                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| **Feature cover** | Pick an untested Juice Shop flow from the [backlog](backlog.md) → cases → automate.            |
| **Bug lifecycle** | Find → report (issue + `docs/bug-reports/`) → regression test → verify fix → close.            |
| **Flaky mgmt**    | Detect → quarantine (`@flaky`) → root-cause → fix → un-quarantine ([policy](flaky-policy.md)). |
| **Maintenance**   | Review/merge Dependabot PRs; bump the pinned Juice Shop image (upgrade guard).                 |
| **Reporting**     | Sprint [test report + metrics](metrics.md); keep Allure trend healthy.                         |

## 6. Simulating app change

Juice Shop is pinned (`v17.1.1`), so "the app changed" is simulated two ways:

- **Feature drop** — take an existing-but-untested flow, write a short feature spec as
  if a PM handed it over, and run the full cycle. (Backlog is pre-seeded with these.)
- **Version bump** — periodically bump the pinned image, then handle broken selectors /
  new challenges exactly like a production upgrade (the "upgrade guard"). File it as a
  `type/tech-debt` ticket.

Both are on the [backlog](backlog.md).
