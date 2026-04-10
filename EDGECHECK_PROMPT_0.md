# EdgeCheck Prompt 0

## Project
**EdgeCheck** — sportsbook data and prop analysis app

## Pipeline
Fetch → Normalize → Merge → Enrich → Filter/Rank → Shape API → Render UI

## Data Stack
| Source      | Role                                  |
|-------------|---------------------------------------|
| ESPN        | Moneyline, spread, totals             |
| PrizePicks  | Active player prop integration (priority) |
| DraftKings  | Player/game mapping layer             |

## Worker Roles
| Role    | Scope                                      |
|---------|--------------------------------------------|
| OPENDER | Analysis only, find root cause, no edits   |
| CLAUDER | Code changes only                          |
| TRUTH   | Verify with curl and Playwright            |

## Rules
- One task per run
- Max 2 files changed unless explicitly told otherwise
- No refactor unless explicitly requested
- No redesign unless explicitly requested
- Fix one sport at a time
- Fix one layer at a time
- Do not change merge + enrichment + UI in one task

## Debug Layers
Before changing code, identify which layer has the bug:
1. Source
2. Normalize
3. Merge
4. Enrichment
5. SHAPE API RESPONSE
6. RENDER UI

## Important Files
| File                                      | Purpose                    |
|-------------------------------------------|----------------------------|
| src/app/api/props/route.js                | Props fetch/merge/response |
| src/app/dashboard/DashboardClient.js      | Dashboard + Smart Props UI |
| src/lib/mlbStats.js                       | MLB enrichment             |
| src/lib/nbaStats.js                       | NBA enrichment             |
| src/lib/nhlStats.js                       | NHL enrichment             |

## Session Start
1. Load CLAUDE.md first (general rules)
2. Load EDGECHECK_PROMPT_0.md (project context)

## How to Use This File
Load this file at the start of any EdgeCheck session. It provides the pipeline structure, data sources, worker roles, and rules needed to work on this project without re-explanation. Pair with CLAUDE.md for general coding rules.
