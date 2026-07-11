# CURRENT N
status: locked
N: N_005

## Intent
Render an "Edge Play" badge on MLB `batter_hits` prop cards in `src/app/dashboard/DashboardClient.js` when `prop.isEdgePlay` (added in N_004) is true, placed next to the existing tier badge so it's immediately visible alongside Top Pick / Strong / Value / Risky.

Task 2 of 2 in the Commander-approved Edge Play follow-up. N_004 (scoring flag) is PASS.

## Success Outcome
When `prop.isEdgePlay === true`, a distinct "Edge Play" badge (reusing the existing `TargetIcon`, not a new icon) renders next to the tier badge. No badge renders when the flag is false/absent. No other card content changes.
