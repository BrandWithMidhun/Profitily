# 04 — Database Structure

> Source of truth = the Prisma schema in `packages/db/prisma/schema.prisma`. This
> document specifies it. Conventions:
> - All money is **`BigInt` minor units** (paise/cents) + a `currency` (ISO 4217).
> - Every tenant table has `storeId` and is queried through the tenant extension.
> - Timestamps UTC; IDs `cuid()`. Enums are Postgres native enums.
> - Profit snapshots live in a **TimescaleDB hypertable** (see §4).

## 1. Prisma schema (canonical)

```prisma
// packages/db/prisma/schema.prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

// ──────────────── Enums ────────────────
enum PlanTier        { FREE GROWTH PRO AGENCY }
enum SubStatus       { ACTIVE PAST_DUE CANCELED TRIALING }
enum Role            { OWNER ADMIN VIEWER }
enum Gateway         { SHOPIFY_PAYMENTS RAZORPAY STRIPE PAYPAL OTHER }
enum ShipProvider    { SHIPROCKET SHIPWAY DELHIVERY SHOPIFY_SHIPPING MANUAL }
enum AdPlatform      { META GOOGLE TIKTOK }
enum ShipRuleType    { COUNTRY STATE ZIP WEIGHT ORDER_VALUE }
enum CostScope       { GLOBAL PRODUCT VARIANT }
enum AllocBasis      { REVENUE ORDERS }
enum AllocMethod     { DIRECT REVENUE_SHARE AI }
enum Grain           { STORE PRODUCT VARIANT ORDER CAMPAIGN CUSTOMER }
enum AlertType       { PROFIT_DROP SHIPPING_SPIKE REFUND_SPIKE REORDER CAMPAIGN_UNPROFITABLE }
enum RecoKind        { PRICING ADS SHIPPING INVENTORY }
enum RecoStatus      { NEW ACTED DISMISSED }
enum ReportType      { DAILY WEEKLY MONTHLY }
enum SyncStatus      { IDLE RUNNING OK ERROR }

// ──────────────── Tenancy ────────────────
model Store {
  id            String   @id @default(cuid())
  shopDomain    String   @unique
  accessToken   String   // encrypted at rest
  baseCurrency  String   @default("USD") // set from Shopify shop currency at install (ADR 0001)
  country       String?
  plan          PlanTier @default(FREE)
  installedAt   DateTime @default(now())
  uninstalledAt DateTime?
  syncCursor    Json?
  settings      Json?
  memberships   Membership[]
  subscription  Subscription?
  products      Product[]
  orders        Order[]
  @@index([plan])
}

model User {
  id           String       @id @default(cuid())
  email        String       @unique
  name         String?
  passwordHash String?
  authProvider String       @default("shopify")
  memberships  Membership[]
  createdAt    DateTime     @default(now())
}

model Membership {
  id      String @id @default(cuid())
  userId  String
  storeId String
  role    Role   @default(OWNER)
  user    User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  store   Store  @relation(fields: [storeId], references: [id], onDelete: Cascade)
  @@unique([userId, storeId])
  @@index([storeId])
}

model Subscription {
  id              String    @id @default(cuid())
  storeId         String    @unique
  tier            PlanTier  @default(FREE)
  status          SubStatus @default(TRIALING)
  shopifyChargeId String?
  currentPeriodEnd DateTime?
  store           Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
}

// ──────────────── Catalog ────────────────
model Product {
  id              String    @id @default(cuid())
  storeId         String
  shopifyProductId String
  title           String
  status          String    @default("active")
  createdAt       DateTime  @default(now())
  store           Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  variants        Variant[]
  @@unique([storeId, shopifyProductId])
  @@index([storeId])
}

model Variant {
  id              String    @id @default(cuid())
  storeId         String
  productId       String
  shopifyVariantId String
  sku             String?
  title           String?
  priceMinor      BigInt    @default(0)
  weightGrams     Int       @default(0)
  product         Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  costs           ProductCost[]
  inventory       InventoryLevel?
  orderLines      OrderLine[]
  @@unique([storeId, shopifyVariantId])
  @@index([storeId, productId])
}

model InventoryLevel {
  id           String  @id @default(cuid())
  storeId      String
  variantId    String  @unique
  available    Int     @default(0)
  reorderPoint Int?
  updatedAt    DateTime @updatedAt
  variant      Variant @relation(fields: [variantId], references: [id], onDelete: Cascade)
  @@index([storeId])
}

model Customer {
  id              String   @id @default(cuid())
  storeId         String
  shopifyCustomerId String
  emailHash       String   // hashed/encrypted; no raw PII in plaintext columns
  firstOrderAt    DateTime?
  ordersCount     Int      @default(0)
  orders          Order[]
  @@unique([storeId, shopifyCustomerId])
  @@index([storeId])
}

// ──────────────── Orders & money movement ────────────────
model Order {
  id                 String   @id @default(cuid())
  storeId            String
  shopifyOrderId     String
  customerId         String?
  orderNumber        String?
  currency           String
  subtotalMinor      BigInt   @default(0)
  discountMinor      BigInt   @default(0)
  shippingChargedMinor BigInt @default(0)
  taxMinor           BigInt   @default(0)
  totalMinor         BigInt   @default(0)
  financialStatus    String?
  fulfillmentStatus  String?
  country            String?
  state              String?
  zip                String?
  weightGrams        Int      @default(0)
  placedAt           DateTime
  shippingEstimated  Boolean  @default(false)
  store              Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  customer           Customer? @relation(fields: [customerId], references: [id])
  lines              OrderLine[]
  refunds            Refund[]
  transactions       Transaction[]
  shipmentCost       ShipmentCost?
  adAttributions     AdAttribution[]
  @@unique([storeId, shopifyOrderId])
  @@index([storeId, placedAt])
}

model OrderLine {
  id            String  @id @default(cuid())
  storeId       String
  orderId       String
  variantId     String?
  productId     String?
  quantity      Int
  priceMinor    BigInt
  discountMinor BigInt  @default(0)
  order         Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  variant       Variant? @relation(fields: [variantId], references: [id])
  @@index([storeId, orderId])
  @@index([storeId, variantId])
}

model Refund {
  id         String   @id @default(cuid())
  storeId    String
  orderId    String
  amountMinor BigInt
  reason     String?
  refundedAt DateTime
  order      Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  @@index([storeId, refundedAt])
}

model Transaction {
  id          String  @id @default(cuid())
  storeId     String
  orderId     String
  gateway     Gateway
  amountMinor BigInt
  feeMinor    BigInt  @default(0)
  processedAt DateTime
  order       Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  @@index([storeId, orderId])
}

// ──────────────── Cost configuration ────────────────
model ProductCost {            // temporal: resolve by order date
  id                String   @id @default(cuid())
  storeId           String
  variantId         String
  manufacturingMinor BigInt  @default(0)
  purchaseMinor     BigInt   @default(0)
  effectiveFrom     DateTime
  effectiveTo       DateTime?
  variant           Variant  @relation(fields: [variantId], references: [id], onDelete: Cascade)
  @@index([storeId, variantId, effectiveFrom])
}

model PackagingCost {
  id           String    @id @default(cuid())
  storeId      String
  scope        CostScope @default(GLOBAL)
  targetId     String?   // productId or variantId when scoped
  boxMinor     BigInt    @default(0)
  labelsMinor  BigInt    @default(0)
  insertsMinor BigInt    @default(0)
  materialsMinor BigInt  @default(0)
  @@index([storeId, scope])
}

model FulfillmentCost {
  id            String     @id @default(cuid())
  storeId       String     @unique
  warehouseMinor BigInt    @default(0)
  pickPackMinor BigInt     @default(0)
  basis         AllocBasis @default(ORDERS) // PER_ORDER vs PER_ITEM analog
}

model PaymentCostRule {
  id         String  @id @default(cuid())
  storeId    String
  gateway    Gateway
  percentBps Int     @default(0)   // 2% => 200
  flatMinor  BigInt  @default(0)
  @@unique([storeId, gateway])
}

model OperationalExpense {
  id          String     @id @default(cuid())
  storeId     String
  label       String
  amountMinor BigInt
  period      String     @default("MONTHLY") // MONTHLY | WEEKLY
  basis       AllocBasis @default(REVENUE)
  @@index([storeId])
}

model AdditionalFee {
  id          String    @id @default(cuid())
  storeId     String
  label       String
  scope       CostScope @default(GLOBAL)
  amountMinor BigInt?
  percentBps  Int?
  @@index([storeId])
}

// ──────────────── Shipping ────────────────
model ShippingRule {
  id           String       @id @default(cuid())
  storeId      String
  type         ShipRuleType
  priority     Int          @default(0)
  matcher      Json         // {country:"IN"} | {min,max} | {zipFrom,zipTo}
  amountMinor  BigInt       @default(0)
  freeOverMinor BigInt?
  active       Boolean      @default(true)
  @@index([storeId, type, priority])
}

model ShipmentCost {
  id          String       @id @default(cuid())
  storeId     String
  orderId     String       @unique
  provider    ShipProvider
  courierName String?
  costMinor   BigInt
  status      String?
  trackingId  String?
  syncedAt    DateTime     @default(now())
  order       Order        @relation(fields: [orderId], references: [id], onDelete: Cascade)
  @@index([storeId])
}

model ShippingIntegration {
  id          String       @id @default(cuid())
  storeId     String
  provider    ShipProvider
  credentials Json         // encrypted
  status      SyncStatus   @default(IDLE)
  lastSyncAt  DateTime?
  @@unique([storeId, provider])
}

// ──────────────── Advertising ────────────────
model AdIntegration {
  id          String     @id @default(cuid())
  storeId     String
  platform    AdPlatform
  credentials Json        // encrypted
  status      SyncStatus  @default(IDLE)
  lastSyncAt  DateTime?
  campaigns   Campaign[]
  @@unique([storeId, platform])
}

model Campaign {
  id                String     @id @default(cuid())
  storeId           String
  platform          AdPlatform
  externalCampaignId String
  name              String?
  status            String?
  integrationId     String
  integration       AdIntegration @relation(fields: [integrationId], references: [id], onDelete: Cascade)
  spends            AdSpend[]
  @@unique([storeId, platform, externalCampaignId])
  @@index([storeId])
}

model AdSpend {
  id                  String   @id @default(cuid())
  storeId             String
  campaignId          String
  date                DateTime
  spendMinor          BigInt
  impressions         Int?
  clicks              Int?
  conversions         Int?
  attributedRevenueMinor BigInt?
  campaign            Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  @@unique([storeId, campaignId, date])
  @@index([storeId, date])
}

model AdAttribution {
  id                 String      @id @default(cuid())
  storeId            String
  campaignId         String
  orderId            String?
  productId          String?
  method             AllocMethod
  attributedSpendMinor BigInt
  confidence         Float?
  order              Order?      @relation(fields: [orderId], references: [id])
  @@index([storeId, campaignId])
  @@index([storeId, orderId])
}

// ──────────────── Computed profit (mirror; full series in Timescale, §4) ────────────────
model ProfitSnapshot {
  id                 String   @id @default(cuid())
  storeId            String
  grain              Grain
  entityId           String
  periodStart        DateTime
  revenueMinor       BigInt
  productCostMinor   BigInt
  shippingCostMinor  BigInt
  adCostMinor        BigInt
  packagingCostMinor BigInt
  fulfillmentCostMinor BigInt
  paymentFeeMinor    BigInt
  refundsMinor       BigInt
  opexMinor          BigInt
  netProfitMinor     BigInt
  marginBps          Int
  currency           String
  computedAt         DateTime @default(now())
  @@unique([storeId, grain, entityId, periodStart])
  @@index([storeId, grain, periodStart])
}

// ──────────────── AI / alerts / reporting / ops ────────────────
model AlertRule {
  id        String    @id @default(cuid())
  storeId   String
  type      AlertType
  threshold Json
  channel   String    @default("in_app")
  active    Boolean   @default(true)
  events    AlertEvent[]
  @@index([storeId, type])
}

model AlertEvent {
  id             String   @id @default(cuid())
  storeId        String
  ruleId         String
  firedAt        DateTime @default(now())
  payload        Json
  acknowledgedAt DateTime?
  rule           AlertRule @relation(fields: [ruleId], references: [id], onDelete: Cascade)
  @@index([storeId, firedAt])
}

model Recommendation {
  id               String     @id @default(cuid())
  storeId          String
  kind             RecoKind
  entityRef        Json
  message          String
  expectedImpactMinor BigInt?
  status           RecoStatus @default(NEW)
  createdAt        DateTime   @default(now())
  @@index([storeId, status])
}

model AiConversation {
  id        String   @id @default(cuid())
  storeId   String
  userId    String
  agent     String
  createdAt DateTime @default(now())
  messages  AiMessage[]
  @@index([storeId])
}

model AiMessage {
  id             String  @id @default(cuid())
  conversationId String
  role           String
  content        String
  toolCalls      Json?
  tokensIn       Int     @default(0)
  tokensOut      Int     @default(0)
  modelUsed      String?           // ollama:llama3 | claude | openai — for cost tracking
  conversation   AiConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  @@index([conversationId])
}

model Report {
  id          String     @id @default(cuid())
  storeId     String
  type        ReportType
  periodStart DateTime
  objectKey   String     // MinIO/S3 key
  generatedAt DateTime   @default(now())
  @@index([storeId, type, periodStart])
}

model SyncState {              // per store+source health
  id         String     @id @default(cuid())
  storeId    String
  source     String     // shopify | shiprocket | meta | ...
  status     SyncStatus @default(IDLE)
  cursor     Json?
  lastOkAt   DateTime?
  lastError  String?
  @@unique([storeId, source])
}

model ProcessedEvent {         // idempotency ledger
  id           String   @id @default(cuid())
  idempotencyKey String @unique  // storeId:source:externalId:eventId
  processedAt  DateTime @default(now())
}
```

