# 0003 — Frontend baseline: React 18.3 + Next 15 + Polaris ^13.9 (both apps)

- **Status:** Accepted
- **Date:** 2026-06-22
- **Deciders:** planner, reviewer

## Context
The two frontend surfaces are `apps/web` (Tailwind portal) and `apps/shopify-app`
(embedded app, **Shopify Polaris**). At scaffold time (TASK-005) the "latest" frontend
stack is **Next 16 / React 19**, but **`@shopify/polaris@13.9.5` peer-depends
`react: ^18.0.0`** — it does not support React 19. The Polaris React component library is
**archived/frozen at React 18** as Shopify moves toward Polaris **web components**. We
need a single, coherent React baseline across the monorepo for skeletons that build and
boot.

## Decision
- Pin **React 18.3 + Next 15 + `@shopify/polaris` ^13.9 across BOTH apps.**
- `apps/web` depends on Tailwind (+ `@tailwindcss/postcss`) and **not** Polaris;
  `apps/shopify-app` depends on Polaris and **not** Tailwind/shadcn — the split is
  structural (dependency-level), not convention.
- Polaris is rendered via `AppProvider` only (no App Bridge/host yet; real embedding +
  session is TASK-010/011).

## Consequences
- One React major (18.3) across the repo → simpler mental model, shared patterns, no
  dual-React maintenance.
- The embedded app's component library (Polaris React) is **deprecated-but-stable**. We
  accept staying on React 18 for the frontend until we either adopt **Polaris web
  components** or deliberately **decouple `apps/web` to React 19** (a separate, explicit
  future task — not built now).
- `apps/web` could technically run React 19 today (no Polaris), but we keep it on 18.3
  for consistency with `apps/shopify-app`.

## Alternatives considered
- **`apps/web` on React 19, `apps/shopify-app` on React 18:** rejected — two React majors
  in the monorepo for skeletons; added complexity with no near-term benefit.
- **Force Polaris onto React 19 via peer override:** rejected — unsupported upstream;
  risks runtime incompatibilities in an archived library.
