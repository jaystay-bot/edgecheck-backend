# ROADMAP

## Product
EdgeCheck — sports betting analyzer and props viewer.
- Analyze user bets (Bet Analyzer: user input → odds → verdict)
- Display ranked props (Top Picks / Best Plays) across MLB, NBA, NHL (per PROJECT_FLOW.md)
- Fast, accurate, no fluff (per CLAUDE.md)

## Current Objective
UNKNOWN — requires Commander input. No active CURRENT_N intent exists as of this initialization.

## Strategic Priorities
Derived from repository docs (tasks/lessons.md, PROJECT_FLOW.md), not yet Commander-ratified:
- Correct data → UI mapping for props (matchup, gameTime, last10 fields, seasonAvg)
- Filter props BEFORE UI; no negative-EV props in Top Pick / Strong tiers
- Stabilize NBA and NHL prop pipelines (flagged "still unstable locally" in PROJECT_FLOW.md)
- Auth (Clerk) and payments (Stripe) flows are working and must not regress

## Non-Negotiable Constraints
From CLAUDE.md and PROJECT_FLOW.md:
- Do not modify Auth (Clerk) or Payments (Stripe) flow unless explicitly asked
- Do not modify scoring engine logic or API key handling unless explicitly asked
- Props must be filtered BEFORE UI; no negative EV in Top Pick / Strong
- last10 data must pass through to UI
- Fix one sport at a time; fix one layer at a time (source / normalize / merge / enrichment / response shaping / UI render)
- Never change merge + enrichment + UI in one task
- Server-side only for auth/payment secrets (no client secrets)

## Major Milestones
UNKNOWN — requires Commander input.

## Deferred Work
See tasks/research.md and tasks/lessons.md for known pipeline issues (NBA/NHL instability, EV threshold tuning, caching strategy). Not yet triaged into N tasks.

## Commander Decisions
None recorded yet.

## Last Updated
2026-07-11 — initial 8-Hat installation.
