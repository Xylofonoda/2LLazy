---
name: scraper-optimizer
description: "Analyze and optimize the job scraping pipeline for speed. Use when: scraping is slow, jobs take too long to appear, embeddings bottleneck the pipeline, want to stream results faster, want to add caching or reduce Playwright overhead. Triggers: 'scraping is slow', 'jobs take too long', 'optimize scraper', 'faster results', 'speed up search'."
argument-hint: "Describe what feels slow (overall search, specific site, embedding step, DB writes) or just say 'optimize scraper'."
---

# Scraper Optimizer

Diagnoses and fixes bottlenecks in the job scraping pipeline. Focuses on measurable speed improvements — not just structural refactors.

## Pipeline Map

The current scrape flow (each is a potential bottleneck):

```
POST /api/scrape
  │
  ├─ 1. generateEmbedding(query)            ← Ollama call, serial
  │
  ├─ 2. Promise.allSettled(scrapers)        ← LinkedIn + StartupJobs + Jobstack run in parallel
  │     │
  │     └─ per scraper:
  │           ├─ Playwright browser.newContext / getAuthenticatedPage
  │           ├─ page.goto(listingUrl)       ← network I/O
  │           ├─ scroll + waitForSelector    ← timing delays (randomDelay 800–3500ms)
  │           ├─ extract up to 10 card seeds (DOM evaluation)
  │           └─ batchProcess(seeds, batchSize=3..4):
  │                 ├─ per seed: detailPage.goto(url)   ← network I/O
  │                 ├─ extractJobFromText(bodyText)      ← GPT-4o-mini if OPENAI_API_KEY set
  │                 └─ generateEmbedding(jobText)        ← Ollama call per job (serial inside batch)
  │
  ├─ 3. Sort collectedJobs by similarity
  │
  └─ 4. SSE: emit jobs one by one
```

**Key facts:**
- All scrapers run in parallel but embeddings within each scraper run as `batchSize=3` sequential batches
- `extractJobFromText` uses GPT-4o-mini when `OPENAI_API_KEY` is set — adds ~1–2s per job
- `randomDelay` intentionally slows LinkedIn to avoid bot detection — do not remove for LinkedIn
- Jobs are only emitted after ALL scrapers finish — so the slowest scraper blocks the whole result set
- `generateEmbedding` calls Ollama locally — parallel calls may queue/block depending on Ollama config

---

## Step 1 — Read the current pipeline

Before suggesting any change, read:
- `src/app/api/scrape/route.ts` — orchestration, batch sizes, emit order
- `src/lib/scrapers/linkedin.ts`, `startupjobs.ts`, `jobstack.ts` — per-scraper timing
- `src/lib/scrapers/utils.ts` — `batchProcess` implementation
- `src/lib/scrapers/extract.ts` — is GPT extraction active?
- `src/lib/ollama.ts` — how `generateEmbedding` works

---

## Step 2 — Identify the actual bottleneck

Ask or measure:

| Symptom | Likely cause |
|---|---|
| >30s total, all scrapers slow | Playwright cold-start or Ollama queue |
| StartupJobs/Jobstack slow, LinkedIn fast | DOM wait / networkidle on Czech sites |
| Fast parse, slow emit | Embeddings blocking — increase batch size or parallelise |
| GPT extraction active | `OPENAI_API_KEY` set — each job costs 1–2s |
| Jobs stream fine live, slow on first load | Ollama model not warm (run a dummy call at startup) |
| DB upsert slow | Missing index on `sourceUrl` or cold connection pool |

---

## Step 3 — Apply fixes in order of impact

### 🔴 Highest impact

**Stream jobs as they arrive per scraper, not after all scrapers finish**

Currently all scrapers run in `Promise.allSettled`, jobs are sorted, then emitted. This means the user waits for LinkedIn AND StartupJobs AND Jobstack before seeing anything.

Instead: emit jobs immediately per scraper as each job is embedded and saved. Apply a similarity sort only within each scraper's batch, or do a final re-sort client-side.

