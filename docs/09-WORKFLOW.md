# 09 — Workflow: Planner / Reviewer + Claude Code Executor

A **two-role loop** coordinated through git and standardized **templates**.

```
┌──────────────────────────┐   Build Request (template)   ┌──────────────────────────┐
│  Planning Claude (chat)  │ ───────────────────────────▶ │   Claude Code (terminal) │
│  • owns roadmap & specs  │                              │   • reads CLAUDE.md      │
│  • writes Build Requests │ ◀─────────────────────────── │   • branch→code→test→PR  │
│  • reviews PRs           │      PR (review template)     │                          │
└──────────────────────────┘                              └──────────────────────────┘
                  └──────────────── git repo (branches, PRs, docs) ───────────────┘
```

## Roles
**Planner / Reviewer (this Claude conversation)** — maintains `docs/07-PROJECT-PLAN.md`
and specs; issues one **Build Request** at a time; reviews returned PRs against
acceptance criteria, guardrails, and test requirements; approves or sends specific
changes; prevents scope creep.

**Executor (Claude Code)** — reads `CLAUDE.md` each session; implements the Build
Request on a branch (plan → tests → code → quality gates → docs); opens a PR with the
review template; waits for approval; never self-merges.

## The loop
1. **Plan turn.** Planner fills `docs/templates/BUILD-REQUEST.md` for the active task
   and pastes it to Claude Code.
2. **Execute turn.** Claude Code branches, posts a short implementation plan, builds,
   runs `lint typecheck test (+e2e/int as required) build`, commits (Conventional
   Commits), opens a PR using `docs/templates/PR-REVIEW.md`.
3. **Review turn.** Paste the PR/diff back to the planner. Planner applies the review
   checklist → APPROVE or change requests.
4. **Merge turn.** On approval, merge to `main`, delete branch; planner sets the task
   `DONE` and the next `ACTIVE TASK`.

## Reviewer checklist (every PR)
- [ ] Meets **all** acceptance criteria in the Build Request.
- [ ] **Test requirements met** — the right test types exist and pass (`docs/08`).
- [ ] Every tenant query scoped by `storeId`; isolation suite extended for new tables.
- [ ] Money is `BigInt` minor units; no floats; splits sum exactly.
- [ ] Webhooks/sync idempotent (replay test present).
- [ ] Pure logic in `packages/core`, unit + property tested.
- [ ] No new paid dependency without an ADR (cost philosophy upheld).
- [ ] `lint`, `typecheck`, `test`, `build` (+ `test:e2e`/`:int` when relevant) pass.
- [ ] Docs/`CLAUDE.md` updated for schema/API/convention changes.
- [ ] No secrets committed; `.env.example` updated for new config.
- [ ] No scope beyond the task.

## Keeping roles in sync
- **`CLAUDE.md` is the contract** — update it in the same change when conventions move.
- **The plan file is the memory** — statuses + `ACTIVE TASK` rehydrate a fresh session.
- **Templates standardize handoff** — requests, reviews, module specs, test plans,
  ADRs, and bug reports all have a fixed shape so nothing is forgotten.

## Rehydrating a fresh Claude Code session
> Read `CLAUDE.md` and `docs/07-PROJECT-PLAN.md`. State the current `ACTIVE TASK` and
> your implementation plan (files + tests) before writing code.
