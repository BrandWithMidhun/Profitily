# 14 — Engineering Principles

Three things govern how code gets written here: **build only what the spec needs**,
**do it the proven way**, and **when in doubt, stop and flag**. These apply to every
plan, build, and review.

## 1. No over-engineering (YAGNI)

Build the **simplest thing that satisfies the spec and its acceptance criteria** —
nothing more.

- **No speculative features.** If it isn't in `docs/`, don't build it; propose it as a
  new task instead.
- **No premature abstraction.** Write the concrete version first. Introduce an
  abstraction only on the **third** real, different use — not the first.
- **No premature optimization.** Make it correct and clear; optimize only against a
  measured problem (profile first).
- **Prefer boring, proven solutions** over clever ones. Fewer moving parts, fewer
  dependencies.
- **Configurability costs.** Don't make things configurable "just in case" — each
  option is surface area to test and secure.

### What over-engineering looks like here (avoid)
- A generic "integration plugin framework" when we have a handful of named providers.
- A custom queue/cache/ORM layer wrapping BullMQ / Redis / Prisma.
- Microservices for what a **modular monolith** (this repo) handles fine.
- Deep inheritance hierarchies, "enterprise" patterns, or DI gymnastics where a plain
  function or module would do.
- Caching, sharding, or ClickHouse before metrics show Timescale can't keep up.

### What is NOT over-engineering (these are required, keep them)
Tenant isolation, money-as-integers, idempotency, encryption of tokens, input
validation, and the test suites are **mandated by the specs**. They are correctness and
security, not gold-plating. Never cut them in the name of "simplicity."

> The test: *"Does this exist because a current requirement needs it?"* If yes, build
> it well. If "we might need it later," don't — note it as a possible future task.

## 2. Best practices (pragmatic)

- **Small, focused units.** One responsibility per function/module; clear names; no
  dead code.
- **Typed boundaries.** zod-validate all external input; strong TypeScript types
  internally; `strict` on.
- **Pure core.** Business math in `packages/core` stays I/O-free and deterministic
  (fixed clock in tests).
- **Explicit error handling.** No silent catches; fail closed; return typed errors;
  never leak internals to clients.
- **Respect module boundaries** (`docs/05`) — talk via interfaces/events, never reach
  into another module's tables.
- **Tests are part of the work**, in the same PR; meaningful tests over coverage
  theater (`docs/08`). Bug fixes ship with a failing-first regression test.
- **Idempotent, retry-safe** side effects (`docs/02 §6`).
- **Atomic commits**, Conventional Commits, docs updated in the same change.
- **Readability first** — code is read far more than written; optimize for the next
  reader (human or Claude).

## 3. Source-of-truth & decision hierarchy

When sources conflict, this is the order — and a conflict is itself a reason to flag:

1. The **spec docs** (`docs/01`–`13`) and the **Build Request** acceptance criteria.
2. **`CLAUDE.md`** conventions.
3. A **planner decision** in chat.

If two of these disagree, or none answers the question → **stop and flag** (next
section). Do not pick one silently.

## 4. The Stop-and-Flag protocol  ⛳

**If anything is ambiguous, conflicting, risky, or tempts you outside the spec — STOP.
Do not guess. Raise a flag, wait for the planner's review, then continue.** Guessing on
any of these is a defect, even if the guess happens to work.

### Stop and flag when you hit any of these
- **Ambiguity / missing decision** — the spec doesn't clearly answer a question needed
  to proceed (e.g. currency handling, an undefined edge case, an unclear acceptance
  criterion).
- **Conflicting sources** — two docs, or a doc and `CLAUDE.md`, or a design drop and a
  page spec, disagree.
- **Scope creep / temptation to over-engineer** — the cleanest path adds something not
  in the spec, or a speculative abstraction. Flag instead of building it.
- **Security or data risk** — a step would weaken a guardrail (tenant scoping, money
  integrity, secret handling) or you can't meet a security requirement as written.
- **Destructive or irreversible action** — schema drops, deleting migrations, data
  deletion, force-push.
- **New dependency, especially paid** — anything needing an ADR.
- **External blocker** — a provider sandbox, credential, or decision you don't have.

### Flag format (use `docs/templates/FLAG.md`)
A flag states: the task/step, **what's unclear or risky**, why it blocks (or what
silent assumption you'd otherwise make), **2–3 concrete options with a recommendation**,
and what you need from the planner to proceed. Keep working on unblocked parts if you
safely can; otherwise pause.

### What happens next
Planner reviews the flag, decides (and, if it's a lasting rule, updates `CLAUDE.md`/the
spec), and replies. You then continue. A flag is **never** a failure — catching a doubt
early is exactly the behavior we want; a wrong silent guess is the failure.

## 5. How these show up in the loop
- **Implementation Plan** must list any flags/open questions (don't proceed past them).
- **Build Summary** must disclose any assumption made and any flag still open.
- **Reviewer** checks that nothing ambiguous was silently guessed and nothing
  over-engineered slipped in.

> One line to remember: **simplest correct thing, done the proven way, and when unsure —
> flag, don't guess.**
