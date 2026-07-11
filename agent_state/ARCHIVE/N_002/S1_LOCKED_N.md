# S1 LOCKED CONTRACT
N: N_002
status: locked

## Intent
Render pitcher handedness and batter handedness as icon + word ("Left"/"Right"/"Switch") on MLB `batter_hits` prop cards in `src/app/dashboard/DashboardClient.js`, using the raw `prop.pitcherHand` / `prop.batSide` fields that already reach the client for paid users. Replace the existing redundant `matchupBadge` text pill (which just restates "LHB vs RHP" as a string) with this icon-based display rather than stacking a third handedness element on the card.

## Atomic Scope
UI layer only, inside `src/app/dashboard/DashboardClient.js`:
1. Add two new SVG icon components following the existing `XIcon({size, color})` pattern used by `FlameIcon`/`TargetIcon`/etc. (file lines ~11-98): `BaseballIcon` (pitcher hand) and `BatIcon` (batter hand).
2. Add a small pure helper `handLabel(code)` mapping `"L"→"Left"`, `"R"→"Right"`, `"S"→"Switch"`, else `null`.
3. In the `batter_hits` prop-card block (~lines 2827-2844), replace the `prop.matchupBadge` pill with a row showing: `BatIcon` + `handLabel(prop.batSide)` (when present) and `BaseballIcon` + `handLabel(prop.pitcherHand)` (when present).
4. Leave the `handednessMatchup` + `lineupSpot` block (~lines 2817-2825) untouched — it conveys different information (lineup position, "(advantage)" callout) and is not the redundant element.

No changes to `src/lib/mlbStats.js` (enrichment/`matchupBadge` computation stays as-is — the field simply becomes unused by the UI, which is acceptable since it's a display-layer decision) and no changes to `src/app/api/props/route.js` (scoring, reserved for N_003).

## Allowed Files
- src/app/dashboard/DashboardClient.js

## Forbidden Files
- src/lib/mlbStats.js (enrichment — N_001 already shipped/verified; do not reopen)
- src/app/api/props/route.js (scoring — reserved for N_003)
- any other file

## Deliverables
- `BaseballIcon`, `BatIcon` components added, matching existing icon component conventions.
- `handLabel()` helper added.
- `batter_hits` card face shows batter-hand and pitcher-hand icon+word when the corresponding field is present; shows nothing extra when absent (no fabricated "Unknown" placeholders).
- Old `matchupBadge` pill removed from render (field itself untouched in enrichment).

## Acceptance Criteria
1. When `prop.batSide` is one of "L"/"R"/"S", the bat icon + correct word renders; when absent/unrecognized, nothing renders for that half.
2. When `prop.pitcherHand` is "L" or "R", the baseball icon + correct word renders; when absent, nothing renders for that half.
3. Non-`batter_hits` MLB props (e.g. `pitcher_strikeouts`) and other sports are unaffected — gating stays `prop.marketKey === "batter_hits"`, matching the removed code's existing gate.
4. `handednessMatchup`/`lineupSpot` block continues to render exactly as before (byte-for-byte unchanged JSX in that block).
5. `npm run build` exits 0.
6. `git diff --name-only` shows only `src/app/dashboard/DashboardClient.js` changed (product code).

## Verification Command
```bash
npm run build
```
Plus an offline logic/render check (documented, not a committed test file — this repo has no wired test script): a scratch script asserting `handLabel()` output for "L"/"R"/"S"/undefined, and a manual code read confirming the JSX gating matches acceptance criteria 1-4. Live visual confirmation with real prop data is not possible in this sandbox (network policy blocks `statsapi.mlb.com`, so `npm run dev` here would render cards with no live MLB enrichment data) — this is the same disclosed limitation as N_001.

## Expected Verification Evidence
- `npm run build` → `✓ Compiled successfully`, exit 0.
- Fixture script output showing `handLabel()` correct for all 4 cases.
- Quoted diff snippet showing the new render block replaces `matchupBadge` and the `handednessMatchup` block is untouched.

## Parallel Safety
parallel_safe: false

## Parallel Safety Reason
Sequenced after N_001 (consumes `batSide` fallback it added) and before N_003 (scoring); single UI file, no need for parallelism.

## Known Risks
- Cannot visually confirm rendering against live data in this sandbox (same network limitation as N_001) — verification limited to build success + code-level/logic checks, disclosed honestly.
- Removing `matchupBadge` from render is a product/UX call (deciding it's redundant with the new icons) rather than a pure mechanical change — flagged here for Watcher/Commander visibility, not hidden as an incidental edit.

## Stop Conditions
- Stop if `prop.matchupBadge` turns out to be used elsewhere (e.g. free-tier response, analytics) beyond this render block — re-check before removing.
- Stop if build fails for reasons unrelated to this change.
