# Application Fatigue

A single-user local web app that scrapes Czech job boards, auto-generates cover letters with Ollama, and auto-applies to jobs using Playwright.

> **Geographic focus:** Currently targets the **Czech Republic** job market only.

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Material UI v5** dark theme
- **Prisma 7** + PostgreSQL
- **Playwright** — browser automation for scraping & applying
- **Ollama** — local LLM (embeddings + cover letters)
- **OpenAI** _(optional)_ — GPT-4o-mini for structured job extraction

## Prerequisites

1. **PostgreSQL**
2. **Ollama** running locally at `http://localhost:11434`
   ```
   ollama pull nomic-embed-text
   ollama pull llama3
   ```
3. **Node.js 20+**

## Setup

```bash
# 1. Clone and install dependencies
npm install

# 2. Configure environment
cp .env .env.local   # or edit .env directly
```

Edit `.env`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/application_fatique?schema=public"
ENCRYPTION_KEY="<generate a 64-character hex string: openssl rand -hex 32>"
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_EMBED_MODEL="nomic-embed-text"
OLLAMA_CHAT_MODEL="llama3"
OPENAI_API_KEY=""   # optional — enables GPT-4o-mini extraction
```

```bash
# 3. Create the database and run migrations
createdb application_fatique        # or via psql
npx prisma migrate dev --name init  # applies migration

# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Pages

| Route | Description |
|---|---|
| `/` | Search jobs — scrapes all supported sites live, ranks by semantic similarity, auto-apply or generate cover letter per result |
| `/favourites` | Bookmarked jobs |
| `/dashboard` | Application tracker — filter by status, view cover letters, update status |
| `/interviews` | Monthly calendar — schedule interviews and free-form work events |
| `/settings` | User profile, CV upload, per-site credentials (encrypted), AI health check |

## Scraping Pipeline

A search from the UI (`POST /api/scrape`) triggers the following:

1. **Embed query** — Ollama generates an embedding for the search query + skill level
2. **Scrape in parallel** — all 3 active scrapers run simultaneously via `Promise.allSettled()`
3. **Extract** — each scraper opens detail pages in batches (3–4 concurrent) using Playwright, with random delays to avoid rate-limiting
4. **Structured extraction** _(optional)_ — if `OPENAI_API_KEY` is set, GPT-4o-mini extracts title / company / location / salary / description from raw page text; otherwise falls back to CSS selectors + raw text
5. **Embed & rank** — each job is embedded (title×2 + description) and ranked by cosine similarity to the query
6. **Stream** — results are returned as SSE events (`progress`, `job`, `error`, `complete`) so the UI updates in real time

Results are deduplicated by `sourceUrl` and upserted into the database on every scrape.

## Supported Job Sites

| Site | Auth | Skill-level filter | Notes |
|---|---|---|---|
| [LinkedIn](https://www.linkedin.com) | Login required | `f_E` experience param | geoId filtered to Czechia; scrolls + opens detail pages; no salary extraction |
| [StartupJobs.cz](https://www.startupjobs.cz) | None | Seniority query param | Query mapped to Czech category slugs (see below) |
| [Jobstack.it](https://www.jobstack.it) | None | Seniority query param | Keyword search; Czech locale headers |

Each scraper returns up to **10 results** (no pagination). Sites requiring login store credentials encrypted with AES-256-GCM via the Settings page. Playwright re-authenticates automatically when sessions expire.

> **Inactive sources:** The `JobSource` enum also includes `INDEED` and `GLASSDOOR` but no scrapers are implemented for these yet.

### StartupJobs category mapping

StartupJobs uses path-based category slugs instead of keyword search. The scraper maps your query to Czech slug(s):

| Query contains | Slug(s) used |
|---|---|
| react, vue, angular, next.js, frontend, css, typescript, javascript | `front-end-vyvojar` |
| node, php, java, python, rust, go, backend | `back-end-vyvojar` |
| fullstack | `full-stack-vyvojar` + front + back |
| react native | `react-native-vyvojar` + `mobilni-vyvojar` |
| ios | `ios-vyvojar` |
| android | `android-vyvojar` |
| devops, kubernetes, docker, terraform, aws, azure, gcp | `devops-inzenyr` |
| data science, ML, AI, pytorch, tensorflow | `data-scientist` |
| QA, testing, cypress | `qa-tester` |
| ui, ux, figma | `ui-ux-designer` |
| product | `product-manager` |
| security | `security-inzenyr` |
| _(no match)_ | `front-end-vyvojar`, `full-stack-vyvojar`, `back-end-vyvojar` |

### Shared utilities

| Utility | Purpose |
|---|---|
| `batchProcess(items, size, fn)` | Process items in concurrent batches; drops failures silently |
| `dismissCookies(page)` | Clicks away GDPR / cookie banners (20+ selector patterns) |
| `extractJobFromText(text, hint)` | GPT-4o-mini structured extraction (falls back to hint values if no API key) |

## Development Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npx prisma studio    # DB GUI
npx prisma generate  # Regenerate Prisma client after schema changes
```

