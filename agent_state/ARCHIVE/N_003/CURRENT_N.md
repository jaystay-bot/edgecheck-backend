# CURRENT N
status: locked
N: N_003

## Intent
In `scoreMLBProp()` (`src/app/api/props/route.js`), add a compounding scoring adjustment for the specific case the Commander described: a batter with a favorable platoon matchup (opposite-hand pitcher) who is *also* currently hot should score higher than the sum of the two independent bonuses alone suggests, since the combined signal is stronger than either alone. Symmetric compounding penalty for a batter with an unfavorable same-hand matchup who is also cold.

Task 3 of 3 in the Commander-approved handedness-matchup sequence. N_001 (data fallback) and N_002 (UI icons) are both PASS.

## Success Outcome
MLB batter_hits props where the batter has a platoon advantage AND is hot score modestly higher than today (beyond the existing separate +0.8 platoon / +1.5 hot-bat bonuses), so Top Pick / Strong tier ranking better reflects this compounded signal. Mirror penalty for cold-bat + same-hand-disadvantage. No change to props without both signals present.
