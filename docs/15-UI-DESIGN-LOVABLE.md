# 15 — UI Design in Lovable

A design-and-build brief for creating the **Profitily portal UI in Lovable**, then
bringing the generated codebase into this repo. Lovable outputs **React + TypeScript +
Tailwind + shadcn/ui** with **GitHub sync** — which matches our portal stack exactly —
so it's a fast way to produce on-brand screens that Claude Code then wires to our API.

> Use this doc to *design* the UI in Lovable. The implementation contract (routes,
> data fields, modules, states) lives in `docs/11-UI-DEVELOPMENT.md`; this doc is the
> feature/visual + prompt layer on top of it. The two must agree — if they don't, flag
> it (`docs/14 §4`).

---

## 1. How Lovable fits (and its boundaries)

- **Scope = the portal** (`apps/web`), the customer-facing SaaS dashboard. Lovable's
  React/Tailwind/shadcn output drops straight into our portal stack.
- **Frontend only.** Lovable defaults to a **Supabase** backend — we do **not** use it
  as our real backend (ours is NestJS + Postgres/Timescale). In Lovable, build screens
  against **mock data behind clean data hooks** (e.g. `useExecutiveMetrics()`), so
  Claude Code can swap the mock for our real API without touching the UI. If you let
  Lovable spin up Supabase tables, treat them as throwaway scaffolding for the demo
  only.
- **Shopify embedded app** (`apps/shopify-app`) uses **Polaris**, not shadcn. Use
  Lovable for those screens as **visual reference only**; the real build is Polaris
  (`docs/11 §4`). Don't ship Lovable's shadcn version of the embedded app.
- **GitHub sync** keeps the generated code in a real git repo so we can import it (see
  §7). Nothing is locked in.

## 2. Tool workflow (design the navigation around these flows)

To design coherent navigation, understand how a merchant actually moves through the
tool:

```
Install (Shopify) → Setup Wizard → PORTAL
                                     │
            ┌────────────────────────┼─────────────────────────────┐
   Daily check                  Configure                     Investigate / Act
   Executive dashboard          Costs · Shipping rules         Drill-down Store→Product
   → spot a profit drop         · Ad/shipping integrations      →Variant→Order waterfall
   → read recommendations       (one-time + ongoing)           → ask AI agent "why?"
   → act / dismiss                                              → apply a recommendation
            │                                                          │
        Alerts inbox ◀──────────── alerts fire on thresholds ─────────┘
            │
        Reports (daily/weekly/monthly)   ·   Settings (store, team, billing)
```

**Primary user flows to support in the design:**
1. **First run:** wizard completion → land on Executive Dashboard (empty/seeding state
   until data syncs).
2. **Daily profit check:** Executive Dashboard → notice a KPI delta → open the profit
   waterfall → drill into the product/order responsible.
3. **Act on insight:** Recommendations feed → review expected impact → accept or
   dismiss; or open AI Hub and ask "why did profit drop last week?".
4. **Configure costs:** Cost Management → enter product costs (manual/CSV/bulk),
   packaging, fees, opex → see profit update.
5. **Set shipping:** Shipping Rules → add/reorder rules → live-preview a sample order.
6. **Connect data:** Integrations → connect couriers and ad platforms → watch sync
   status.
7. **Stay informed:** Alerts inbox + Reports.
8. **Manage:** Settings → store currency, team/stores (agency switcher), billing.

The left nav should map to these: Dashboard · Products · Orders · Campaigns · Customers
· Costs · Shipping · Integrations · AI · Recommendations · Alerts · Reports · Settings.
Top bar: **store switcher** (agency), **global date-range picker**, account menu.

## 3. Design system for Lovable (paste into the project prompt)

- **Brand/primary:** indigo (`#4f46e5`). **Profit-positive = green** (`#16a34a`),
  **loss-negative = red** (`#dc2626`), **warning = amber** (`#d97706`). Never signal
  profit/loss by color alone — always pair with sign (`+/−`) and a label (a11y).
- **Surfaces:** white cards on a light slate background; subtle borders; 12px card
  radius. **Type:** Inter; large tabular-figure numerals for KPIs; right-align money
  columns.
- **Money:** always show currency (per-store base currency, multi-currency — ADR 0001);
  format from minor units; show sign on deltas.
- **Components (shadcn):** Card, Table (sortable, sticky header), Tabs, Dialog/Sheet,
  Select, DateRangePicker, Badge (status), Toast, Skeleton, EmptyState, Charts
  (Recharts: line/area for trends, bar for comparisons, a horizontal **waterfall** for
  profit breakdown).
