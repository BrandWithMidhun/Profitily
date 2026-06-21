# 16 — Progress & Completed Modules (Build Log)

> **Living log.** Updated at **step 7** of the build loop (`docs/09-WORKFLOW.md`) — i.e.
> when a task's PR is **merged**, not when it opens. It records what shipped, the
> security controls applied, and the tests that covered it. Cross-references:
> the execution board (`docs/07-PROJECT-PLAN.md`), the testing strategy
> (`docs/08-TESTING.md`), and the security baseline (`docs/13-SECURITY.md`).
>
> A task in `REVIEW` on the board appears here only after it merges to `develop`.

---

## Phase status

| Phase | Theme | Tasks done / total |
|---|---|---|
| Phase 0 | Foundation | 0 / 8 |
| Phase 1 | Shopify App, Auth & Billing | 0 / 5 |
| Phase 2 | Data Ingestion | 0 / 4 |
| Phase 3 | Cost Management & Shipping Engine | 0 / 4 |
| Phase 4 | Shipping & Ad Integrations | 0 / 2 |
| Phase 5 | Profit & Allocation Engine | 0 / 5 |
| Phase 6 | Dashboards & Reporting | 0 / 5 |
| Phase 7 | AI Layer | 0 / 5 |
| Phase 8 | Hardening & Launch | 0 / 6 |

> TASK-001 is in `REVIEW` (PR open into `develop`); it flips to **done** here once
> merged.

---

## Completed log

### TASK-001 — Monorepo scaffolding (pnpm + Turborepo + shared config)
- **Date:** 2026-06-21
- **Branch:** `task/TASK-001-monorepo-scaffold` → `develop`
- **What shipped:**
  - Root pnpm + Turborepo workspace: `pnpm-workspace.yaml` (`apps/*`, `packages/*`),
    `turbo.json` (build/lint/typecheck/test/dev tasks), root scripts
    (`lint`/`typecheck`/`test`/`build`/`dev`/`format`).
  - `packages/config`: shared presets — TypeScript base (`tsconfig.base.json`,
    strict), ESLint 9 flat config with **`eslint-plugin-security`**, Prettier preset,
    Vitest preset — plus `src/index.ts` and one Vitest sanity test.
  - Root configs consuming the presets (`eslint.config.mjs`, `prettier.config.mjs`,
    `tsconfig.json`, `vitest.config.ts`).
  - Toolchain pins & hygiene: Node engines `>=22`, `.nvmrc` = `24`, pnpm pinned via
    `packageManager` (11.x), `.npmrc` (`engine-strict`), `.editorconfig`,
    `.prettierignore`, committed `pnpm-lock.yaml`.
- **Security controls applied:** `eslint-plugin-security` active in the shared ESLint
  preset (verified: a probe call to `child_process.exec` tripped
  `security/detect-child-process`, then removed); `engine-strict` enforces the Node
  floor; reproducible installs from the committed lockfile. No secrets introduced.
- **Test cases covered:** static gates green — `pnpm lint`, `pnpm typecheck`,
  `pnpm build` (no build tasks yet on the empty workspace), `pnpm test`. The Vitest
  preset is proven by the `@profitily/config` sanity test (1 passed); `passWithNoTests`
  keeps future empty packages green.
- **Follow-ups:** CI pipeline to run these gates on PRs — **TASK-006**; coverage
  thresholds / first engine coverage — **TASK-050** (and harness in **TASK-007**).

---

## Module completion matrix

| Module | Status | Tasks | Key tables | Security verified | Tests |
|---|---|---|---|---|---|
| M00 Platform / Shared | in progress | TASK-001 (REVIEW), 002–008 | — | eslint-plugin-security active; engine-strict; frozen lockfile | sanity (Vitest) green; static gates green |
