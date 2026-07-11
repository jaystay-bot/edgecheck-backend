# A1 OPERATOR OUTPUT
N: N_003
status: implemented

## Files Read
- src/app/api/props/route.js (scoreMLBProp full function, lines 207-520, to confirm no prior double-counting of isBatterHot/isBatterCold inside the handedness block before editing)

## Files Changed
- src/app/api/props/route.js

## Changes Made
Inside the existing "Handedness matchup bonus" block in `scoreMLBProp()`:
- Added a compounding +0.4 contextScore bonus (with its own factor string) fired only when `hasAdvantage && isBatterHot`, additive to the untouched existing +0.8 platoon bonus and untouched separate +1.5 hot-bat bonus elsewhere in the function.
- Added a compounding +0.3 riskPenalty (with its own risk string) fired only when `!hasAdvantage && isBatterCold`, additive to the untouched existing -0.5 same-side penalty and untouched separate -1.0 cold-bat penalty elsewhere in the function.
- No other line in the file changed (confirmed via `git diff` — only the 12 added lines appear, no surrounding lines touched).

## Commands Run During Implementation
- `npm run build` — exit 0
- `git diff src/app/api/props/route.js` — confirmed diff is scoped to exactly the intended block
- `node /tmp/.../scratchpad/verify_n003_scoring.mjs` — 4/4 acceptance-criteria cases passed (first run hit a floating-point strict-equality false alarm in the *test script* itself — 0.8 + 0.4 = 1.2000000000000002 — not a logic defect; fixed the comparison to use an epsilon and reran clean; noted here rather than silently rerun)

## Deviations
None from the locked contract. The floating-point test-script fix above was a correction to the verification script, not to the shipped code.

## Unresolved Issues
Same disclosed sandbox limitation as N_001/N_002: full pipeline behavior (real heaterScore/tier movement on live props) cannot be observed end-to-end here because `statsapi.mlb.com` is blocked by this sandbox's network policy. Verified via isolated arithmetic mirroring the exact shipped code instead.

## Notes for Watcher
Verification was not performed by the Operator as final PASS — see TRUTH_RESULT_N.md.