- **States:** every data view designs **loading (skeleton)**, **empty (with a CTA)**,
  and **error (retry)** — not just the populated state.
- **Layout:** persistent left nav + top bar; responsive (tables collapse to cards on
  mobile); WCAG AA.

## 4. Portal pages & features (design these in Lovable)

Each page lists the **features to design**. Routes/data contracts: `docs/11 §5`.

### P0 · App shell — `app-shell`
Left nav (sections from §2), top bar with store switcher + date-range picker + account
menu, breadcrumbs, global toasts, page skeleton. Dark-mode optional.

### P1 · Executive Dashboard (home) — `executive-dashboard`
KPI cards with period delta: **Revenue, Net Profit, Orders, Profit Margin, ROAS, CAC,
AOV**. **Profit waterfall** (Revenue → −COGS → −Shipping → −Ads → −Packaging → −Fees →
−Refunds → −Opex → **Net Profit**). Trend chart (revenue vs net profit). Alerts summary
strip. Recommendations teaser (top 3). Date-range + compare-to-previous.

### P2 · Product Profit — `product-dashboard`
Sortable/filterable table: Revenue, Profit, Margin, Units. Profit/loss color+sign.
Search, column sort, pagination. Row → P3.

### P3 · Product Detail — `product-detail`
Header KPIs, **variant breakdown table**, product profit waterfall, trend chart,
best/worst variant callouts.

### P4 · Variant Dashboard — `variant-dashboard`
Table: Revenue, Margin, Profitability; filter by product; highlight loss-making
variants.

### P5 · Order Dashboard — `order-dashboard`
Table: order #, date, Revenue, Cost, Net Profit, status badges. Filters (date,
profitability, status). Row → P6.

### P6 · Order Detail — `order-detail`
**Full order cost waterfall**, line items with per-line profit, allocated shipping/ads/
fees breakdown, refunds, customer mini-card. The drill-down leaf.

### P7 · Campaign Dashboard — `campaign-dashboard`
Per campaign/platform: Spend, Revenue, Profit, ROAS; platform badges (Meta/Google/
TikTok); allocation-method tag (Direct/RevShare/AI); pause/scale hints.

### P8 · Customer Dashboard — `customer-dashboard`
Table: LTV, Total Profit, Purchase Frequency; top customers; cohort hint.

### P9 · Profit Drill-down — `drilldown`
Breadcrumb navigator `Store → Product → Variant → Order` that **preserves date range +
filters**; consistent waterfall at each level. Design as a shared pattern across P1–P6.

### P10 · Cost Management — `cost-management`
Tabbed: **Product Costs** (manual table + **CSV upload with mapping & error report** +
bulk edit; effective-date/temporal fields), **Packaging & Fulfillment**, **Payment-fee
rules**, **Operational expenses**, **Additional fees**. Inline validation; empty state
with "add your first cost" CTA.

### P11 · Shipping — `shipping`
**Rules:** table with **drag-to-reorder priority**, rule-type badges (Country/State/
ZIP/Weight/OrderValue), add/edit dialog, and a **live preview** widget that resolves a
sample order through the hybrid priority. **Integrations:** connect Shiprocket/Shipway/
Delhivery/Shopify Shipping; per-provider sync status.

### P12 · Ad Integrations — `ad-integrations`
Connect cards for Meta/Google/TikTok (OAuth), connection + sync status, campaign list,
last-sync timestamps.

### P13 · AI Agent Hub — `ai-hub`
Chat UI with **agent selector** (Profit/Marketing/Inventory/Forecast/CFO), grounded
answers that show the numbers/mini-charts they cite, **suggested questions** chips,
conversation history sidebar, and a small "answered by <model>" tag. Thinking/answer/
error states.

### P14 · Recommendations — `recommendations`
Card feed of proactive actions (Pricing/Ads/Shipping/Inventory) with **expected impact**
(₹/$), rationale, and **Accept / Dismiss**; filter by kind and status.

### P15 · Alerts — `alerts`
**Rules** config (thresholds for profit drop / shipping spike / refund spike / reorder /
campaign unprofitable) + **inbox/feed** with severity, timestamp, acknowledge.

### P16 · Reports — `reports`
List of daily/weekly/monthly reports; "generate now"; download; preview an executive
summary.