```ts
// In route.ts — instead of collecting then sorting:
await Promise.allSettled(
  scrapers.map(async (scraper) => {
    const jobs = await scraper.fn();
    for (let i = 0; i < jobs.length; i += 3) {
      await Promise.allSettled(
        jobs.slice(i, i + 3).map(async (job) => {
          const embedding = await generateEmbedding(...);
          const saved = await prisma.jobPosting.upsert(...);
          const similarity = cosineSimilarity(queryEmbedding, embedding);
          await send({ type: "job", data: { ...job, id: saved.id, similarity, favourited: saved.favourited } });
          // Emit immediately — don't wait for other scrapers
        })
      );
    }
  })
);
```

**Trade-off**: jobs arrive out of similarity order. Client can sort them as they arrive.

---

**Increase embedding batch size**

Current: `batchSize = 3`. Ollama on modern hardware can handle 5–8 concurrent requests without significant queue delay. Test with `batchSize = 5`.

---

### 🟡 Medium impact

**Skip re-scraping recently seen jobs**

Before scraping a job detail page, check if that `sourceUrl` was upserted in the last N hours and already has an embedding. If so, skip the detail fetch and embedding — just reuse the DB record.

```ts
const existing = await prisma.jobPosting.findUnique({
  where: { sourceUrl: seed.sourceUrl },
  select: { id: true, embedding: true, scrapedAt: true, favourited: true },
});
const ageHours = existing ? (Date.now() - existing.scrapedAt.getTime()) / 3_600_000 : Infinity;
if (existing?.embedding && ageHours < 24) {
  // skip scraping, use existing embedding
  const similarity = cosineSimilarity(queryEmbedding, existing.embedding as number[]);
  return { job: { ...seed, id: existing.id, favourited: existing.favourited }, similarity };
}
```

---

**Warm Ollama at server startup**

If the Ollama model isn't loaded, the first embedding call takes 10–20s to load the model into VRAM. Add a fire-and-forget warm-up call in `src/lib/ollama.ts`:

```ts
// At module load time — outside any function
generateEmbedding("warmup").catch(() => {});
```

---

**Reduce `randomDelay` floor on non-LinkedIn scrapers**

StartupJobs and Jobstack don't require anti-bot delays. Current delays:
- List page: `randomDelay(800, 1400)` 
- Detail pages: `randomDelay(200, 500)` (Jobstack) / `randomDelay(800, 1500)` (StartupJobs)

StartupJobs detail page delay can safely drop to `randomDelay(100, 300)`.

Do NOT reduce LinkedIn delays — `randomDelay(2000, 3500)` on the listing page is necessary.

---

### 🟢 Lower impact / optional

**Disable GPT extraction if OPENAI_API_KEY is set but results feel too slow**

`extractJobFromText` calls GPT-4o-mini per job. With 10 jobs per scraper × 3 scrapers = 30 API calls. At ~1s each this adds ~10s to each scraper batch. If quality isn't the priority, set `OPENAI_API_KEY=` to empty to use the regex fallback.

**Add a job count cap per scraper**

Currently scrapes up to 10 cards. Dropping to 6–7 reduces detail page fetches by ~30%.

**Browser context reuse**

LinkedIn reuses an authenticated page context if one exists. StartupJobs and Jobstack each create a fresh `browser.newContext()` per scrape. Reusing contexts across calls (with a connection pool) saves ~300ms cold-start per call.

---

## Step 4 — Validate the change

After any change to `route.ts` or scrapers:

1. Run `npx tsc --noEmit` — verify no type errors
2. Do a live test search — observe SSE events in Network tab (DevTools → Network → scrape → EventStream)
3. Check that progress events still fire correctly and the UI doesn't break if jobs arrive out of order

---

## Step 5 — Update the client if streaming order changes

If jobs are emitted per-scraper rather than globally sorted, update `src/app/page.tsx` to sort `filteredJobs` by `similarity` descending before rendering:

```ts
const filteredJobs = jobs
  .filter(/* existing filters */)
  .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
```

This ensures the UI always shows best matches first even as new jobs stream in.
