# 0001 — Multi-currency: each store works in its own base currency

- **Status:** Accepted
- **Date:** 2026-06-15
- **Deciders:** planner, reviewer

## Context
Merchants operate in different currencies, and Shopify can present orders in multiple
currencies that differ from the shop's own currency. The product must report true
profit per store without mixing currencies.

## Decision
- Every store has a single **`baseCurrency`**, read from the **Shopify shop settings at
  install** (not hardcoded). All profit math, snapshots, and dashboards for that store
  are computed and displayed in its base currency.
- Every money row stays **`BigInt` minor units + a `currency` code** (already the
  standard in `docs/04`/`docs/06`).
- At ingestion, if an order's **presentment currency differs from the store base
  currency**, amounts are **normalized to the base currency** using the exchange rate
  captured on the order from Shopify, and the base-currency amounts are what the engine
  consumes. The original presentment currency + amounts are retained for reference.
- **No cross-store currency mixing.** Each store is internally single-currency; the
  engine never adds two different currencies (the `Money` type enforces this).

## Consequences
- Simple, correct, and not over-engineered: no live FX service, no multi-currency
  ledgers per store. We rely on the rate Shopify already provides on the order.
- Cost configs (product/packaging/shipping rules/etc.) are entered in the store base
  currency.
- Agency users switching stores switch currency context with the store.
- If a future need arises for consolidated multi-store reporting across currencies,
  that's a separate, explicit task (would need an FX policy) — flag it then, don't
  build it now.

## Alternatives considered
- **Per-order native currency end to end** (no normalization): rejected — profit
  roll-ups across orders would mix currencies and be meaningless.
- **A global base currency for all stores with live FX:** rejected — over-engineered,
  adds an FX dependency, and misrepresents each merchant's real currency.
