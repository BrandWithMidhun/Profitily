# 09 — Build Process (Planner ↔ Claude Code Loop)

This is the **exact, step-by-step process** for building each module/task. Two roles,
seven steps, coordinated through git and standardized templates. Nothing gets built
until a plan is reviewed; nothing merges until a summary + test report is reviewed.

## Roles
- **Planner / Reviewer** = this Claude conversation. Owns the roadmap and specs.
  Issues planning prompts, reviews plans, issues build requests, reviews summaries +
  test reports, approves/merges, advances the board.
- **Executor** = Claude Code in the repo. Produces plans, builds, tests, and reports.
  Never self-approves.

## The loop (per task / module)

```
            ┌─────────────────────────────────────────────────────────────┐
            │                         PER TASK                              │
            │                                                               │
  (1) Planner - Planning Prompt --> (2) Claude Code - Implementation Plan -+|
            │                                                            │  │
            │  <--------------- (3) Planner reviews plan <---------------+  │
            │        │ changes? -> back to (2)       │ approved             │
            │        v                               v                      │
            │  (4) Planner - Build Request --> (5) Claude Code builds+tests │
            │                                       │                       │
            │           (6) Claude Code - Build Summary + Test Report ----->│
            │                                       │                       │
            │  (7) Planner reviews summary + report │                       │
            │        │ changes? -> back to (5)      │ approved              │
            │        v                              v                       │
            │   (iterate on same branch)      merge -> mark DONE            │
            └───────────────────────────────────────┬───────────────────────┘
                                                     v
                                       advance to next module/task -> (1)
```

## Step-by-step

### (1) Planner -> Claude Code: **Planning Prompt**
Template: `docs/templates/PLANNING-PROMPT.md`. The planner gives the task id, goal, the
spec sections to read, dependencies, and asks Claude Code to **produce a plan, not
code**. For UI tasks it also points to the matching `design/` drop (see
`docs/11-UI-DEVELOPMENT.md`).

### (2) Claude Code -> Planner: **Implementation Plan**
Template: `docs/templates/IMPLEMENTATION-PLAN.md`. Claude Code reads `CLAUDE.md` + the
referenced specs and returns: files to create/change, approach, interfaces/contracts,
**test plan** (which test types from `docs/08-TESTING.md`), data/migration impact,
risks, ordered steps, and open questions. **No code is written yet.**

### (3) Planner: **Review the plan**
Planner checks the plan against the spec, module boundaries, guardrails, and test
coverage. **Changes requested -> back to (2).** When the plan is sound -> proceed. This
catches design problems before any code exists (cheapest place to fix them).

### (4) Planner -> Claude Code: **Build Request**
Template: `docs/templates/BUILD-REQUEST.md`. The planner locks the approved scope into a
build request: final acceptance criteria, the agreed interfaces, and the explicit
**test requirements**. This is the contract Claude Code builds to.

### (5) Claude Code: **Build + Test**
On a branch `task/TASK-XXX-slug`: implement (TDD for `packages/core`), then run the
required gates - `pnpm lint typecheck test` plus `test:int`, `test:e2e`,
`test:contract`, etc. as the request specifies. Commit in atomic Conventional Commits.

### (6) Claude Code -> Planner: **Build Summary + Test Report**
Template: `docs/templates/BUILD-SUMMARY.md`. Claude Code returns: what was built, how it
maps to each acceptance criterion, and a **test report** - results per test type,
coverage %, mutation score (if core), e2e/visual/a11y outcomes, load numbers,
security-scan results - plus deviations from the plan and any follow-ups. The PR body
uses `docs/templates/PR-REVIEW.md`; the Build Summary is what's pasted back to the
planner.

### (7) Planner: **Review summary + test report -> advance or iterate**
Planner verifies every acceptance criterion is met, the right tests exist **and pass**,
the test report is credible (no skipped/quarantined tests hiding failures), and all
guardrails hold (tenant scoping, money integers, idempotency, no unapproved paid deps).
- **Changes needed -> specific change requests -> back to (5)** (same branch).
- **All good -> APPROVE -> merge to `develop`** (PR target), delete branch, mark task
  `DONE`, set the next `ACTIVE TASK`, move to the next module/task (back to (1)). The
  merge **auto-deploys to Railway staging** once CI passes (`docs/12 §7`); releases
  promote `develop -> main` to deploy production.

## Gates

**Definition of Ready (before step 4):** plan approved; dependencies `DONE`; acceptance
criteria and test requirements unambiguous; for UI tasks, the `design/` drop exists.

**Definition of Done (after step 7):** acceptance criteria met; all required tests
green; coverage/mutation targets held; `lint typecheck test build` (+ e2e/int as
pass; docs + `CLAUDE.md` updated; PR merged into `develop` via review (auto-deploys
staging); no scope creep.

## Stop-and-flag (can interrupt any step)

At **any** point in the loop, if Claude Code hits ambiguity, conflicting sources, a
security/data risk, scope creep, a destructive action, or a new/paid dependency, it
**stops and raises a flag** (`docs/templates/FLAG.md`, `docs/14 §4`) instead of
guessing. The planner reviews the flag, decides (updating `CLAUDE.md`/specs if it's a
lasting rule), and replies; then the loop resumes. Flags are expected and welcome — a
correct early flag is far cheaper than unwinding a wrong guess.

```
any step ── doubt/risk/conflict ──▶ 🚩 Flag ──▶ Planner reviews & decides ──▶ resume
```

## Reviewer checklist (steps 3 and 7)
- [ ] Plan/build matches the spec and stays inside the module's boundary.
- [ ] **No over-engineering** — simplest solution that meets the spec; no speculative
      abstraction/feature (`docs/14`).
- [ ] **Security** holds (`docs/13`): input validated, tokens encrypted, authz
      default-deny, webhooks verified, no secrets/PII in logs.
- [ ] **Nothing ambiguous was silently guessed** — open questions were flagged.
- [ ] Test requirements covered with the right types (`docs/08-TESTING.md`) — and the
      report shows them passing, not skipped.
- [ ] Tenant queries scoped by `storeId`; isolation suite extended for new tables.
- [ ] Money `BigInt` minor units; no floats; splits sum exactly.
- [ ] Webhooks/sync idempotent (replay test present).
- [ ] Pure logic in `packages/core`, unit + property tested.
- [ ] No new paid dependency without an ADR.
- [ ] Docs/`CLAUDE.md` updated; no secrets committed; `.env.example` current.
- [ ] No scope beyond the build request.

## Why the extra plan step matters
Reviewing the **plan** before the **build** means design mistakes are caught as text,
not as code that must be unwound. Reviewing the **test report** before merge means
"done" is evidence-based. Both keep the loop fast and `main` always green.

## Rehydrating a fresh Claude Code session
> Read `CLAUDE.md` and `docs/07-PROJECT-PLAN.md`. State the current `ACTIVE TASK`. If I
> sent a Planning Prompt, return an Implementation Plan (no code). If I sent a Build
> Request, state your branch and build to it.
