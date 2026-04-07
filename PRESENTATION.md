# 2LLazy — AI-Powered Job Application Automation Platform

> *Stop copy-pasting your CV into the same form 200 times.*

---

## Overview

**2LLazy** is a full-stack web application that automates the entire job search and application lifecycle for IT professionals. It simultaneously scrapes multiple job boards, ranks results by semantic similarity to your query using vector embeddings, generates tailored cover letters via GPT-4o, and autonomously fills and submits application forms using a real browser — all from a single dashboard.

The application is now deployed to **Netlify** with a serverless-compatible Playwright setup (`@sparticuz/chromium-min` + `playwright-core`), backed by a PostgreSQL database, and powered exclusively by **OpenAI GPT-4o** and **text-embedding-3-small**.

---

## Architecture at a Glance

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT  (React 19 / MUI v5)                     │
│  Search Page  │  Dashboard  │  Favourites  │  Interviews  │  Settings  │
└──────────┬────────────────────────────────────────────────────────────-┘
           │  fetch / SSE / GraphQL (Apollo Server over HTTP)
┌──────────▼─────────────────────────────────────────────────────────────┐
│                  SERVER  (Next.js 16 App Router — Node runtime)         │
│                                                                         │
│  POST /api/scrape ──► Scraping Pipeline ──► SSE stream                 │
│  POST /api/graphql ──► Apollo Server ──► Resolvers                     │
│  POST /api/cover-letter/stream ──► GPT-4o stream ──► SSE              │
│  POST /api/apply ──► Playwright browser automation                     │
│  POST /api/uploads ──► CV storage (PostgreSQL bytea)                   │
└──────────┬─────────────────────────────────────────────────────────────┘
           │
┌──────────▼─────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                      │
│  Prisma 7  ──►  PostgreSQL (via @prisma/adapter-pg)                    │
│                                                                         │
│  JobPosting  Application  CoverLetter  Interview                        │
│  CalendarEvent  SiteCredential  CvDocument  UserProfile                │
└────────────────────────────────────────────────────────────────────────┘
           │
┌──────────▼─────────────────────────────────────────────────────────────┐
│                        AI LAYER  (OpenAI)                               │
│  text-embedding-3-small  — 1 536-dim vectors for semantic search        │
│  gpt-4o-mini             — structured job extraction (scraper)          │
│  gpt-4o                  — cover letters (full + streaming)             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Why |
|---|---|---|
| **Framework** | Next.js 16 (App Router) | Server Components, Server Actions, API Routes with `runtime = "nodejs"` |
| **Language** | TypeScript 5 | End-to-end type safety across server and client |
| **UI** | Material UI v5 + Emotion | Pre-built accessible components; dark-theme MUI |
| **State / Data** | Apollo Server 5 + GraphQL | Single typed API surface for all read/write operations |
| **ORM** | Prisma 7 + `@prisma/adapter-pg` | Type-safe DB access; driver-adapter pattern for PG connection pools |
| **Database** | PostgreSQL | JSONB column stores raw embedding vectors as `Json?` |
| **AI — embeddings** | OpenAI `text-embedding-3-small` | 1 536-dim dense vectors; cosine similarity job ranking |
| **AI — generation** | OpenAI `gpt-4o` | Cover letter generation (full + token streaming) |
| **AI — extraction** | OpenAI `gpt-4o-mini` | Structured JSON extraction from raw HTML, job-URL classification |
| **AI — orchestration** | LangGraph (`@langchain/langgraph`) | DAG-based agentic scraper with typed state and looping edges |
| **Browser automation** | `playwright-core` + `@sparticuz/chromium-min` | Headless Chromium for scraping and form-filling; serverless-safe binary |
| **Encryption** | Node.js `crypto` — AES-256-GCM | Site passwords and session cookies encrypted at rest |
| **Session** | `iron-session` | Signed, encrypted HTTP-only cookies |
| **Hosting** | Netlify + `@netlify/plugin-nextjs` | Serverless Next.js functions; esbuild-bundled with external native modules |

---

## Core Features

### 1. Semantic Job Search

