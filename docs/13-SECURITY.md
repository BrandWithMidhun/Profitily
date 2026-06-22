# 13 — Security

Strong, **proportionate** security — defense in depth without over-engineering. Every
practice here is concrete and justified; we do not add ceremony that doesn't reduce a
real risk. Security requirements are **not** optional "nice-to-haves" and are never cut
for speed. If a task can't meet them, **stop and flag** (`docs/14 §4`).

## 1. Principles
- **Secure by default · least privilege · fail closed.** Deny unless explicitly
  allowed; minimal scopes/permissions; on error, refuse rather than expose.
- **Defense in depth** — no single control is the only thing standing between an
  attacker and tenant data.
- **Don't roll your own crypto/auth** — use vetted libraries; configure them correctly.
- **Untrusted by default** — all external input (Shopify payloads, merchant data, API
  responses, AI prompts) is untrusted until validated.

## 2. Multi-tenant isolation (sev-1)
The top risk. Every tenant query is scoped by `storeId` through the Prisma tenant
extension, which **rejects unscoped tenant access** (fail closed). Cross-tenant data
exposure is a sev-1 defect that auto-fails review. The standing isolation test suite
(`docs/08 §3`) must be extended for every new tenant table.
**Guard boundaries:** the extension scopes only top-level Prisma model operations. It
does **not** scope `$queryRaw`/`$executeRaw` (raw SQL bypasses it — never pass tenant
data through raw SQL without a manual `storeId` predicate) or nested writes into tenant
models (use top-level ops or scope explicitly). Hardening for these is TASK-009.

## 3. Authentication
- **Sessions:** short-lived JWT access tokens + rotating refresh tokens; verify
  signature + expiry on every request; revoke on logout/uninstall.
- **Shopify:** verify Shopify **session tokens** (App Bridge) and the **OAuth** state
  on install; store the per-store access token **encrypted** (§5).
- **Passwords (if local auth ever used):** hash with **argon2id** (or bcrypt); never
  log or return them. Prefer Shopify SSO so we hold fewer credentials.

## 4. Authorization
- **Role-based** (`OWNER/ADMIN/VIEWER`) enforced **server-side** on every route — never
  trust the client. Default deny.
- **Per-store membership** checked on every tenant action (agency users only touch
  their mapped stores).
- Billing/plan gating enforced in the API, not just hidden in the UI.

## 5. Secrets & key management
- Secrets only from the typed config / secret store (Railway env per environment).
  **Never** in code, logs, or git. `.env` is git-ignored; **Gitleaks** runs in CI.
- **Token encryption:** Shopify tokens and integration credentials encrypted at rest
  with **AES-256-GCM envelope encryption**; master key in the secret store; support key
  rotation (re-wrap on rotate).
- New secret → placeholder in `.env.example` + documented; real value only in the
  secret store.

## 6. Data protection & privacy
- **PII minimization:** store customer email as a hash; avoid holding raw PII we don't
  need. No PII or secrets in logs.
- **In transit:** TLS everywhere (Railway domains, DB connections, provider APIs).
- **At rest:** DB-level encryption + app-level encryption for tokens/credentials.
- **Retention & deletion:** honor Shopify's **mandatory compliance webhooks** —
  `customers/data_request`, `customers/redact`, `shop/redact` — and delete/return data
  accordingly. On uninstall, soft-delete then purge per the retention policy.
- **PCI scope avoidance:** we **never store card data**. Payments run through gateways;
  we only read fee amounts. This keeps us out of PCI scope by design.

## 7. Input validation & output safety
- **Validate every boundary** with zod (API requests, webhook payloads, CSV imports,
  AI tool args). Reject malformed input; never partially trust.
- **No string-built SQL** — Prisma parameterizes queries. No `queryRaw` with
  interpolated user input.
- **XSS:** React escapes by default; never `dangerouslySetInnerHTML` with untrusted
  data; set a **Content-Security-Policy**.
- **CSRF:** protect state-changing browser requests (same-site cookies / token).
- **File uploads (CSV):** validate type/size, parse defensively, cap rows, never
  execute content.

## 8. Webhooks & integrations
- **Verify every inbound webhook** (Shopify HMAC) before acting; reject on mismatch.
- **Idempotent + replay-safe** (`storeId:source:externalId:eventId`) — replays are
  no-ops; protects against spoofed re-delivery.
- **Least scope** on every OAuth connection (request only the Shopify scopes and ad/
  shipping permissions actually used). Revoke tokens on uninstall/disconnect.
- Validate and bound all third-party responses before persisting.

## 9. API hardening
- Auth required on every non-public route; **default deny**.
- **Rate limiting** + request-size limits (per IP and per store) to resist abuse/DoS.
- **Security headers** (helmet: HSTS, CSP, X-Content-Type-Options, frame-ancestors for
  embedding only Shopify).
- **CORS allowlist** (our domains + Shopify), not `*`.
- **No verbose errors** to clients — generic messages outward, detail in server logs.

## 10. AI-specific security
- **Prompt-injection defense:** merchant data and tool outputs are untrusted; agents
  are **read-only** and tenant-scoped — they cannot mutate data, change settings, or
  reach another store. No destructive tool is exposed to an agent.
- **No secrets in prompts**; redact before sending to any model.
- **Output validation:** parse/validate model output before use; never `eval` it.
- **Abuse/cost limits:** per-store rate + spend caps on AI calls; log model + tokens.

## 11. Dependencies & supply chain
- Frozen lockfile; pin majors. **npm audit + OSV-Scanner** in CI; **Dependabot/
  Renovate** for security bumps. Minimal dependencies; review new ones. Avoid packages
  with untrusted install scripts.

## 12. Logging, audit & monitoring
- **Structured logs** with no PII/secrets. **Audit trail** for sensitive actions: auth
  events, role/permission changes, billing changes, integration connect/disconnect,
  data export/redaction.
- Errors to **GlitchTip**; security-relevant anomalies alert via observability
  (`docs/03`).

## 13. Infrastructure (Railway, `docs/12`)
- **Private networking** for DB, Redis, and the worker; **public domains only** for
  web/shopify-app/api. The database is never publicly exposed.
- Secrets per environment in Railway; **separate staging/prod** credentials and data.
- **DB backups** enabled; test restores.

## 14. Security in CI (from `docs/08 §2.11`)
Every PR: **Gitleaks** (secrets), **npm audit + OSV** (deps), **Semgrep** (SAST),
tenant-isolation + idempotency suites. Nightly/pre-release: **OWASP ZAP** (DAST) on the
running app. A new high/critical finding blocks merge.

## 15. OWASP Top-10 quick map
Broken access control → §2,§4 · Crypto failures → §5,§6 · Injection → §7 · Insecure
design → these guardrails + threat-aware reviews · Security misconfig → §9,§13 ·
Vulnerable components → §11 · Auth failures → §3 · Integrity/supply-chain → §11 ·
Logging/monitoring gaps → §12 · SSRF → validate/allowlist all outbound (§7,§8).

## 16. Vulnerability response (lightweight)
Triage by severity; sev-1 (tenant leak / money integrity / data loss) takes priority
over features. Ship a failing regression test before the fix (`docs/08`). For runbook
detail use the `engineering:incident-response` skill. Keep a responsible-disclosure
contact once public.

> Proportionality: this is strong coverage of real risks for a Shopify SaaS — not a
> bank. We do **not** add HSMs, custom auth servers, or zero-trust mesh for v1. If a
> control here ever feels like over-engineering for the actual threat, flag it
> (`docs/14`) rather than silently dropping or gold-plating it.
