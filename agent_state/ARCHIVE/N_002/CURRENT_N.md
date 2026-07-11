# CURRENT N
status: locked
N: N_002

## Intent
Add a pitcher-hand icon (baseball glyph + "L"/"R") and a batter-hand icon (bat glyph + "L"/"R") to MLB batter prop cards in the dashboard, using the `prop.pitcherHand` / `prop.batSide` fields that already reach the client (and are now populated pre-lineup via N_001).

Task 2 of 3 in the Commander-approved handedness-matchup sequence. N_001 (data fallback) is PASS. N_003 (scoring refinement) follows this.

## Success Outcome
MLB batter prop cards visually show pitcher handedness and batter handedness via small icon + letter, without duplicating the existing text badges into a confusing triple-redundant display.
