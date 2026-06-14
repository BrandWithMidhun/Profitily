# 01 — Product Requirements Document (PRD)

**Product:** Profitily AI — AI-powered Profit Intelligence Platform
**Version:** 1.1
**Status:** Approved for build

## 1. Problem
Shopify/DTC merchants track revenue and ROAS in scattered dashboards but rarely know
**true net profit** per order, product, or campaign. Costs are fragmented across
Shopify, couriers, ad platforms, packaging, payment processors, and operations.
Decisions get made on revenue, not profit — and money quietly leaks.

## 2. Vision & mission
- **Mission:** Help every eCommerce business understand its true profitability and
  make smarter growth decisions using AI.
- **Vision:** Become the operating system for eCommerce profitability and AI-powered
  financial decision-making.

## 3. Users
- **Primary:** Shopify merchants, DTC brands, growth-stage eCommerce companies.
- **Secondary:** Shopify agencies, marketing agencies, fractional CFOs, consultants
  (drive the multi-store **Agency** tier).

## 4. Surfaces
1. **Shopify App (thin):** install, OAuth, billing, data sync, webhooks, 7-step setup
   wizard. No heavy analytics inside Shopify.
2. **SaaS Platform:** profit analytics, reporting, AI insights, forecasting,
   recommendations, agents. Merchants redirect here from Shopify.

## 5. Onboarding flow
Install app → authorize Shopify → historical sync (orders, products, variants,
customers) → configure product costs (manual / CSV / bulk) → connect shipping
(Shiprocket, Shipway, Delhivery, Shopify Shipping) → connect ads (Meta, Google,
TikTok) → enter dashboard.

## 6. Functional requirements
- **Ingestion:** Shopify orders/products/variants/customers/discounts/refunds/
  inventory (historical + real-time webhooks); shipping actuals; ad spend & attribution.
- **Cost management:** product (manufacturing/purchase), packaging (box/labels/
  inserts/materials), fulfillment (warehouse/pick&pack), payment fees (Shopify
  Payments, Razorpay, Stripe, PayPal), operational + additional fees. Entry via
  manual / CSV / bulk.
- **Shipping cost engine:** integrated (courier APIs) and manual rule-based; rules by
  Country / State / ZIP-Pincode / Weight / Order-Value + **Hybrid** priority
  `Country → State → ZIP → Weight → Order Value`. Custom courier agreements supported.
- **Profit engine:** store / product / variant / order grain with drill-down
  `Store → Product → Variant → Order` (see `docs/06-PROFIT-ENGINE.md`).
- **Ad allocation:** direct attribution → revenue-share → AI attribution.
- **Dashboards:** Executive (Revenue, Net Profit, Orders, Margin, ROAS, CAC, AOV),
  Product, Variant, Order, Campaign, Customer (LTV, total profit, frequency).
- **AI layer:** Agent Hub (NL Q&A); agents Profit, Marketing, Inventory, Forecast,
  CFO; proactive recommendation engine; alerts (profit drop, shipping spike, refund
  spike, reorder point, campaign unprofitable).
- **Reporting:** daily / weekly / monthly.
- **Multi-tenancy & billing:** isolated per-store data; tiers Free (≤100 orders),
  Growth ($29–49), Pro ($99–199), Agency ($299+).

## 7. Non-functional requirements
- Strict `storeId` tenant isolation; OAuth tokens encrypted at rest; no PII in logs.
- Money as integer minor units; deterministic, unit-tested profit math.
- Async ingestion via queues; idempotent webhooks; retry + DLQ.
- Dashboard p95 < 2s for a 50k-order store (pre-aggregated reads).
- Observability per store (sync health, job metrics) — using OSS tooling.

## 8. Currency / region (DECIDED — see ADR 0001)
**Multi-currency, per store.** Each store has a single `baseCurrency` read from Shopify
at install; all profit math and dashboards are in that currency. Orders in a different
presentment currency are normalized to the store base currency at ingestion using the
rate Shopify provides on the order; no cross-store currency mixing. India-specific
providers (Shiprocket/Delhivery/Razorpay) ship first because the examples are
India-centric; other regions follow. See `docs/adr/0001-multi-currency-store-base.md`.

## 9. Out of scope (v1)
Non-Shopify platforms (WooCommerce/BigCommerce/Magento), marketplaces
(Amazon/Walmart/Etsy), advanced CFO platform (cash-flow forecasting, budgeting, profit
simulations) — roadmap phases 2–4.

## 10. Success metrics
MRR, merchant retention, AI usage rate, average profit improvement, store growth rate,
net revenue retention.
