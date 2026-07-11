# CONTEXT PACKET

## Repository Identity
- Name: edgecheck (edgecheck-backend)
- Purpose: Sports betting analyzer + props viewer (MLB, NBA, NHL). Bet Analyzer (odds → verdict) + ranked props (Top Picks / Best Plays).
- Primary branch pattern: feature branches under `claude/...`

## Technical Stack
- Framework: Next.js 14 (App Router), plain JavaScript (no TypeScript — no tsconfig.json present)
- UI: React 18, Tailwind (per CLAUDE.md; no tailwind.config found in root at inspection time — verify before assuming presence)
- Auth: Clerk (`@clerk/nextjs` v5, pinned for Next.js 14 compatibility per tasks/lessons.md)
- Payments: Stripe (`stripe` v21) — subscriptions only
- AI/model calls: `@anthropic-ai/sdk`, `groq-sdk`
- Deployment: Vercel (`vercel.json` defines 4 daily cron hits to `/api/batch-analyze`)
- Package manager: npm (package-lock.json present, lockfileVersion 3)
- Testing: `@playwright/test` devDependency; one spec at `tests/props.spec.ts`; no `playwright.config.*` file found; no test script wired in package.json
- Lint: no ESLint config file found in repo root; no `lint` script in package.json
- Type check: not applicable — no TypeScript config present

## Current Product State
- API routes under `src/app/api/`: batch-analyze, stripe, heaters, best-play, odds, analyze, webhooks, line-watch, games, props, splits
- Key pipeline files (per PROJECT_FLOW.md):
  - `src/app/api/props/route.js` — props fetch/merge/response shaping
  - `src/app/dashboard/DashboardClient.js` — dashboard + Smart Props UI render
  - `src/lib/mlbStats.js`, `src/lib/nbaStats.js`, `src/lib/nhlStats.js` — per-sport enrichment
- Pipeline: Fetch → Normalize → Merge → Enrich → Filter/Rank → Shape API response → Render UI
- Known instability: NBA and NHL props pipelines flagged "still unstable locally" in PROJECT_FLOW.md

## Current N
N_000: awaiting Commander instruction. All prior sequences complete, all PASS.

