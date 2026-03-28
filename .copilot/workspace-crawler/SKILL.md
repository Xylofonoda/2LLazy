---
name: workspace-crawler
description: Crawls the entire project to find unused imports, dead exports, unreferenced files, and unnecessary comments. Produces a prioritised cleanup list with exact file locations. Applies the rule that self-explanatory code needs no comments.
---

# Workspace Crawler

**Trigger phrases:** "crawl the workspace", "clean up the project", "find dead code", "find unused imports", "tidy up"

---

## The Comment Rule

Before crawling, internalise this principle:

> A comment is only needed when the **why** cannot be read from the code itself.
> If reading the function name, variable name, or expression tells a human what it does, the comment is noise — delete it.

**Delete** comments that:
- Restate what the next line does (`// update the user`, `// return null`)
- Label structure that's already obvious from indentation/braces (`// end of loop`, `// ── 1. Title ───`)
- Are `eslint-disable` suppressions on code that now has proper types
- Are `TODO` / `FIXME` that have already been addressed

**Keep** comments that:
- Explain a non-obvious algorithm or formula (`// Weight title heavily — strongest signal`)
- Document why a workaround exists (`// Dynamic import to avoid SSR issues`)
- Preserve context for a regex or magic number that isn't self-evident

---

## Crawl Phases

Work through each phase in order. Read files before drawing conclusions — never flag based on name alone.

### Phase 1 — Unused Imports

For every `.ts` / `.tsx` file in `src/`:

- Run a mental (or grep-backed) check: is every named import actually referenced in the file body?
- Watch for: imports left behind after refactors, `React` imported but JSX transform handles it, type imports whose only consumer was deleted
- **Tool hint:** `grep_search` for the imported name in the same file — if only the import line matches, it's dead

Key files to prioritise (most churn in this session):
- `src/graphql/resolvers.ts` — imports from `@/lib/cv`, `@/lib/similarity`, `@/lib/ollama`
- `src/lib/actions/jobActions.ts` — lost several imports after dead code removal
- `src/app/api/scrape/route.ts` — lost `cosineSimilarity` local definition
- `src/app/api/cover-letter/stream/route.ts` — lost `fs`, `path` local helpers
- `src/components/AppShell.tsx` — check MUI icon imports

### Phase 2 — Dead Exports & Unreferenced Files

For every exported function/component/constant:

- Is it imported anywhere else in `src/`? Check with `grep_search` for the export name
- For files: is the file referenced via `import` from any other file, or is it an entry point (route handler, page, layout)?

Entry points that should never be flagged as dead:
- Any `src/app/**/page.tsx`, `layout.tsx`, `error.tsx`
- Any `src/app/api/**/route.ts`
- `src/lib/prisma.ts`, `src/theme/theme.ts`, `src/types/index.ts`
- Prisma schema at `prisma/schema.prisma`

Candidates to check:
- `src/lib/agent/` subtree — is it wired to any route or action, or is the LangGraph agent orphaned?
- `src/lib/apply/applyGeneric.ts` — verify it's used by `applyRouter.ts` after Indeed removal
- `src/components/ui/ErrorAlertList.tsx` — is it rendered anywhere?
- `src/lib/scrapers/utils.ts` — is `dismissCookies` or other exports used after scraper removals?
- `src/lib/data/settings.ts` — is it called from settings server actions or the GraphQL resolver?

### Phase 3 — Unnecessary Comments

For every file, apply the comment rule above. Flag comments that are pure noise — restate the obvious or label already-clear structure.

Common patterns to look for in this codebase:
- Section dividers like `// ── 1. Title ────` inside `page.evaluate()` callbacks in scrapers
- `// eslint-disable-next-line @typescript-eslint/no-explicit-any` on lines that no longer use `any`
- `// Dynamic import to avoid issues` — acceptable only if the issue isn't obvious from context
- `// Fire-and-forget:` prefix lines — keep if the async pattern isn't idiomatic elsewhere, remove if obvious

### Phase 4 — Naming Clarity

Flag any function, variable, or file whose name doesn't make its purpose obvious to a developer unfamiliar with the codebase:

- Single-letter variables outside of tight loops (`i`, `j` in loops = fine; `d`, `e`, `v` in business logic = not fine)
- Abbreviations that aren't industry-standard (`jl`, `bs`, `co` inside scraper evaluate callbacks)
- Generic names that shadow intent (`data`, `result`, `res` as local variables when a more specific name is possible)

---

## Output Format

After all four phases, produce this report:

```
## Workspace Crawler Report

### Unused Imports
- [file] line N — `import { X }` — never referenced in file body

### Dead Exports / Unreferenced Files
- [file] — `export function X` — no importer found in src/
- [file] — entire file appears unreferenced (not an entry point)

### Unnecessary Comments  *(apply the comment rule)*
- [file] line N — comment text — reason it's noise

### Naming Clarity
- [file] line N — `variableName` — suggested rename + reason

### Clean
- Phase X — [list of files checked that had no findings]
```

**Do not report findings you are not confident about.** If a name has only one import site and you haven't verified it, say so rather than guessing.

---

## Completion Criteria

The crawl is complete when:
1. All four phases have been worked through for all files in `src/`
2. Every finding cites a specific file and line number
3. `npx tsc --noEmit` still passes after any changes you make
4. The report is sorted: most impactful cleanup at the top
