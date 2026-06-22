# Architecture Decision Records (ADRs)

Record any decision that deviates from the specs, changes the stack, sets a binding
convention, or **introduces a paid dependency** (required by the cost philosophy in
`docs/03-TECH-STACK.md`). Copy `../templates/ADR.md` to `NNNN-short-title.md`, fill it
in, and reference it from the relevant doc and PR.

## Index
- **0001 — Multi-currency: each store works in its own base currency** (Accepted) →
  `0001-multi-currency-store-base.md`
- **0002 — Railway as the hosting provider (staging api + Timescale)** (Accepted) →
  `0002-railway-staging-deploy.md`
- **0003 — Frontend baseline: React 18.3 + Next 15 + Polaris ^13.9** (Accepted) →
  `0003-frontend-react-18-polaris-baseline.md`
- _0004 — money as BigInt minor units (write when implemented in `packages/core`)_
- _0005 — Postgres+Timescale before ClickHouse (write at TASK-054)_

> Numbering is sequential and never reused.
