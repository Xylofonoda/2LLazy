---
name: code-review
description: Performs a full senior-level code review of the project, covering security (OWASP Top 10), architecture, performance, and DX. Produces a prioritised action plan with CRITICAL/HIGH/MEDIUM/LOW severities.
---

# Senior Developer Code Review

**Trigger phrases:** "review the project", "code review", "audit the codebase", "senior review"

## Stack Context

Before reviewing, load this mental model of the project:

- **Framework:** Next.js 16 App Router (`src/app/`), Turbopack in dev
- **Database:** Prisma 7 + PostgreSQL via `PrismaPg` adapter — singleton in `src/lib/prisma.ts`
- **UI:** MUI v5, all theme in `src/theme/theme.ts`
- **AI:** Ollama local (`nomic-embed-text` for embeddings, `llama3` for generation) — `src/lib/ollama.ts`
- **Auth pattern:** Encrypted credentials in DB (`AES-256-GCM`), Playwright session cookies
- **Data flow:** RSC pages → server actions (`src/lib/actions/`) → Prisma; GraphQL at `/api/graphql` for legacy search page mutations
- **Streaming:** SSE via `TransformStream` in Next.js route handlers

---

## Review Process

Work through these phases in order. For each finding, assign a severity before moving on.

### Phase 1 — Security (OWASP Top 10)

Examine every file in `src/app/api/`, `src/lib/actions/`, `src/graphql/`, `src/lib/auth/`:

- [ ] **Input validation** — Are user-supplied strings (jobId, query, profile fields) validated before reaching Prisma or the shell? Check every route handler and server action
- [ ] **Injection** — Any raw SQL or dynamic GraphQL query construction? Any `eval` or template literals passed to shell commands?
- [ ] **Secrets** — Are API keys, DB URLs, or encryption keys referenced only via `process.env`? No hardcoded values
- [ ] **Encryption** — `src/lib/crypto.ts`: verify AES-256-GCM is used correctly (unique IV per encryption, no key reuse, authenticated decryption)
- [ ] **SSRF** — `src/lib/scrapers/`: are target URLs hardcoded or validated before Playwright navigates to them?
- [ ] **File uploads** — `src/app/api/uploads/route.ts`: is file type validated? Is the upload path sanitised to prevent path traversal?
- [ ] **Session/cookie handling** — `src/lib/auth/sessionManager.ts`: are stored cookies encrypted? Can a user overwrite another user's session?

### Phase 2 — Architecture & Patterns

Read `src/app/`, `src/lib/data/`, `src/lib/actions/`, `src/components/`:

- [ ] **RSC / Client boundary** — Are there any `"use client"` components that do `fetch()` in `useEffect` instead of being data-loaded by RSC?
- [ ] **Server action misuse** — Do server actions call `revalidatePath()` after mutations? Are they imported only in client components or other server code (never in RSC render)?
- [ ] **Prisma N+1** — Any `.findMany()` calls that then loop and call Prisma again? Check all data files
- [ ] **Prisma transaction safety** — Mutations that need atomicity (cover letter + favourite) — are they in `prisma.$transaction`?
- [ ] **Error boundaries** — Are async RSC pages wrapped so a single data failure doesn't crash the entire layout?
- [ ] **Type safety** — No `any` escapes at system boundaries (route handler bodies, GraphQL resolver args, SSE event parsing)

### Phase 3 — Performance

Read `src/app/api/scrape/route.ts`, `src/lib/ollama.ts`, `src/lib/data/`:

- [ ] **Embedding calls** — Is `generateEmbedding()` called in a tight loop without concurrency control? Consider batching or parallelising with `Promise.all` where order doesn't matter
- [ ] **DB queries** — Are `include` depths reasonable? Any missing `where` clauses that could return the entire table?
- [ ] **Bundle size** — Is Playwright imported in any file that could end up in the client bundle? (`"use server"` or route handlers only)
- [ ] **Streaming correctness** — Are `TransformStream` writers always closed in a `finally` block even on error? An unclosed writer leaks the HTTP connection
- [ ] **Session storage** — `page.tsx` persists the full job list (including embeddings?) to `sessionStorage`. Check the serialised size

### Phase 4 — Developer Experience

Read `src/types/index.ts`, `src/components/`, `src/lib/`:

- [ ] **Type duplication** — Is the same shape defined in both `src/types/index.ts` and inline in a component or resolver?
- [ ] **Component props** — Are optional callbacks typed with `?` and guarded before calling?
- [ ] **Dead code** — Any imports, functions, or files that are no longer referenced after recent refactors?
- [ ] **Env variables** — Does a `.env.example` exist? Are all required env vars documented?
- [ ] **Error messages** — Are user-facing errors descriptive enough to act on, or just `String(err)`?

---

## Output Format

After completing all four phases, produce a **prioritised action plan** in this format:

```
## Code Review — Prioritised Action Plan

### CRITICAL (fix before shipping)
1. [file:line] Issue — explanation — recommended fix

### HIGH (fix this sprint)
1. ...

### MEDIUM (address soon)
1. ...

### LOW / DX (nice to have)
1. ...

### No issues found in
- Phase X — Y (clean)
```

**Severity guide:**
- **CRITICAL** — exploitable security vulnerability or data loss risk
- **HIGH** — correctness bug, potential runtime crash, or significant security weakness
- **MEDIUM** — tech debt, missing validation, or pattern violation that will hurt maintainability
- **LOW / DX** — naming, unused code, missing docs, minor inconsistencies

---

## Completion Criteria

The review is complete when:
1. All checklist items are marked or explicitly noted as N/A with a reason
2. Every finding is assigned a severity and has a concrete fix suggestion (not just a description)
3. The action plan is sorted so the most urgent items are at the top
4. `npx tsc --noEmit` passes — confirm before ending the review
