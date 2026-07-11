# CURRENT N
status: locked
N: N_004

## Intent
In `scoreMLBProp()` (`src/app/api/props/route.js`), compute an `isEdgePlay` boolean flag on the returned score object when a prop hits the specific compound signal the Commander asked to surface: favorable handedness matchup + hot recent bat (the same condition N_003 already compounds the score for) + strong odds value + positive edge. This is task 1 of 2 in a Commander-approved follow-up sequence:
- N_004 (this task): compute the flag in scoring.
- N_005 (next): render an "Edge Play" badge on the card in DashboardClient.js when the flag is true.

Scope explicitly confirmed with Commander: badge/flag existing props we already fetch (Underdog/PrizePicks), not a new independent full-slate scan. The pipeline already pulls all of today's games (`fetchTodaysGames`) and all active players (`fetchAllPlayers`) league-wide, but enrichment/scoring only ever runs on players who already have a prop offered by a bookmaker — that's an existing architectural fact, not something this task changes.

## Success Outcome
`scoreMLBProp()`'s returned object includes `isEdgePlay: true` exactly when hasAdvantage && isBatterHot && oddsValueScore >= 1.5 && edgeNum > 0, and `isEdgePlay: false` otherwise. No other behavior changes.
