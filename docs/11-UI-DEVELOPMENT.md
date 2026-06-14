# 11 — UI Development

How UI gets built: you (or a designer) **drop a UI design into a folder**, Claude Code
reads the matching page spec here plus that drop, and implements the real component.
Covers both surfaces: the **Shopify embedded app** (Polaris) and the **Profitily
portal** (our own SaaS).

---

## 1. The design-drop workflow

```
You design a page  ──▶  drop it in design/<surface>/<page-slug>/  ──▶  Build Request
references the drop  ──▶  Claude Code reads §spec + drop  ──▶  implements component +
tests (RTL + Playwright + axe + visual snapshot)  ──▶  flags any drop↔spec mismatch.
```

### Drop folder layout (in the repo)
```
design/
├── README.md
├── tokens/                       # optional: colors, type, spacing if you define them
│   └── tokens.json
├── shopify-app/
│   └── <page-slug>/              # e.g. wizard-step-4-costs/
│       ├── mockup.png            # or mockup.html / .fig export / screenshots
│       └── notes.md              # behavior, states, data bindings, a11y, acceptance
└── portal/
    └── <page-slug>/              # e.g. executive-dashboard/
        ├── mockup.png
        └── notes.md
```

### `notes.md` per drop (what Claude Code needs)
- **Page / route** it implements (matches a spec in §4/§5).
- **Components** and layout regions.
- **Data bindings** — which API fields/endpoints feed which elements (point to the
  dashboard read API and module in `docs/05`/`docs/10`).
- **States** — loading, empty, error, and any per-element variants.
- **Interactions** — clicks, filters, drill-downs, form submits.
- **Responsive** — desktop/tablet/mobile intent.
- **Accessibility** — focus order, labels, contrast notes.
- **Acceptance** — what "correct" looks like.

If a drop is missing for a UI task, Claude Code builds to the §spec here and notes that
no drop was provided. If the drop conflicts with the spec, Claude Code implements the
spec's data contract and raises the mismatch to the planner.

## 2. Tech & design system
- **Shopify app:** **Shopify Polaris** components only (native Shopify look, App Bridge
  for embedding, navigation, toasts, modals). Don't reinvent Polaris patterns.
- **Portal:** **Tailwind** + a light shadcn-style component layer; **Recharts** for
  charts. Claude Code should use the **`frontend-design` skill** for visual quality and
  pull shared tokens from `design/tokens/` when present.
- **Shared:** types/DTOs from `packages/shared`; data via TanStack Query; forms via a
  schema (zod) shared with the backend.

## 3. Design tokens & conventions (portal)
- **Color roles:** brand/primary; **profit-positive = success/green**, **loss-negative
  = danger/red** (used consistently in KPIs, deltas, waterfalls); warning/amber for
  alerts; neutral surfaces for cards/tables. Never encode profit/loss by color alone —
  pair with sign and label (a11y).
- **Typography:** one display scale for KPI numbers, one body scale; tabular figures
  for money columns.
- **Money formatting:** format from `BigInt` minor units + currency at the edge; show
  the store's base currency; right-align money columns; show sign for deltas.
- **Layout:** persistent left nav + top bar (store switcher + date range); content as
  cards/tables; max content width for readability.
- **States everywhere:** every data view defines loading (skeleton), empty (with a
  helpful CTA), and error (retry) states — not just the happy path.
- **Responsive:** desktop-first for dashboards; ensure tables degrade to stacked cards
  on mobile. **A11y:** WCAG AA; keyboard nav; axe checks in CI.

## 4. Shopify app — pages (Polaris)

> Surface `apps/shopify-app`. Each page: **Route · Purpose · Components · Data · States
> · Maps to.** Drop folder: `design/shopify-app/<slug>/`.

### S1 — Install / OAuth callback  (`/auth`)
Shopify-driven consent; we handle the callback and token exchange. Minimal UI (spinner
+ redirect). Data: OAuth. Maps to: TASK-010.

### S2 — App Home  (`/`)  — slug `app-home`
Thin landing after install. **Components:** sync-status card (last sync, lag per
source), current plan badge, primary CTA "Open Profitily Portal", setup-progress if
wizard incomplete. **Data:** `SyncState`, `Subscription`. **States:** syncing / synced
/ error. Maps to: TASK-005, TASK-023.

### S3 — Plan & Billing  (`/billing`)  — slug `billing`
Plan cards (Free/Growth/Pro/Agency) with current order usage vs Free cap; upgrade CTA →
Shopify managed billing confirmation screen. **Data:** plan, usage. **States:**
current-plan highlighted, over-limit warning. Maps to: TASK-012.

### S4 — Setup Wizard  (`/setup`)  — slug `wizard-*`
Resumable 7-step flow (Polaris `Page` + progress). One drop per step:
- **W1 Welcome** (`wizard-1-welcome`) — intro, what to expect.
- **W2 Authorize** (`wizard-2-authorize`) — confirm scopes; connect.
- **W3 Historical Sync** (`wizard-3-sync`) — progress bars + counts (orders/products/
  customers); continue when baseline done. Data: backfill job status.
- **W4 Product Costs** (`wizard-4-costs`) — manual table / **CSV upload** (mapping +
  error report) / bulk update. Data: M06 cost APIs.
- **W5 Shipping** (`wizard-5-shipping`) — connect Shiprocket/Shipway/Delhivery/Shopify
  Shipping; or skip to use rule engine. Data: M07.
- **W6 Ads** (`wizard-6-ads`) — connect Meta/Google/TikTok (OAuth). Data: M05.
- **W7 Finish** (`wizard-7-finish`) — summary; redirect to portal.
**States (all):** in-progress / saved / error; refresh resumes from saved step.
Maps to: TASK-014.

