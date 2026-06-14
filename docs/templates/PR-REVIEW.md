# Pull Request — TASK-XXX: <title>

## Summary
<What this PR does, in 1–3 sentences.>

## Changes
- <key change>
- <key change>

## How it maps to acceptance criteria
| Acceptance criterion | Where met / proof |
|---|---|
| <criterion> | <file / test name> |

## Tests run (state results)
- [ ] `pnpm lint` · `pnpm typecheck`
- [ ] `pnpm test` (unit + property + component) — coverage: <n>%
- [ ] `pnpm test:int` (Testcontainers) — flows: <…>
- [ ] `pnpm test:contract` — boundary: <…>
- [ ] `pnpm test:e2e` — journey: <…>
- [ ] Other (a11y / load / security / mutation): <…>
- [ ] `pnpm build`

## Guardrail self-check
- [ ] All tenant queries scoped by `storeId`; isolation suite extended if needed
- [ ] Money `BigInt` minor units; no floats; splits sum exactly
- [ ] Idempotent webhooks/sync (replay test) — if applicable
- [ ] No new paid dependency (or ADR attached: `docs/adr/NNNN-…`)
- [ ] No secrets committed; `.env.example` updated

## Docs updated
- [ ] `docs/<…>` · [ ] `CLAUDE.md` (if conventions changed) · [ ] n/a

## Deviations from the Build Request
<None / list each deviation and why.>

## Open questions for the reviewer
<None / list.>
