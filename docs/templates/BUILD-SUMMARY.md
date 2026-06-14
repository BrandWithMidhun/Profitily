# Build Summary + Test Report — TASK-XXX: <title>

> Claude Code → Planner. **Step (6).** Paste this back after building. Accompanies the
> PR (whose body uses `docs/templates/PR-REVIEW.md`).

## 1. Summary
<What was built, in 2–4 sentences.>

Branch: `task/TASK-XXX-<slug>` · Commits: <n> · PR: <link/diff>

## 2. Acceptance criteria — evidence
| Criterion | Met? | Proof (file / test / screenshot) |
|---|---|---|
| <criterion> | ✅/❌ | <…> |

## 3. Test report
| Type | Tool | Result | Notes |
|---|---|---|---|
| Lint / Typecheck | eslint / tsc | pass/fail | — |
| Unit | Vitest | <n passed / n> | coverage <…>% |
| Property | fast-check | pass/fail | runs: <n> |
| Integration | Testcontainers | <n passed / n> | services: PG/Redis/MinIO |
| Contract | Pact | pass/fail | boundary: <…> |
| Component | RTL | <n/n> | — |
| E2E | Playwright | <n/n> | journeys: <…> |
| Visual / a11y | Playwright / axe | pass/fail | new violations: <n> |
| Load | k6 | p95 <…>s | scenario: <…> |
| Security | Semgrep/Gitleaks/audit | clean? | findings: <…> |
| Mutation (core) | Stryker | score <…>% | target ≥85% |

**Skipped / quarantined tests:** <none / list with reason> (none hidden).

## 4. Deviations, assumptions & open flags
- **Deviations from the plan:** <none / list each with reason.>
- **Assumptions made:** <none / any assumption made where the spec was thin — disclose
  it so the planner can confirm; if it was material it should have been a flag.>
- **Open flags:** <none / link any `FLAG` still awaiting a decision.>

## 4a. Security & simplicity self-check
- [ ] Input validated; tokens/secrets handled per `docs/13`; authz default-deny;
      webhooks verified; no secrets/PII in logs.
- [ ] No over-engineering — simplest solution that meets the criteria (`docs/14`).

## 5. Docs updated
- [ ] `docs/<…>` · [ ] `CLAUDE.md` (if conventions changed) · [ ] `.env.example`

## 6. Follow-ups / new tasks proposed
- <out-of-scope items discovered → suggested TASK-XXX>

## 7. Decision requested
Approve & merge, or list changes (I'll iterate on the same branch).
