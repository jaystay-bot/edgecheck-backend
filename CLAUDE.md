# EdgeCheck — CLAUDE.md

## Purpose
Sports bet analyzer.
User inputs bet → returns verdict in <2 seconds.

Core:
Fast answer. No complexity.

---

## Rules (Strict)
- Do only the task requested
- Do not add features
- Do not expand scope
- Stop when task is complete

---

## Stack
- Next.js App Router + TypeScript
- Tailwind
- Next.js API routes
- Vercel
- Whop ($4.99/month)
- The Odds API (server-side only)
- No DB, no auth

---

## Core Flow
1. User inputs bet
2. Fetch odds (API route)
3. Run analyzer
4. Return verdict card
5. Show affiliate links

---

## Core Logic (betAnalyzer.ts)
- impliedProbability(odds)
- calculateValueScore(userOdds, marketOdds)
- detectSharpMoney()
- generateVerdict()

Verdict:
- GOOD → value > +3% AND sharp signal
- COIN_FLIP → neutral/conflict
- BAD → negative value

---

## Data Rules
- Sharp money = simulated
- Public lean = simulated
- Never present as real data

---

## Hard Constraints
- No auth
- No database
- No bet tracking
- No parlays
- No AI chat
- No complex stats
- Mobile-first
- Response < 2 seconds
- Never expose API keys client-side

---

## Files
- /app/page.tsx
- /app/api/odds/route.ts
- /lib/betAnalyzer.ts
- /components/InputForm.tsx
- /components/ResultCard.tsx

---

## Do NOT Touch
- betAnalyzer core logic (unless explicitly asked)
- API route security (key handling)
- response speed requirement

---

## Current Focus
Distribution > product

Do NOT build new features.
Fix bugs or improve speed only.

---

## Task Rule
Before any change:
- Identify task
- Touch minimal files
- Do not modify unrelated code
- Verify result
- Stop

Do NOT touch betAnalyzer unless explicitly asked