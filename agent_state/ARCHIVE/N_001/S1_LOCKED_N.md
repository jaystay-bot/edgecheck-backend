# S1 LOCKED CONTRACT
N: N_001
status: locked

## Intent
Populate `prop.batSide` for MLB batter props from player-bio data (already fetched by `fetchAllPlayers()`) whenever lineup-derived `batSide` is unavailable, so batter handedness is not silently missing pre-lineup.

## Atomic Scope
Enrichment layer only, inside `src/lib/mlbStats.js`:
1. In `fetchAllPlayers()`, additionally capture each player's `batSide.code` from the same already-fetched `/sports/1/players` response into a new cache map `mlbStatsCache.batSideByPlayerId` (playerId -> "L"/"R"/"S"). No new fetch.
2. In `enrichMLBProps()`, where `enrichment.batSide` is currently only set from `lineupContext.batSide` (existing line ~898), add a fallback: if not set from lineup, resolve the batter's ID (already available via `propBatterIdMap[playerNameNorm]`, resolved a few lines below at the batter-stats block) and read `mlbStatsCache.batSideByPlayerId.get(batterId)`.

No changes to scoring (`src/app/api/props/route.js`) and no changes to UI rendering (`src/app/dashboard/DashboardClient.js`) in this task.

## Allowed Files
- src/lib/mlbStats.js

## Forbidden Files
- src/app/api/props/route.js (scoring engine — reserved for N_003, explicitly flagged Do Not Touch in CLAUDE.md except when a Commander-approved N targets it)
- src/app/dashboard/DashboardClient.js (UI — reserved for N_002)
- any other file

## Deliverables
- `fetchAllPlayers()` populates `mlbStatsCache.batSideByPlayerId`.
- `enrichMLBProps()` sets `enrichment.batSide` from that map when lineup data didn't already provide it.
- No new outbound network calls added.

## Acceptance Criteria
1. When lineup-derived `batSide` is available, behavior is unchanged (lineup value wins — it's the more authoritative live source).
2. When lineup-derived `batSide` is unavailable but the batter's player ID resolves, `enrichment.batSide` is populated from the bio fallback map.
3. When neither lineup nor bio data has a value (unresolved player), `enrichment.batSide` remains unset, matching current behavior (no fabricated data).
4. No new `fetch()` call is introduced — the fallback reuses data already retrieved by the existing `fetchAllPlayers()` call.
5. `npm run build` exits 0.
6. `git diff --name-only` shows only `src/lib/mlbStats.js` changed.

## Verification Command
```bash
npm run build
```
Additional non-persisted logic check (documented, not a committed test file — see Known Risks): a scratch Node script exercising the new fallback branch with a fixture payload shaped like the real MLB Stats API players-list response, since this sandbox's network policy blocks `statsapi.mlb.com` (confirmed via `$HTTPS_PROXY/__agentproxy/status`: `connect_rejected`, `gateway answered 403`) and a live end-to-end call cannot be made from here.

## Expected Verification Evidence
- `npm run build` output containing `✓ Compiled successfully` and exit code 0.
- Scratch fixture-script output showing: (a) lineup-present case keeps lineup batSide, (b) lineup-absent + bio-available case falls back correctly, (c) fully-unresolved case stays unset.

## Parallel Safety
parallel_safe: false

## Parallel Safety Reason
Single-file change to shared enrichment module; sequenced before N_002/N_003 which read the field this task adds.

## Known Risks
- This sandbox environment cannot reach `statsapi.mlb.com` (outbound network policy denies it), so true end-to-end verification against the live API cannot be performed here. Verification is limited to build success + offline fixture-based logic check. This must be disclosed as-is in TRUTH_RESULT_N.md, not glossed over.
- MLB Stats API's `batSide` bio field reflects a player's *primary* recorded batting side; in rare cases a player's real-world bats-handedness could differ from the bio record (data source limitation, not a code defect).

## Stop Conditions
- Stop if `fetchAllPlayers()`'s response shape does not actually contain a `batSide` field once inspected in code/docs (would require Commander re-scoping).
- Stop if the build fails for reasons unrelated to this change (pre-existing failure) — report rather than attempt unrelated fixes.