## 2. Key indexing rules
- Uniques enforce idempotent upserts: `(storeId, shopifyOrderId)`,
  `(storeId, shopifyVariantId)`, `(storeId, platform, externalCampaignId)`,
  `(storeId, campaignId, date)`, `ProcessedEvent.idempotencyKey`.
- Hot read paths: `Order(storeId, placedAt)`, `AdSpend(storeId, date)`,
  `ProfitSnapshot(storeId, grain, periodStart)`, `OrderLine(storeId, variantId)`.
- `ProductCost(storeId, variantId, effectiveFrom)` supports temporal cost resolution.

## 3. Data-integrity rules
- **Store base currency:** `Store.baseCurrency` is read from Shopify at install. Profit
  math and snapshots are in the store base currency. If an order's presentment currency
  differs, normalize amounts to base at ingestion using the order's Shopify exchange
  rate; retain the original currency/amounts for reference. Never mix currencies in a
  computation (the `Money` type enforces this). See ADR 0001.
- **Temporal product cost:** an order uses the `ProductCost` whose
  `[effectiveFrom, effectiveTo)` contains `placedAt`.
- **No raw PII columns:** customer email stored as `emailHash`; plaintext only behind
  encryption if ever required.
- **Encrypted secrets:** `Store.accessToken`, `*Integration.credentials` encrypted at
  rest (envelope encryption).