A user types a query (e.g. *"React Native developer"*) and chooses a skill level. On submit:

1. The query + skill level string is embedded via `OpenAIEmbeddings.embedQuery()` → 1 536-dim vector.
2. Three scrapers run concurrently via `Promise.allSettled()`:
   - **LinkedIn** — authenticated Playwright session, filters by `f_E` experience param, geoId Czechia
   - **StartupJobs.cz** — unauthenticated; query mapped to Czech category slugs via regex rules
   - **Jobstack.it** — unauthenticated; keyword + seniority query params, Czech locale headers
3. Each job is embedded (`title × 2 + description[:1200]`) and a cosine similarity score is computed against the query vector.
4. Results stream to the UI as **SSE events** (`progress | job | error | complete`) so cards appear one by one in real time, ordered by arrival (not score).
5. Results are upserted into `JobPosting` with the embedding stored in a `Json?` column for cache reuse on subsequent searches (24-hour TTL, dimension-checked to handle provider switches).

```typescript
// Ranking kernel — O(n) dot-product scan
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
```

---

### 2. LangGraph Agentic Scraper

An alternative, agent-driven scraping mode uses LangGraph to operate as a DAG:

```
START
  └─► scrapeSearchResults   Playwright → Markdown (Turndown) + anchor list
        └─► filterJobLinks  gpt-4o-mini classifies which links are job-detail pages
              └─► scrapeJobDetail  ◄────────────────────────────────────┐
                    │  gpt-4o-mini structured output → JobPosting        │
                    ├── urlsToVisit.length > 0  ─────────────────────────┘
                    └── urlsToVisit.length = 0 ──► END
```

**State reducers** prevent the graph from stalling:
- `visitedUrls` and `errors` use **append + Set dedup** reducers — failed URLs are always consumed.
- `urlsToVisit` uses a **replace** reducer — each node owns the full remaining queue.
- `extractedJobs` uses an **append** reducer — grows across iterations.

This architecture means a single-node failure never crashes the full graph.

---

### 3. GPT-4o Cover Letter Generation (Streaming)

`POST /api/cover-letter/stream` opens a **Server-Sent Events** response. The handler:

1. Retrieves the job from PostgreSQL.
2. Reads the latest uploaded CV (`pdf-parse` for PDF, `Buffer.toString` for TXT).
3. Calls `generateCoverLetterStream()` — a LangChain `ChatOpenAI({ model: "gpt-4o", streaming: true })` async generator.
4. Each token chunk is written as `data: {"token":"..."}` into the SSE stream.
5. After the stream closes, the complete letter is persisted to `CoverLetter` and the job is auto-favourited — both inside a `prisma.$transaction([])`.

The UI renders tokens progressively via a `useRef`-backed accumulator, producing a typewriter effect.

---

### 4. AI Form-Fill Auto-Apply

`POST /api/apply` triggers `applyToJobSite()`, which:

1. Detects the job source (`LINKEDIN | STARTUPJOBS | JOBSTACK`).
2. Injects saved session cookies (AES-256-GCM decrypted) for LinkedIn; spawns a fresh anonymous context for others.
3. Navigates to the job URL and calls `applyGeneric()`:
   - **`snapshotFormFields(page)`** — injects `data-aaf-idx` attributes onto every visible, non-disabled `input | textarea | select | button` through `page.evaluate()`, then serialises each element's tag, type, id, name, placeholder, aria-label, and associated label text.
   - This snapshot is sent to `gpt-4o-mini` with user profile data + cover letter text.
   - The model returns a structured `FillPlan` (Zod-validated): an array of `{ idx, value }` field fills, an optional `fileUploadIdx` for the CV upload, and a `submitIdx`.
   - The code executes the plan: `page.fill()` for text inputs, `page.setInputFiles()` for file uploads, `page.click()` for the submit button.
4. **LinkedIn Easy Apply** gets special treatment: the modal is looped step-by-step (up to 10 steps), with AI filling each step and the code detecting whether the current step has a "Submit application" button or a "Next" / "Review" button.
5. Results: `APPLIED | FAILED | MANUAL_REQUIRED`. On `MANUAL_REQUIRED`, a visible (non-headless) browser window is opened for the user to take over manually.