### P17 · Settings — `settings`
Tabbed: **General** (store base currency), **Integrations** overview, **Billing & Plan**
(tier cards + usage), **Team & Members** (agency: stores + roles), **Account**.

## 5. Shopify app screens (Polaris — Lovable for reference only)
Wizard steps W1–W7, app home, billing, settings (`docs/11 §4`). You may sketch these in
Lovable to align visual hierarchy, but **implement in Polaris** — don't import Lovable's
shadcn versions into `apps/shopify-app`.

## 6. Lovable prompt pack (copy-paste)

### 6.1 Project / master prompt (run first)
```
Build a SaaS analytics dashboard called "Profitily" — an AI CFO for Shopify/DTC brands
that shows true profit across store, product, variant, order, campaign, and customer.

Stack & rules:
- React + TypeScript + Tailwind + shadcn/ui. Charts with Recharts.
- FRONTEND ONLY. Do not build real backend logic. Use mock data behind clean,
  typed data hooks (e.g. useExecutiveMetrics, useProducts, useOrderProfit) so the data
  source can be swapped for a REST API later. Keep all mock data in one /mock folder.
- Multi-currency: every money value has a currency; format from a money helper; show
  currency and +/- sign on deltas. Profit-positive = green, loss-negative = red, and
  NEVER rely on color alone (always show sign + label).
- Design system: primary indigo #4f46e5, success green #16a34a, danger red #dc2626,
  warning amber #d97706; Inter font; tabular numerals for money; cards on light slate;
  12px radius. WCAG AA; responsive (tables collapse to cards on mobile).
- App shell: left nav [Dashboard, Products, Orders, Campaigns, Customers, Costs,
  Shipping, Integrations, AI, Recommendations, Alerts, Reports, Settings]; top bar with
  a store switcher, a global date-range picker, and an account menu.
- Every data view needs loading (skeleton), empty (with CTA), and error (retry) states.

Start with the app shell and the Executive Dashboard. I'll add pages one at a time.
```

### 6.2 Per-page prompt template
```
Add the "<Page name>" page at route <route from docs/11>.
Features: <paste the feature bullets from §4 for this page>.
Data: use a typed hook <useXxx()> returning mock data shaped like:
<list the fields from docs/11 §5 — e.g. revenueMinor, netProfitMinor, marginBps, currency>.
Include loading, empty, and error states. Money: format from minor units + currency,
green/red + sign. Keep it responsive and accessible.
```
Work page-by-page in the order: app shell → executive → products/orders/variants/
campaigns/customers → drill-down → costs → shipping → integrations → AI hub →
recommendations → alerts → reports → settings.

### 6.3 Connect-to-real-data prompt (later, optional)
```
Replace the mock data hooks with calls to a REST API at VITE_API_BASE_URL. Keep the
hook signatures identical; only change the implementation to fetch from
`/api/<resource>` with the bearer token from auth context. Do not change the UI.
```

## 7. From Lovable to this repo

1. **Connect Lovable to GitHub** (a dedicated repo, e.g. `profitily-ui-lovable`, or a
   branch). Lovable syncs the generated React/Tailwind/shadcn code there.
2. **Claude Code imports** the components into `apps/web` (a `task/TASK-0xx-import-ui`
   branch off `develop`): move screens/components in, align to our routing, apply
   `design/tokens/tokens.json`, and **replace the mock data hooks with the real API**
   (M10 read endpoints), keeping hook signatures stable.
3. **Wire + harden:** add auth/tenant context, loading/empty/error wired to real
   states, and tests — **component (RTL), E2E (Playwright), axe a11y, visual snapshot**
   (`docs/08`, `docs/11 §6`).
4. **Review & merge** via the normal loop (`docs/09`) → auto-deploys to staging.

Treat the Lovable output as a **high-quality starting point**, not the final code: it
still goes through review, gets the real data contract, security (no secrets in the
client, `docs/13 §10`), and tests before merge. Don't over-engineer the import — bring
in what the page spec needs, drop demo scaffolding.

## 8. Handoff checklist (per page brought in from Lovable)
- [ ] Matches the §4 features and the `docs/11` route + data contract.
- [ ] Mock hook replaced with the real API; hook signature unchanged.
- [ ] Tokens applied; money/sign/color rules correct; profit/loss not color-only.
- [ ] Loading / empty / error states wired to real data.
- [ ] Tests: RTL + Playwright + axe + visual snapshot, all green.
- [ ] No secrets in client code; tenant-scoped requests only.
- [ ] Responsive + WCAG AA.