- **Cascade deletes** scoped to a store for clean uninstall; `Store.uninstalledAt`
  enables soft-delete + retention.

## 4. TimescaleDB model (profit time-series)
The full append-only snapshot series is a **hypertable** (raw migration in
`packages/db/prisma/migrations/*_timescale.sql`, applied after Prisma migrate):

```sql
-- after the profit_snapshot table exists
SELECT create_hypertable('"ProfitSnapshot"', 'periodStart',
       partitioning_column => 'storeId', number_partitions => 8,
       chunk_time_interval => INTERVAL '7 days', migrate_data => true);

-- continuous aggregate powering the executive dashboard
CREATE MATERIALIZED VIEW profit_daily
WITH (timescaledb.continuous) AS
SELECT "storeId", "grain", time_bucket('1 day', "periodStart") AS day,
       sum("revenueMinor")  AS revenue,
       sum("netProfitMinor") AS net_profit
FROM "ProfitSnapshot"
GROUP BY "storeId", "grain", day;

SELECT add_continuous_aggregate_policy('profit_daily',
  start_offset => INTERVAL '30 days', end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour');

-- retention: drop raw chunks older than 18 months (aggregates persist)
SELECT add_retention_policy('"ProfitSnapshot"', INTERVAL '18 months');
```

Dashboards read continuous aggregates (fast); drill-downs read raw snapshots. This
keeps analytics on Postgres — **no ClickHouse needed at v1 scale**.

## 5. Migrations & seed
- `pnpm db:migrate` (Prisma) then the Timescale SQL step (idempotent guard).
- `pnpm db:seed` creates a demo store, owner, sample products/variants/orders, cost
  config, and shipping rules so dashboards and tests have data.
- Migration tests live in `packages/db` (apply-from-clean + apply-on-existing).
