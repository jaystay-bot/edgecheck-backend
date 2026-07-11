# S1 LOCKED CONTRACT
N: N_003
status: locked

## Intent
Add a compounding scoring bonus/penalty in `scoreMLBProp()` for the specific combination of (a) platoon-advantage matchup + hot bat, and (b) same-hand disadvantage + cold bat — on top of (not replacing) the existing independent bonuses for each signal alone.

## Atomic Scope
Scoring layer only, inside `src/app/api/props/route.js`, within the existing "Handedness matchup bonus" block (currently lines ~382-397 of `scoreMLBProp()`):
- When `hasAdvantage` is true AND `isBatterHot` is true: add a small additional `contextScore` bonus (+0.4) with its own factor string, on top of the existing +0.8 platoon bonus (which stays untouched) and the existing separate +1.5 hot-bat bonus (untouched, computed later in the function).
- When `hasAdvantage` is false (same-hand) AND `isBatterCold` is true: add a small additional `riskPenalty` (+0.3) with its own risk string, on top of the existing -0.5 same-side penalty (untouched) and the existing separate -1.0 cold-bat penalty (untouched).
- No other line in `scoreMLBProp()` changes. No change to `scoreNBAProp()`, tier thresholds, `heaterScore` clamping, or any other scoring function.

This is the only task in the 3-task sequence that touches the scoring engine, and it is explicitly Commander-authorized (overriding CLAUDE.md's default "Do NOT Touch: Scoring engine logic" for this narrow, named change only).

## Allowed Files
- src/app/api/props/route.js

## Forbidden Files
- src/lib/mlbStats.js (enrichment — already shipped in N_001)
- src/app/dashboard/DashboardClient.js (UI — already shipped in N_002)
- any other file
- Within route.js itself: no edits outside the named handedness block (no touching `scoreNBAProp`, tier logic, `addEdgeDataToProps`, or filtering thresholds)

## Deliverables
- Compounding bonus (+0.4 contextScore) fires only when `hasAdvantage && isBatterHot`.
- Compounding penalty (+0.3 riskPenalty) fires only when `!hasAdvantage && isBatterCold`.
- Existing four independent bonuses/penalties (+0.8, -0.5 platoon; +1.5, -1.0 hot/cold) remain byte-for-byte unchanged.
- New `factors`/`risks` entries are distinct strings from the existing ones (no duplicate-looking output).

## Acceptance Criteria
1. Batter with platoon advantage, not hot: score unchanged from pre-N_003 behavior (only +0.8, no compounding bonus).
2. Batter with platoon advantage AND hot: contextScore includes +0.8 +1.5 +0.4 = +2.7 total from these three sources combined (verified via isolated calculation, not full pipeline).
3. Batter same-hand, not cold: score unchanged (only -0.5).
4. Batter same-hand AND cold: riskPenalty includes 0.5 + 1.0 + 0.3 = 1.8 total from these three sources combined.
5. `heaterScore` stays clamped to [1, 10] as before (existing `Math.min(10, Math.max(1, ...))` untouched).
6. `npm run build` exits 0.
7. `git diff --name-only` shows only `src/app/api/props/route.js` changed (product code).

## Verification Command
```bash
npm run build
```
Plus an offline logic check: a scratch script re-implementing just the handedness/recent-performance scoring arithmetic (mirroring the real code) across the 4 cases in Acceptance Criteria 1-4, since this repo has no wired test script and this sandbox cannot run the live route against real MLB data (network policy blocks `statsapi.mlb.com`, same disclosed limitation as N_001/N_002).

## Expected Verification Evidence
- `npm run build` → `✓ Compiled successfully`, exit 0.
- Fixture script confirming the 4 contextScore/riskPenalty totals above.
- Quoted diff showing only the handedness block changed, with the four pre-existing bonus/penalty lines untouched.

## Parallel Safety
parallel_safe: false

## Parallel Safety Reason
Final task in a strictly sequenced 3-task chain; touches the scoring engine, which the project's own rules single out for extra caution — no parallelism.

## Known Risks
- This is the one task in the sequence touching code CLAUDE.md flags "Do NOT Touch" by default. Scope is deliberately kept to the single named block to minimize blast radius. Full pipeline behavior (actual heaterScore/tier movement on real props) cannot be observed end-to-end in this sandbox due to the network limitation — verified via isolated arithmetic mirroring the real code instead.
- Magnitude (+0.4 / +0.3) is a judgment call sized to be noticeable but not dominant relative to existing bonuses (0.8-1.5 range) — flagged for Commander review if a different magnitude is wanted after seeing real results.

## Stop Conditions
- Stop if `isBatterHot`/`isBatterCold` are found to already be used inside the handedness block itself (would indicate prior double-counting logic already exists) — re-verify before adding.
- Stop if build fails for reasons unrelated to this change.
