# CURRENT N
status: locked
N: N_001

## Intent
Add a fallback source for MLB batter handedness (`batSide`) so it is available before the day's lineup posts, using the player-bio `batSide` field already present in the MLB Stats API players-list response that `fetchAllPlayers()` fetches — without adding a new network call.

This is task 1 of 3 in a Commander-approved sequence for the "pitcher/batter handedness matchup" feature:
- N_001 (this task): batter-hand data fallback (enrichment layer)
- N_002 (next): pitcher-hand + batter-hand icon UI (UI layer)
- N_003 (after): scale the existing flat platoon-advantage scoring bonus by batter form (scoring layer)

## Success Outcome
`prop.batSide` is populated for MLB batter props whenever the batter's player ID can be resolved, even when today's lineup has not posted yet. Lineup-confirmed `batSide` (when available) continues to take priority, since it is the more authoritative live source.
