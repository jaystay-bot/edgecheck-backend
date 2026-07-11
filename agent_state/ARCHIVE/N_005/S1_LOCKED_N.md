# S1 LOCKED CONTRACT
N: N_005
status: locked

## Intent
Render `prop.isEdgePlay` (from N_004) as a visible "Edge Play" badge on the card, next to the existing tier badge, using the existing `TargetIcon` component (no new icon).

## Atomic Scope
UI layer only, inside `src/app/dashboard/DashboardClient.js`, in the "Tier Badge + Game Time" row (~lines 2782-2795): add a sibling badge, rendered only when `prop.isEdgePlay` is true, styled as an outlined pill (not filled, to visually distinguish it from the solid tier badges and avoid implying it's a 5th tier) using `TargetIcon` + the text "Edge Play", colored with the existing `var(--accent)` token.

No changes to `src/app/api/props/route.js` (scoring — N_004 already shipped) and no changes to `src/lib/mlbStats.js`.

## Allowed Files
- src/app/dashboard/DashboardClient.js

## Forbidden Files
- src/app/api/props/route.js (scoring — N_004 already shipped; do not reopen)
- src/lib/mlbStats.js
- any other file

## Deliverables
- "Edge Play" badge (TargetIcon + text) renders in the tier-badge row when `prop.isEdgePlay` is true.
- No badge, no layout shift, when `prop.isEdgePlay` is false/undefined.
- No new icon component added (reuse existing `TargetIcon`).

## Acceptance Criteria
1. `prop.isEdgePlay === true` → badge renders with `TargetIcon` + "Edge Play" text.
2. `prop.isEdgePlay === false` or `undefined` → no badge, no empty wrapper element left behind.
3. Existing tier badge and game-time display are unchanged (byte-for-byte, confirmed via diff).
4. `npm run build` exits 0.
5. `git diff --name-only` shows only `src/app/dashboard/DashboardClient.js` changed (product code).

## Verification Command
```bash
npm run build
```
Plus a visual check: render the exact badge markup in a static HTML page via the pre-installed Chromium (same method used for N_002's icon check) to confirm it's legible and visually distinct from the tier badges, since this sandbox cannot render the live dashboard against real prop data.

## Expected Verification Evidence
- `npm run build` → exit 0.
- Screenshot showing the Edge Play badge rendered next to a tier badge, legible and visually distinct.
- Diff showing the tier-badge/game-time block otherwise unchanged.

## Parallel Safety
parallel_safe: false

## Parallel Safety Reason
Final task in the 2-task Edge Play sequence; single UI file.

## Known Risks
- Same sandbox limitation as prior tasks: cannot confirm this renders correctly against a live prop with real `isEdgePlay: true` data in this environment.

## Stop Conditions
- Stop if build fails for reasons unrelated to this change.