---

### 5. Application Lifecycle Tracker (Dashboard)

Every application moves through a finite state machine:

```
PENDING ──► APPLIED ──► INTERVIEW ──► (manual resolution)
                  └───► REJECTED
                  └───► FAILED
```

The dashboard is a server-hydrated page (`getApplications` GraphQL query) with an optimistic-UI client layer. Status changes fire a `updateApplicationStatus` mutation and update local state immediately via `useTransition`. Cover letters are viewable inline; interviews can be scheduled directly from the card, creating a `CalendarEvent` + updating status to `INTERVIEW` inside a `prisma.$transaction`.

---

### 6. Security — Credential Storage

Site passwords are never stored in plaintext. The encryption scheme:

```
plaintext → AES-256-GCM(key=ENCRYPTION_KEY, iv=random 96-bit) → iv(hex) + authTag(hex) + ciphertext(hex)
```

- `ENCRYPTION_KEY` is a 64-character hex string (32 bytes) from the environment.
- The GCM auth tag provides **integrity verification** — tampered ciphertext throws on decrypt.
- Session cookies captured by Playwright are also encrypted before storage, allowing the app to re-authenticate automatically when a LinkedIn session expires.

---

### 7. Netlify Serverless Deployment

Running Playwright in a serverless environment requires a stripped-down Chromium binary. The browser module uses **dynamic imports** to select the right strategy at runtime:

```typescript
// src/lib/browser.ts (simplified)
if (process.env.NODE_ENV === "production") {
  const chromium = await import("@sparticuz/chromium-min");
  const { chromium: pw } = await import("playwright-core");
  return pw.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(REMOTE_TAR_URL),
    headless: chromium.headless,
  });
}
// dev: use local Playwright Chromium
const { chromium } = await import("playwright-core");
return chromium.launch({ headless: true, args: [...] });
```

`next.config.ts` marks `playwright-core` and `@sparticuz/chromium-min` as `serverExternalPackages` so Next.js does not attempt to bundle their native binaries. `netlify.toml` configures esbuild with `external_node_modules` to the same effect.

The Prisma client uses a pool of `max: 3` connections to avoid exhausting the database on concurrent Lambda cold-starts.

---

## Data Model (Prisma Schema)

```
UserProfile         — name, email, phone, linkedInUrl, githubUrl, coverLetterLanguage
JobPosting          — title, company, location, description, sourceUrl, source,
                      salary, postedAt, scrapedAt, firstSeenAt, embedding(Json),
                      favourited, →[Application], →[CoverLetter]
Application         — jobId→Job, status(enum), appliedAt, errorMessage,
                      coverLetterId→CoverLetter, →Interview
CoverLetter         — jobId→Job, content(Text), generatedByAI, →[Application]
Interview           — applicationId→Application(unique), scheduledAt,
                      durationMinutes, timezone, notes
CalendarEvent       — title, scheduledAt, durationMinutes, notes
SiteCredential      — site(enum, unique), username, encryptedPassword, cookieJson
CvDocument          — originalName, data(Bytes), size, uploadedAt
```

Embeddings are stored as `Json?` (PostgreSQL `jsonb`) — a deliberate tradeoff that avoids the `pgvector` extension dependency while still enabling in-process cosine similarity ranking over up to ~2 000 cached jobs.

---

## API Surface

| Method | Path | Transport | Purpose |
|---|---|---|---|
| `POST` | `/api/graphql` | JSON/HTTP | All read + write operations (Apollo Server) |
| `POST` | `/api/scrape` | SSE stream | Live job scraping — emits `progress`, `job`, `error`, `complete` events |
| `POST` | `/api/cover-letter/stream` | SSE stream | GPT-4o token stream + DB persist |
| `POST` | `/api/apply` | JSON/HTTP | Trigger Playwright auto-apply for one application |
| `POST` | `/api/uploads` | multipart | CV file upload (PDF/TXT → `CvDocument.data(Bytes)`) |
| `GET/DELETE` | `/api/uploads/[filename]` | binary | Download or delete a stored CV |

