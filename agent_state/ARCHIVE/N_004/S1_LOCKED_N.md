# S1 LOCKED CONTRACT
N: N_004
status: locked

## Intent
Add an `isEdgePlay` boolean to `scoreMLBProp()`'s return value, true when the prop shows the exact compound signal the Commander described: favorable handedness matchup + hot bat + strong odds + positive edge.

## Atomic Scope
Scoring layer only, inside `src/app/api/props/route.js`, `scoreMLBProp()`:
1. Declare `let isEdgePlay = false;` alongside the existing `contextScore`/`riskPenalty` declarations (~line 261-262).
2. Inside the existing `if (hasAdvantage) { ... if (isBatterHot) { ... } }` block added in N_003 (~line 394), when `isBatterHot` is true, additionally set `isEdgePlay = true` if `oddsValueScore >= 1.5 && edgeNum > 0`. `oddsValueScore` (~line 259) and `edgeNum` (~line 347) are both already computed earlier in the function, in scope at this point.
3. Add `isEdgePlay` to the object returned at the end of the function (~line 509).

No new fetches, no new files, no change to `heaterScore`/`tier` computation, no change to `scoreNBAProp`, no UI change (that is N_005).

## Allowed Files
- src/app/api/props/route.js

## Forbidden Files
- src/app/dashboard/DashboardClient.js (UI — reserved for N_005)
- src/lib/mlbStats.js (enrichment — not touched by this feature)
- any other file
- Within route.js: no edits outside the three named points above (declaration, flag-set inside existing N_003 block, return-object addition)

## Deliverables
- `isEdgePlay: true` returned exactly when `hasAdvantage && isBatterHot && oddsValueScore >= 1.5 && edgeNum > 0`.
- `isEdgePlay: false` in every other case, including when `batSide`/`pitcherHand` are missing (handedness block never runs) or when hot+advantage fires but odds/edge don't qualify.
- No change to `heaterScore`, `tier`, `contextScore`, `riskPenalty`, or any existing returned field.

## Acceptance Criteria
1. Golden Batter-style prop (favorable matchup, hot, odds -110, positive edge) → `isEdgePlay === true`.
2. Same prop but odds +140 (oddsValueScore 0.5, below the 1.5 threshold) → `isEdgePlay === false`.
3. Same prop but edge <= 0 → `isEdgePlay === false` (also forced to `tier: "Risky"` by existing unrelated logic — this task doesn't touch that, just confirming no accidental interaction).
4. Favorable matchup but NOT hot → `isEdgePlay === false` (matches N_003's existing compounding gate — no new bonus, no edge-play flag).
5. Same-hand (unfavorable) matchup, even if hot and good odds → `isEdgePlay === false` (hasAdvantage false, block's `if (hasAdvantage)` branch never runs).
6. No `batSide`/`pitcherHand` at all → `isEdgePlay === false` (whole handedness block skipped, `isEdgePlay` stays at its `false` default).
7. `npm run build` exits 0.
8. `git diff --name-only` shows only `src/app/api/props/route.js` changed (product code).

## Verification Command
```bash
npm run build
```
Plus a real-code test: byte-identical extraction of the patched `scoreMLBProp()` (same method used for N_003 verification) exercised against the 6 acceptance-criteria cases above.

## Expected Verification Evidence
- `npm run build` → exit 0.
- 6/6 real-code test cases pass.

## Parallel Safety
parallel_safe: false

## Parallel Safety Reason
N_005 (UI render) depends on this flag existing; sequenced, not parallel.

## Known Risks
- Threshold choice (`oddsValueScore >= 1.5`, requiring positive edge) is a judgment call defining "good odds" using bins the scoring function already has, rather than inventing a new odds scale. Flagged for Commander review once seen against real props.
- Same sandbox network limitation as N_001-N_003: cannot observe real live props hitting this flag in this environment.

## Stop Conditions
- Stop if build fails for reasons unrelated to this change.
