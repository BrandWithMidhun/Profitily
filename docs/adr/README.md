# Architecture Decision Records (ADRs)

Record any decision that deviates from the specs, changes the stack, sets a binding
convention, or **introduces a paid dependency** (required by the cost philosophy in
`docs/03-TECH-STACK.md`). Copy `../templates/ADR.md` to `NNNN-short-title.md`, fill it
in, and reference it from the relevant doc and PR.

## Index
- **0001 — Multi-currency: each store works in its own base currency** (Accepted) →
  `0001-multi-currency-store-base.md`
- _0002 — money as BigInt minor units (write when implemented in `packages/core`)_
- _0003 — Postgres+Timescale before ClickHouse (write at TASK-054)_

> Numbering is sequential and never reused.
