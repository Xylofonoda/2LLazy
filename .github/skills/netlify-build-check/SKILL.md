---
name: netlify-build-check
description: 'Simulate a Netlify production build locally before pushing. Use when: fixing a Netlify build error, about to push a fix to Netlify, want to verify no TypeScript errors before deploying, netlify build failing, build check before push, pre-deploy validation, simulate netlify, check before upload. Runs prisma generate + strict tsc + next build in the same sequence Netlify uses — catches implicit any, missing Prisma types, and NODE_ENV issues before they hit CI.'
argument-hint: 'Optional: path to a specific file to type-check first'
---

# Netlify Build Check

Reproduces Netlify's exact build sequence locally to catch TypeScript and build errors **before** pushing.

## Why This Exists

Netlify's build environment differs from local in three key ways:
1. **No pre-generated Prisma client** — `@prisma/client` types (enums, models) don't exist until `prisma generate` runs
2. **Stricter type inference** — Netlify's TS compiler rejects implicit `any` in `.map()` / `.filter()` callbacks that local builds tolerate
3. **Fresh `node_modules`** — no leftover type cache; everything must be resolvable from scratch

---

## Procedure

### Step 1 — Regenerate Prisma Client
```bash
npx prisma generate
```
This ensures all Prisma enums and model types (`ApplicationStatus`, `JobSource`, etc.) are available to TypeScript.

### Step 2 — Strict TypeScript Check
```bash
npx tsc --noEmit
```
Run this **before** `next build`. It's faster and reports all type errors at once. Fix every error before continuing.

### Step 3 — Full Next.js Build
```bash
npm run build
```
Runs compilation + TypeScript + route generation exactly as Netlify does.

---

## Common Netlify-Specific Errors & Fixes

### Implicit `any` in array callbacks
**Error:** `Parameter 'r' implicitly has an 'any' type`
**Cause:** `array.map((r) => ...)` where the array type can't be inferred
**Fix:** Use a typed `for...of` loop instead:
```ts
// ❌ Fails on Netlify
const map = new Map(records.map((r) => [r.id, r]));

// ✅ Works everywhere
const map = new Map<string, RecordType>();
for (const r of records) { map.set(r.id, r); }
```

### Missing Prisma enum exports
**Error:** `Module '@prisma/client' has no exported member 'ApplicationStatus'`
**Cause:** Prisma client was never generated in the CI environment
**Fix:** Ensure `netlify.toml` build command starts with `npx prisma generate &&`:
```toml
[build]
  command = "npx prisma generate && npm run build"
```

### Missing `@types/*` packages
**Error:** `Could not find a declaration file for module 'react-dom'`
**Cause:** `NODE_ENV = "production"` in `netlify.toml` causes `npm install` to skip `devDependencies`
**Fix:** Remove `NODE_ENV = "production"` from `netlify.toml` — Next.js sets it automatically during build

### `typeof array[number]` not resolved
**Error:** Type errors when using `typeof existingRecords[number]` in generic position
**Fix:** Define an explicit named type instead:
```ts
type RecordItem = { id: string; name: string; ... };
const map = new Map<string, RecordItem>();
```

---

## Netlify `netlify.toml` Checklist

Before pushing, verify `netlify.toml` has:
- [ ] `command = "npx prisma generate && npm run build"`
- [ ] `publish = ".next"`
- [ ] `[[plugins]] package = "@netlify/plugin-nextjs"`
- [ ] **No** `NODE_ENV = "production"` in environment (this breaks devDep installs)
- [ ] All required env vars listed (not their values — just the keys)

---

## Required Netlify Environment Variables

Set these in **Netlify → Site settings → Environment variables**:

| Key | Description |
|-----|-------------|
| `DATABASE_URL` | Neon/Postgres connection string with `?sslmode=require` |
| `OPENAI_API_KEY` | OpenAI API key |
| `SESSION_PASSWORD` | iron-session cookie key (32+ chars) |
| `ADMIN_PASSWORD` | Login password for `/login` |
| `ENCRYPTION_KEY` | 64-char hex encryption key |

---

## Quick Pre-Push Checklist

Run these in order and only push when all pass:

```bash
npx prisma generate
npx tsc --noEmit
npm run build
```

If `tsc --noEmit` fails, fix all errors before running `npm run build`. Do not rely on local build success as a proxy for Netlify success.
