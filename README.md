# Application Fatigue

A single-user local web app that scrapes Czech job boards, auto-generates cover letters with Ollama, and auto-applies to jobs using Playwright.

> **Geographic focus:** Currently targets the **Czech Republic** job market only.

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Material UI v5** dark theme
- **Prisma 7** + PostgreSQL + pgvector (semantic job search)
- **Apollo Server v5** — GraphQL API at `/api/graphql`
- **Playwright** — browser automation for scraping & applying
- **Ollama** — local LLM (embeddings + cover letters)

## Prerequisites

1. **PostgreSQL** with the `pgvector` extension available
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
```

```bash
# 3. Create the database and run migrations
createdb application_fatique        # or via psql
npx prisma migrate dev --name init  # applies migration + enables pgvector

# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Pages

| Route | Description |
|---|---|
| `/` | Search jobs — scrapes all supported sites live, auto-apply or generate cover letter per result |
| `/favourites` | Bookmarked jobs |
| `/dashboard` | Application tracker — filter by status, view cover letters, update status |
| `/interviews` | Monthly calendar — schedule and track interviews |
| `/settings` | User profile, CV upload, per-site credentials (encrypted), Ollama health check |

## Supported Job Sites

| Site | Region | Notes |
|---|---|---|
| [LinkedIn](https://www.linkedin.com) | CZ (geoId filtered) | Requires login |
| [cz.indeed.com](https://cz.indeed.com) | CZ | Requires login |
| [StartupJobs.cz](https://www.startupjobs.cz) | CZ | No login needed — query mapped to Czech category slugs |
| [Jobstack.it](https://www.jobstack.it) | CZ | No login needed — keyword search |

Sites requiring login (LinkedIn, Indeed) store credentials encrypted with AES-256-GCM. Playwright re-authenticates automatically when sessions expire.

### StartupJobs category mapping

StartupJobs uses path-based category slugs instead of keyword search. The scraper automatically maps your query to the appropriate Czech slug(s):

| Query contains | Slug(s) used |
|---|---|
| react, vue, angular, frontend, css | `front-end-vyvojar` |
| node, java, python, php, backend | `back-end-vyvojar` |
| fullstack | `full-stack-vyvojar` + front + back |
| react native | `react-native-vyvojar` + `mobilni-vyvojar` |
| devops, kubernetes, docker, aws | `devops-inzenyr` |
| data science, ML, AI | `data-scientist` |
| QA, testing, cypress | `qa-tester` |
| ui, ux, figma | `ui-ux-designer` |
| unknown query | `front-end-vyvojar,full-stack-vyvojar,back-end-vyvojar` |

## Development Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npx prisma studio    # DB GUI
npx prisma generate  # Regenerate Prisma client after schema changes
```