---

## Pages

| Route | Rendering | Description |
|---|---|---|
| `/` | Client Component | Live search — SSE consumer, session-persisted results, filter bar, job cards |
| `/favourites` | Client (hydrated) | Bookmarked jobs with apply / cover-letter actions |
| `/dashboard` | Client (hydrated) | Application tracker — filter by status, inline cover letter viewer, status mutation |
| `/interviews` | Server + Client | Monthly calendar — schedule interviews and free-form work events |
| `/settings` | Server + Client | User profile, CV upload, per-site credential management, AI health status |
| `/login` | Client | Iron-session authentication gate |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `OPENAI_API_KEY` | ✅ | Powers embeddings, cover letters, and job extraction |
| `ENCRYPTION_KEY` | ✅ | 64-char hex (32 bytes) — AES-256-GCM key for credential storage |
| `SESSION_PASSWORD` | ✅ | ≥32-char string for iron-session cookie signing |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` | ⬜ | Override Chromium binary path (auto-resolved in production via sparticuz) |

---

## Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Set environment variables
cp .env.example .env   # fill in DATABASE_URL, OPENAI_API_KEY, ENCRYPTION_KEY, SESSION_PASSWORD

# 3. Apply database migrations
npm run db:migrate

# 4. Start the dev server
npm run dev            # → http://localhost:3000
```

---

## Project Structure

```
src/
├── app/                         # Next.js App Router pages + API routes
│   ├── page.tsx                 # Search page (SSE consumer)
│   ├── dashboard/               # Application tracker
│   ├── favourites/              # Bookmarked jobs
│   ├── interviews/              # Calendar view
│   ├── settings/                # Profile, CV, credentials, AI status
│   └── api/
│       ├── graphql/route.ts     # Apollo Server HTTP handler
│       ├── scrape/route.ts      # SSE scraping endpoint
│       ├── cover-letter/stream/ # SSE cover-letter stream
│       ├── apply/route.ts       # Playwright auto-apply trigger
│       └── uploads/             # CV binary storage
├── components/                  # Shared UI components (MUI-based)
├── graphql/
│   ├── schema.ts                # GraphQL SDL type definitions
│   └── resolvers.ts             # All Query + Mutation resolvers
└── lib/
    ├── ollama.ts                # AI layer — OpenAI embeddings + GPT-4o cover letters
    ├── browser.ts               # Playwright browser factory (dev vs. serverless)
    ├── crypto.ts                # AES-256-GCM encrypt / decrypt
    ├── cv.ts                    # CV parser (PDF + TXT via pdf-parse)
    ├── similarity.ts            # Cosine similarity kernel
    ├── prisma.ts                # Prisma client singleton (pool capped for serverless)
    ├── agent/                   # LangGraph agentic scraper
    │   ├── graph.ts             # StateGraph definition + compiled agentScraper
    │   ├── nodes.ts             # scrapeSearchResults / filterJobLinks / scrapeJobDetail
    │   ├── state.ts             # GraphStateAnnotation with typed reducers
    │   └── tools/browser.ts     # navigateAndExtract (Playwright → Turndown Markdown)
    ├── apply/
    │   ├── applyGeneric.ts      # AI form-filler (snapshot → GPT-4o-mini → execute)
    │   ├── applyLinkedIn.ts     # LinkedIn Easy Apply multi-step handler
    │   └── applyRouter.ts       # Source-based apply dispatcher
    ├── auth/sessionManager.ts   # Cookie injection + re-authentication
    ├── scrapers/
    │   ├── extract.ts           # GPT-4o-mini structured job extraction
    │   ├── linkedin.ts          # LinkedIn scraper
    │   ├── startupjobs.ts       # StartupJobs.cz scraper + query→slug mapping
    │   ├── jobstack.ts          # Jobstack.it scraper
    │   └── utils.ts             # batchProcess + dismissCookies utilities
    └── data/                    # Server-side data loaders for each page
```

---

*Built with Next.js 16 · TypeScript · Prisma · PostgreSQL · OpenAI · LangGraph · Playwright · Material UI · Netlify*
