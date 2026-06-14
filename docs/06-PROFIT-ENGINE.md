# 06 — Profit Engine Specification

> The correctness boundary. All logic here lives in `packages/core` as **pure
> functions** — no DB, no network — and is unit + property tested to 100%. Dashboards,
> agents, and reports consume its output; none re-derive money independently.

## 1. Money rules
- Amounts are `BigInt` **minor units** (paise/cents) + a `currency`.
- A `Money` value object enforces same-currency arithmetic; rounding only at
  allocation boundaries.
- Percentages are **basis points** (1% = 100 bps), integers.
- Splitting an integer across N parts uses **largest-remainder** so parts sum exactly
  to the whole — no paise created or lost.

## 2. Cost stack for one order `O` (lines `L`)
```
revenue(O)        = Σ line.price*line.qty − order.discount        // net of discount
productCost(O)    = Σ resolveProductCost(line.variant, O.placedAt)*line.qty  // temporal
packagingCost(O)  = resolvePackaging(O)
fulfillmentCost(O)= resolveFulfillment(O)
paymentFee(O)     = gw.flat + revenue(O)*gw.percentBps/10000
shippingCost(O)   = actualShipmentCost(O) ?? ruleEngineShipping(O)  // actual wins
adCost(O)         = Σ allocatedAdSpend(O)                            // §5
refunds(O)        = Σ refund.amount
opex(O)           = allocatedOpex(O)                                // §6

orderProfit(O) = revenue − productCost − packagingCost − fulfillmentCost
               − paymentFee − shippingCost − adCost − refunds − opex
orderMargin(O) = orderProfit/revenue        // revenue==0 → null
```

## 3. Shipping rule engine
When no actual courier cost exists, compute from `ShippingRule`s in **priority order**,
first match wins:
```
Country → State → ZIP/Pincode → Weight → Order Value   (Hybrid)
```
- **Country** match `order.country` (IN=₹70, US=$10, CA=$15).
- **State** match `order.state` (Kerala ₹60, Tamil Nadu ₹75).
- **ZIP/Pincode** `zipFrom ≤ zip ≤ zipTo` (680001–680500 = ₹65).
- **Weight** bucket on `weightGrams` (0–500g ₹40, 500g–1kg ₹60…).
- **Order-Value** bucket on `revenue(O)`; supports `freeOver` (₹1000+ = free).

Hybrid: rules carry `(type-rank, priority)`; engine returns the first matching rule's
amount; higher-priority matches short-circuit lower ones. No match → configurable
default and `order.shippingEstimated=true`. **Deterministic:** same rules + order ⇒
same cost.

## 4. Grains & roll-up
| Grain | Definition |
|---|---|
| Order | §2 directly. |
| Variant | Σ over that variant's lines: line revenue − (its product cost + its share of order costs). |
| Product | Σ of its variants. |
| Store | Σ of all orders − store-level opex not amortized per order. |
| Campaign | Σ attributedRevenue − spend − COGS of attributed orders. |
| Customer | Σ of the customer's orders; LTV = Σ revenue; frequency = orders/active-period. |

**Order→line split.** Costs charged once per order (shipping, global packaging,
payment fee, per-order fulfillment, allocated opex) are split across lines by
**revenue share** via largest-remainder, so variant/product profit reconciles with
order profit by construction:
```
lineShareOf(cost) = round_lr( cost * lineRevenue / orderRevenue )
```

## 5. Ad-cost allocation
Preference order per campaign/day:
1. **Direct** (Meta/Shopify/UTM) → specific orders/products. `DIRECT`.
2. **Revenue-share:** `productAdCost = spend * productRevenue/totalRevenue` (largest-
   remainder). `REVENUE_SHARE`.
3. **AI attribution:** estimate from sessions/clicks/conversions/revenue with a
   `confidence`. `AI`.
**Invariant:** Σ allocated per campaign/day == that day's spend (nothing lost/dup'd).

## 6. Opex amortization
`OperationalExpense` is amortized into a period's orders by basis:
- `REVENUE`: `opex * orderRevenue/periodRevenue`.
- `ORDERS`: `opex / periodOrderCount`.
Done at snapshot time, so changing opex re-amortizes only that period.

## 7. Refund timing
Refunds reduce profit in the **period they occur** (period honesty) and are also
attributed to the order for drill-down. A fully refunded order can go negative once
costs count — intentional; surfaces loss-making returns.

## 8. Output: ProfitSnapshot
Every computation emits a snapshot carrying **each cost component separately** (not
just net) so dashboards show the waterfall `Revenue → −COGS → −Shipping → −Ads →
−Packaging → −Fees → −Refunds → −Opex → Net Profit` and AI agents can explain *why*
profit moved.

## 9. Test matrix (acceptance for `packages/core`)
- **Money:** same-currency enforcement; largest-remainder sums exactly; rounding.
- **Order profit:** golden cases with each component present/absent.
- **Temporal cost:** orders before/after a cost change pick the right row.
- **Shipping:** each rule type; hybrid priority; free-over; no-match fallback.
- **Allocation:** revenue-share sums to total; Direct > RevShare > AI precedence.
- **Opex:** revenue vs orders basis; re-amortization on change.
- **Refund:** period vs order attribution; negative-profit order.
- **Roll-ups:** variant Σ = product = store, reconciled **to the paise**.
- **Property tests (fast-check):** for random valid inputs, (a) splits sum to the
  whole, (b) roll-ups reconcile, (c) profit = revenue − Σcosts always holds.

> A reconciliation failure is a split bug, not a rounding feature. Fix the allocation;
> never widen the tolerance.