## Completed Feature: MLB Handedness Matchup + Edge Play (Commander-approved, 5-task sequence — DONE)
Commander asked to: (1) show opposing pitcher hand (baseball icon + word) and batter hand (bat icon + word) on MLB batter prop cards, (2) reflect the platoon-advantage matchup (opposite-hand favors batter, especially combined with a hot bat) in scoring/EV, (3) surface a dedicated "Edge Play" flag for props hitting that exact compound signal + good odds.
- N_001 (PASS): `src/lib/mlbStats.js` — bio-based `batSide` fallback via `fetchAllPlayers()` (reuses the already-fetched `/sports/1/players` response, no new network call), so batter handedness is available pre-lineup. Lineup value still wins when present.
- N_002 (PASS): `src/app/dashboard/DashboardClient.js` — `BaseballIcon`/`BatIcon` SVG components + `handLabel()` helper ("L"→"Left" etc.), replacing the old `matchupBadge` text pill on `batter_hits` cards.
- N_003 (PASS): `src/app/api/props/route.js`, `scoreMLBProp()` — compounding `+0.4 contextScore` when platoon advantage AND `isBatterHot`; mirrored `+0.3 riskPenalty` when same-hand AND `isBatterCold`. The one task authorized to touch the scoring engine (CLAUDE.md's default "Do NOT Touch" explicitly overridden by Commander for this named change only).
- N_004 (PASS): `src/app/api/props/route.js`, `scoreMLBProp()` — added `isEdgePlay` boolean, true when `hasAdvantage && isBatterHot && oddsValueScore >= 1.5 && edgeNum > 0`.
- N_005 (PASS): `src/app/dashboard/DashboardClient.js` — outlined "Edge Play" badge (reuses existing `TargetIcon`) rendered next to the tier badge when `prop.isEdgePlay` is true.
- Confirmed architectural fact (relevant if extending this further): the pipeline already pulls ALL of today's MLB games (`fetchTodaysGames`) and ALL active players league-wide (`fetchAllPlayers`), but enrichment/scoring only ever runs on players who already have a prop from Underdog/PrizePicks — Edge Play badges only existing props, does not independently scan the full slate for matchups without an offered line (Commander explicitly chose this smaller scope over a full-slate-scan alternative).
- Backlog idea surfaced but NOT started: true batter-vs-pitcher-hand split stats via MLB Stats API `sitCodes=vr`/`vl` (currently unused) — see `agent_state/QUEUE.md`.
- Important sandbox constraint for all future MLB/NBA/NHL work here: this environment's outbound network policy blocks `statsapi.mlb.com` (confirmed via `$HTTPS_PROXY/__agentproxy/status`). Live end-to-end verification isn't possible from this sandbox. Strongest verification pattern used across N_001-N_005: extract the exact shipped function (byte-identical copy, add `export` only) and run it against realistic mocked API responses / hand-constructed prop objects — this is meaningfully stronger than reimplementing the logic separately, and was specifically requested and validated by the Commander mid-sequence (see SESSION_LOG "POST-PASS VERIFICATION" entry: 19/19 assertions, including a real before/after A/B proving an actual tier flip).

## Active Constraints
- Do not modify Auth (Clerk) or Payments (Stripe) flow, scoring engine logic, or API key handling unless explicitly asked (CLAUDE.md)
- Props must be filtered BEFORE UI; no negative EV in Top Pick / Strong tiers
- last10 data must pass through to UI
- Fix one sport at a time, one pipeline layer at a time; never change merge + enrichment + UI in a single task (PROJECT_FLOW.md)
- Max 2 files per fix task unless explicitly told otherwise (CLAUDE.md, EDGECHECK_PROMPT_0.md)

## Important Architecture
- Merge behavior (MLB): Underdog is primary source, PrizePicks supplements missing props; duplicate rule = same player + same line + same prop type
- UI fallback symptoms indicate specific missing fields: `AWY @ HOM` = matchup missing, `Live` = gameTime missing, `L10: —` = last10 field missing, missing AVG = seasonAvg missing
- `.claude/commands/` contains many project-specific slash commands (contract, execute, verify, fix, dashboard, render-guard, stale-check, etc.) reflecting a pre-existing lightweight OPENDER/CLAUDER/TRUTH workflow — this 8-Hat system is layered on top of, not a replacement for, those conventions

## Deployment Notes
- Vercel; crons hit `/api/batch-analyze` at 08:00, 12:00, 16:00, 18:00 daily (see vercel.json)
- `.env` / `.env.local` / `.vercel` are gitignored — no secret values are present in this repository's tracked files

## Verification Commands
- Install: `npm install` (no node_modules committed; installed successfully during this initialization — 56 packages, 8 known audit advisories, none newly introduced)
- Build (best available real check — exercises Next.js compilation across all routes): `npm run build`
- Dev server: `npm run dev`
- Data script: `npm run splits` (runs `node scripts/runSplits.js`)
- Test: no wired script; raw Playwright spec exists at `tests/props.spec.ts` but has no config and expects a running dev server at `http://localhost:3000` — must be run manually as `npx playwright test` alongside `npm run dev`, not treated as a one-command CI check
- Lint: none configured — do not assume `next lint` passes without first confirming ESLint is set up
- Type check: not applicable (JavaScript project)

## Known Risks
- NBA and NHL props pipelines are self-documented as unstable
- No lint or type-check safety net exists — `npm run build` is the strongest available automated verification
- Playwright spec requires a live dev server and network access to real prop sources; not safe to treat as a deterministic CI gate

## Cost Ledger
| N | Cost | Tokens | Duration | Result |
|---|---:|---:|---:|---|
| N_000 | $0.00 | 0 | 0s | INITIALIZED |
| N_001 | unavailable | unavailable | ~17s (build) | PASS |
| N_002 | unavailable | unavailable | ~16s (build) | PASS |
| N_003 | unavailable | unavailable | ~15s (build) | PASS |
| N_004 | unavailable | unavailable | ~15s (build) | PASS |
| N_005 | unavailable | unavailable | ~16s (build) | PASS |

## Last Completed Work
N_001-N_005: full MLB handedness-matchup + Edge Play feature — see "Completed Feature" section above. All five `npm run build` exit 0; each verified additionally with a real-code test (byte-identical function extraction) or visual screenshot check (sandbox cannot reach live MLB API). All committed and pushed to `claude/jay-8-hat-init-cx0mbj`.

## Immediate Next Action
Awaiting Commander's next task. QUEUE.md has one unstarted proposed idea (true batter-vs-pitcher-hand split stats).
