# 2LLazy

2LLazy is a job-search and application tracking app focused on IT roles in the Czech market.
It scrapes multiple job boards, ranks matches semantically, lets you save favourites, track application progress, generate AI cover letters, and manage interview events in one place.

## Current status

- This project is currently **OpenAI-first** for AI features (embeddings and cover-letter generation).
- Legacy auto-apply endpoints are intentionally removed (`/api/apply`, `/api/scrape/agent` return 410).
- Authentication is a simple password-based session login.

## Core features

- Search and scrape jobs from supported sources with live progress updates
- Rank results by semantic similarity to the search query
- Save favourites and move them into the dashboard pipeline
- Track application status from dashboard cards
- Generate and stream AI cover letters
- Manage interview and reminder events in a monthly calendar

## Stack

- Next.js 16 (App Router) + React + TypeScript
- Material UI v5
- Prisma 7 + PostgreSQL
- Apollo GraphQL endpoint (`/api/graphql`) + SSE routes for streaming
- OpenAI via LangChain (`text-embedding-3-small`, `gpt-4o`)

## Prerequisites

1. Node.js 20+
2. PostgreSQL
3. OpenAI API key

## Environment variables

Create `.env.local` (or update `.env`) with:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/application_fatique?schema=public"
OPENAI_API_KEY="sk-..."
SESSION_PASSWORD="at-least-32-characters-long"
ADMIN_PASSWORD="your-login-password"
```

Optional:

```env
ENCRYPTION_KEY="<64-char hex string>"
```

`ENCRYPTION_KEY` is only needed for encryption helpers or future encrypted storage features.

## Setup

```bash
npm install
npm run db:migrate
npm run db:generate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Routes

| Route | Description |
|---|---|
| `/` | Search jobs and stream scrape progress |
| `/favourites` | Saved jobs; track into dashboard |
| `/dashboard` | Application tracker and cover-letter actions |
| `/interviews` | Monthly interview/event calendar |
| `/settings` | Profile, CV uploads, and AI status |
| `/login` | Password login |

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run db:migrate
npm run db:generate
npm run db:studio
npm run db:reset
```

