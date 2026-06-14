# 05 — Module Planning

The system is split into **bounded contexts (modules)**. Each module has a single
responsibility, owns its tables, exposes a narrow public interface, and depends only
on modules below it. This keeps work parallelizable and reviews focused — a Build
Request usually targets one module.

## 1. Module map (dependency direction is downward)

```
            ┌───────────────────────────── apps/web · apps/shopify-app (UI) ─────────────────────────────┐
            │  Dashboards · Setup Wizard · AI Hub · Reports UI · Settings                                  │
            └──────────────────────────────────────────┬──────────────────────────────────────────────────┘
                                                        │ REST / typed API (apps/api)
 ┌──────────────┬──────────────┬──────────────┬─────────┴────────┬──────────────┬──────────────┬───────────┐
 │  M13 AI      │ M12 Reporting│ M11 Alerts   │ M10 Dashboards   │ M14 Notif.   │              │           │
 ├──────────────┴──────────────┴──────────────┴──────────────────┴──────────────┤              │           │
 │                          M09 Analytics & Snapshots (read models)               │              │           │
 ├───────────────────────────────────────────────────────────────────────────────┤              │           │
 │                          M08 Profit Engine (packages/core)                      │              │           │
 ├──────────────┬──────────────┬──────────────┬──────────────┬────────────────────┤              │           │
 │ M06 Cost Mgmt│ M07 Shipping │ M05 Ads &    │ M04 Orders   │ M03 Catalog        │              │           │
 │              │ (rules+integ)│ Allocation   │              │                    │              │           │
 ├──────────────┴──────────────┴──────────────┴──────────────┴────────────────────┤              │           │
 │                          M02 Shopify Integration (sync, webhooks)               │              │           │
 ├───────────────────────────────────────────────────────────────────────────────┤              │           │
 │  M01 Identity & Tenancy (Store/User/Membership/Auth) · M15 Billing & Plans      │              │           │
 ├───────────────────────────────────────────────────────────────────────────────┴──────────────┴───────────┤
 │                M00 Platform/Shared: config, logging, queue, tenant guard, Money, observability             │
 └────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Module specs

For each: **Responsibility · Owns (tables) · Public interface · Depends on · Events ·
Location · Test focus.** Use `docs/templates/MODULE-SPEC.md` when adding a module.

### M00 — Platform / Shared
- **Responsibility:** cross-cutting primitives — typed config, Pino logging, BullMQ
  setup, **tenant guard** (Prisma extension), `Money` value object, OTel instrumentation.
- **Owns:** `ProcessedEvent` (idempotency ledger).
- **Interface:** `Money`, `withTenant(storeId)`, `enqueue(job)`, `logger`, `config`.
- **Depends on:** nothing.
- **Location:** `packages/shared`, `packages/config`, parts of `apps/api/common`.
- **Test focus:** tenant guard rejects unscoped queries; Money arithmetic/splits.

### M01 — Identity & Tenancy
- **Responsibility:** stores, users, memberships, auth (JWT + Shopify session),
  tenant resolution.
- **Owns:** `Store, User, Membership`.
- **Interface:** `resolveTenant(req)`, `issueSession`, `requireRole`.
- **Depends on:** M00.
- **Events:** `store.installed`, `store.uninstalled`.
- **Test focus:** agency user → multiple stores; isolation; auth guards.

### M15 — Billing & Plans
- **Responsibility:** Shopify managed billing, plan tiers, plan-gating middleware.
- **Owns:** `Subscription`.
- **Interface:** `getPlan(storeId)`, `requireTier(tier)`, `onChargeUpdate`.
- **Depends on:** M01.
- **Events:** `plan.changed`.
- **Test focus:** gating blocks under-tier routes; up/downgrade; dunning.

### M02 — Shopify Integration
- **Responsibility:** OAuth, webhook registration/verification, historical backfill,
  real-time sync orchestration.
- **Owns:** `SyncState` (shopify rows); writes via M03/M04.
- **Interface:** `installFlow`, `handleWebhook(topic,payload)`, `backfill(range)`.
- **Depends on:** M00, M01.
- **Events:** `order.synced`, `product.synced`, `refund.synced`.
- **Test focus:** HMAC verify; idempotent enqueue; resumable backfill; rate-limit backoff.

### M03 — Catalog
- **Owns:** `Product, Variant, InventoryLevel, Customer`.
- **Interface:** `upsertProduct/Variant`, `getVariant`, `setReorderPoint`.
- **Depends on:** M00, M02.
- **Test focus:** normalize payloads; unique upserts; inventory updates.

### M04 — Orders
- **Owns:** `Order, OrderLine, Refund, Transaction, Discount`.
- **Interface:** `upsertOrder`, `applyRefund`, `recordTransaction`.
- **Depends on:** M00, M02, M03.
- **Events:** `order.upserted` (triggers profit recompute).
- **Test focus:** idempotent order upsert; refund linkage; line mapping.

### M06 — Cost Management
- **Owns:** `ProductCost, PackagingCost, FulfillmentCost, PaymentCostRule,
  OperationalExpense, AdditionalFee`.
- **Interface:** CRUD + `resolveProductCost(variant, date)`, `resolvePackaging(order)`,
  `paymentFee(order)`, CSV/bulk import.
- **Depends on:** M00, M03.
- **Test focus:** temporal cost resolution; CSV validation/partial apply.

### M07 — Shipping (rules + integrations)
- **Owns:** `ShippingRule, ShipmentCost, ShippingIntegration`.
- **Interface:** `resolveShipping(order)` (actual ?? rule engine), rule CRUD/reorder,
  provider sync.
- **Depends on:** M00, M04; rule engine logic in M08/`packages/core`.
- **Test focus:** full rule matrix; actual-overrides-rule; provider adapters.

### M05 — Ads & Allocation
- **Owns:** `AdIntegration, Campaign, AdSpend, AdAttribution`.
- **Interface:** provider sync, `allocate(campaign, window)` (Direct→RevShare→AI).
- **Depends on:** M00, M04; allocation math in M08.
- **Test focus:** spend sums to total; method precedence; AI estimator bounds.

### M08 — Profit Engine (`packages/core`)
- **Responsibility:** pure math — cost stack, order profit, roll-ups, shipping rule
  evaluation, allocation split, opex amortization, `Money`.
- **Owns:** no tables (pure).
- **Interface:** `computeOrderProfit(input)`, `rollUp(grain, rows)`,
  `evaluateShipping(rules, order)`, `splitByRevenue(cost, lines)`.
- **Depends on:** M00 only (types/Money).
- **Test focus:** the entire matrix in `docs/06-PROFIT-ENGINE.md §9`; property tests.

### M09 — Analytics & Snapshots
- **Responsibility:** write `ProfitSnapshot` rows; manage Timescale continuous
  aggregates; expose query API.
- **Owns:** `ProfitSnapshot` (+ Timescale views).
- **Interface:** `writeSnapshot`, `query(grain, range, filters)`.
- **Depends on:** M08, M04/05/06/07.
- **Test focus:** snapshot completeness (all components); aggregate correctness;
  reconciliation across grains.

### M10 — Dashboards (read API + UI)
- **Interface:** executive/product/variant/order/campaign/customer endpoints; drill-down.
- **Depends on:** M09.
- **Test focus:** numbers match engine; p95 latency; filter integrity.

### M11 — Alerts
- **Owns:** `AlertRule, AlertEvent`.
- **Interface:** `evaluate(storeId, snapshotDelta)`, rule CRUD.
- **Depends on:** M09.
- **Test focus:** fire-once per breach; threshold edges.

### M12 — Reporting
- **Owns:** `Report`.
- **Interface:** `generate(type, period)` → MinIO/S3 object; schedule.
- **Depends on:** M09, M14, M00 (storage).
- **Test focus:** scheduled generation; object stored & retrievable.

### M13 — AI Layer (`packages/ai`)
- **Owns:** `AiConversation, AiMessage, Recommendation`.
- **Interface:** `ask(agent, question, storeId)`, `recommend(storeId)`; model router
  (Ollama-first), read-only grounding tools.
- **Depends on:** M09 (reads engine outputs only), M00.
- **Test focus:** router escalation logic; tools return engine numbers; cost logging;
  prompt-injection resistance.

### M14 — Notifications
- **Responsibility:** email (SMTP/Mailpit) + in-app delivery for alerts/reports.
- **Interface:** `notify(storeId, channel, payload)`.
- **Depends on:** M00.
- **Test focus:** template rendering; delivery via Mailpit in integration tests.

## 3. Module conventions
- A module's tables are written **only** by that module's services.
- Cross-module communication is via typed service interfaces or domain events, never
  by reaching into another module's tables.
- New cross-module needs are added to the owning module's interface (and documented),
  not bypassed.
- Every module ships with its own unit + integration tests and updates this doc when
  its interface changes.
