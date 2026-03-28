---
name: refactorer
description: 'Refactor bloated files by splitting them into focused components, utilities, and helpers. Use when: a file has too many responsibilities, a client component is too long, state and UI are mixed together, function names are unclear, or a page component contains inline logic. Triggers: "refactor this", "split this file", "too much code in one file", "clean this up", "separate into components".'
argument-hint: 'Optionally describe scope: e.g. "extract the form into its own component" or "rename unclear functions"'
---

# Refactorer

Splits overloaded files into focused, well-named components and utilities.

## When to Use

- A single file exceeds ~150 lines and mixes multiple concerns
- A client component manages state, renders UI sections, AND handles async logic all in one place
- Function/variable names don't clearly describe what they do
- Multiple unrelated UI sections live in the same component
- The same inline pattern (e.g. loading state, error display) is copy-pasted across sections

---

## Procedure

### Step 1 — Read the full file first

Read the entire file in one pass. Never propose changes based on partial context.

### Step 2 — Identify logical boundaries

Group content by responsibility:

| Signal | Extract to |
|--------|-----------|
| Distinct UI section (card, panel, list) | Named component |
| Independent state + handlers | Component with own state |
| Pure data transformation | Utility function |
| Repeated inline pattern | Shared helper/component |
| Constants / config arrays | `constants.ts` or top of file |

### Step 3 — Design the split

For each extracted piece:
- Give it a **single clear responsibility** — one component, one job
- Name it after what it **does or represents**, not where it lives (`UserProfileCard`, not `Section2`)
- Define a minimal, explicit `Props` interface — no prop-spreading or catch-all objects
- Move its own state **into** the new component — don't prop-drill state that only it uses
- Each component handles its own loading state and inline success/error feedback

### Step 4 — Rename unclear functions

Apply these naming rules:

| Pattern to fix | Replace with |
|---------------|-------------|
| `handleX` where X is vague | Name after the user intent: `handleToggleFavourite`, `handleSaveCredentials` |
| `doThing` / `process` / `run` | Verb + subject: `filterApplicationsByStatus`, `buildCoverLetterPrompt` |
| `data`, `info`, `stuff` | Specific noun: `uploadedFiles`, `ollamaHealth` |
| Boolean `flag`, `check` | `is`/`has`/`can` prefix: `isUploading`, `hasOpenAI` |
| Abbreviations in public APIs | Spell out: `clDialog` → `coverLetterDialog`, `streamDlg` → `streamingDialog` |

> **Judgment call**: Only rename if it improves clarity. Don't rename internal handlers that are already obvious in context.

### Step 5 — Create extracted files

- Place components co-located with the parent (`_components/` folder) unless they are reusable across pages (then `src/components/`)
- Place utilities in `src/lib/` or alongside the feature
- Do **not** create files for one-off components that won't be reused and are <30 lines — keep those inline
- Do **not** add docstrings, comments, or type annotations to code you didn't change

### Step 6 — Rewrite the parent as a thin shell

The parent file should only:
- Declare shared state that child components need
- Wire children together (pass callbacks, shared state)
- Render the layout / page structure

If the parent is still long after extraction, repeat Steps 2–5.

### Step 7 — Verify

Run `npx tsc --noEmit` (or the project's type-check command) after all changes. Fix any type errors before finishing.

---

## Quality Checklist

- [ ] Each new file has exactly one responsibility
- [ ] No state is prop-drilled more than one level if it's only used in one subtree
- [ ] Function names read like natural language describing user intent
- [ ] Parent file renders structure only — no business logic inline
- [ ] `tsc --noEmit` exits with 0 errors
- [ ] No new abstractions created for hypothetical future use
- [ ] No comments added explaining obvious code

---

## Example Splits (from this codebase)

```
SettingsClient.tsx (520 lines)
  → AiStatusCard.tsx       — AI provider status badges
  → UserProfileCard.tsx    — profile form + save
  → CvDocumentsCard.tsx    — file upload + list
  → SiteCredentialsCard.tsx — per-site login/logout
  → SettingsClient.tsx     — 30-line shell

DashboardClient.tsx (100 lines)
  → ApplicationList.tsx    — renders filtered cards + empty state
  → DashboardClient.tsx    — filters, dialogs, status coordination

FavouritesClient.tsx (160 lines)
  → FavouritesJobList.tsx  — job cards + empty state
  → FavouritesClient.tsx   — filtering, dialog state, action handlers
```
