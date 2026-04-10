# EdgeCheck — CLAUDE.md

## Purpose
Sports betting analyzer + props viewer.

- Analyze user bets
- Display ranked props (Top Picks / Best Plays)
- Fast, accurate, no fluff

---

## Agent Workflow (STRICT)

OPENDER
- Find exact root cause (file + line)
- No edits, no guessing

CLAUDER
- Apply smallest fix
- Max 2 files
- No refactor unless asked

TRUTH
- Verify via real UI/API
- Must confirm result works

Flow:
1. OPENDER → root cause
2. CLAUDER → fix
3. TRUTH → verify
4. STOP

Rules:
- One task only
- No scope expansion
- No retry if verify fails

---

## Core Rules

- Do only the task requested
- Do not add features
- Stop immediately when done

---

## Stack

- Next.js (App Router, TS)
- Tailwind
- API routes
- Vercel
- Clerk (auth)
- Stripe (subscriptions)
- External odds/props APIs

---

## Auth & Payments

- Clerk handles auth
- Stripe = subscriptions only
- Server-side only (no client secrets)
- Do NOT modify unless asked

---

## App Flow

1. Props Tab:
   - Fetch props
   - Score + filter (+EV only)
   - Return Top Picks / Best Plays

2. Bet Analyzer:
   - User input → odds → verdict

---

## Critical Logic

- Props must be filtered BEFORE UI
- NO negative EV in Top Pick / Strong
- last10 data must pass through to UI

---$de

## Do NOT Touch

- Scoring engine logic
- Auth / Stripe flow
- API key handling

---

## Focus

- Fix bugs only
- Ensure correct data → UI mapping
- No new features

---

## Task Rule

1. Find root cause
2. Fix minimal (≤2 files)
3. Verify
4. STOP