### S5 — Settings (in-Shopify, minimal)  (`/settings`)  — slug `app-settings`
Reconnect, trigger resync, uninstall info. Data: integrations, `SyncState`. Maps to:
TASK-023.

## 5. Portal — pages (Tailwind + Recharts)

> Surface `apps/web`. Drop folder: `design/portal/<slug>/`. All dashboards read the
> aggregation API (M10) over snapshots (M09); numbers must reconcile with the engine.

### P0 — App shell & global  — slug `app-shell`
Left nav, top bar with **store switcher** (agency) + **global date-range picker** +
account menu; toasts; skeletons. The frame every page renders inside. Maps to: TASK-005.

### P1 — Executive Dashboard (home)  (`/`)  — slug `executive-dashboard`
**Components:** KPI cards (Revenue, Net Profit, Orders, **Margin**, ROAS, CAC, AOV) with
period deltas; **profit waterfall** (Revenue → −COGS → −Shipping → −Ads → −Packaging →
−Fees → −Refunds → −Opex → Net Profit); trend chart; alerts summary; recommendations
teaser. **Data:** M10 executive endpoint. **States:** skeleton / no-data (post-install)
/ error. Maps to: TASK-061.

### P2 — Product Profit  (`/products`)  — slug `product-dashboard`
Sortable/filterable table: Revenue, Profit, Margin, Units. Row → P3. Maps to: TASK-062.

### P3 — Product Detail  (`/products/:id`)  — slug `product-detail`
Variant breakdown table, product waterfall, trend. Drill target from P2. Maps to:
TASK-062/063.

### P4 — Variant Dashboard  (`/variants`)  — slug `variant-dashboard`
Table: Revenue, Margin, Profitability. Maps to: TASK-062.

### P5 — Order Dashboard  (`/orders`)  — slug `order-dashboard`
Table: Revenue, Cost, Net Profit, status. Row → P6. Maps to: TASK-062.

### P6 — Order Detail  (`/orders/:id`)  — slug `order-detail`
Full **order cost waterfall**, line items, allocated shipping/ads/fees, refunds. The
drill-down leaf. Maps to: TASK-063.

### P7 — Campaign Dashboard  (`/campaigns`)  — slug `campaign-dashboard`
Per campaign/platform: Spend, Revenue, Profit, ROAS; allocation method shown. Maps to:
TASK-062.

### P8 — Customer Dashboard  (`/customers`)  — slug `customer-dashboard`
Table: LTV, Total Profit, Purchase Frequency. Maps to: TASK-062.

### P9 — Profit Drill-down  (pattern across P1–P6)  — slug `drilldown`
`Store → Product → Variant → Order` navigator preserving date range/filters; leaf is
the order waterfall. Document as a shared breadcrumb + linked-table pattern. Maps to:
TASK-063.

### P10 — Cost Management  (`/costs/*`)  — slug `cost-management`
Sub-pages: **Product Costs** (manual / CSV / bulk, temporal effective dates) ·
**Packaging & Fulfillment** · **Payment-fee rules** · **Operational expenses** ·
**Additional fees**. Forms with validation + CSV error report. **Data:** M06. **States:**
empty (no costs yet → CTA), saved, validation errors. Maps to: TASK-030/031.

### P11 — Shipping  (`/shipping/*`)  — slug `shipping`
**Rules:** CRUD with drag **priority ordering** and a **live preview** that resolves a
sample order through `Country→State→ZIP→Weight→OrderValue`. **Integrations:** connect
couriers, sync status. **Data:** M07. Maps to: TASK-033/040.

### P12 — Ad Integrations  (`/ads`)  — slug `ad-integrations`
Connect Meta/Google/TikTok (OAuth), per-platform sync status, campaign list. **Data:**
M05. Maps to: TASK-041.

### P13 — AI Agent Hub  (`/ai`)  — slug `ai-hub`
Chat UI with **agent selector** (Profit/Marketing/Inventory/Forecast/CFO), grounded
answers with the numbers/charts they cite, suggested questions, conversation history.
Show which model answered (transparency/cost). **Data:** M13. **States:** thinking,
answer, error/fallback. Maps to: TASK-071/072.

### P14 — Recommendations  (`/recommendations`)  — slug `recommendations`
Feed of proactive actions (pricing/ads/shipping/inventory) with expected impact;
accept/dismiss → status. **Data:** M13. Maps to: TASK-073.

### P15 — Alerts  (`/alerts`)  — slug `alerts`
Alert rule config (thresholds) + alert inbox/feed with acknowledge. **Data:** M11.
Maps to: TASK-074.

### P16 — Reports  (`/reports`)  — slug `reports`
List daily/weekly/monthly reports; generate on demand; download from MinIO/R2. **Data:**
M12. Maps to: TASK-064.

### P17 — Settings  (`/settings/*`)  — slug `settings`
Sub-pages: **General** (base currency) · **Integrations** overview · **Billing & Plan**
· **Team & Members** (agency: manage stores/roles) · **Account**. **Data:** M01/M15.
Maps to: TASK-011/012/083.

## 6. UI task definition of done (in addition to `docs/09`)
- Matches the §spec data contract and the drop (or notes the mismatch).
- Uses design tokens; consistent money/sign/color rules; profit/loss never color-only.
- Implements loading/empty/error states, not just happy path.
- Tests: **component (RTL)** for logic/states, **E2E (Playwright)** for the journey,
  **axe a11y** clean, **visual snapshot** committed.
- Responsive at the documented breakpoints.

## 7. Build order for UI
The app shell (P0/S2) comes first, then dashboards consume real data only after the
read API (TASK-060) exists. Wizard (S4) depends on its module APIs (M06/M07/M05). The
plan in `docs/07` already sequences these — UI tasks should not run ahead of the data
they render.
