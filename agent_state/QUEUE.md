# TASK QUEUE

## Ready
None.

## Blocked
None.

## Proposed
1. True batter-vs-pitcher-hand split stats: today's platoon logic uses a binary handedness flag plus season-wide L5/L10 averages (no split by opposing pitcher hand). MLB Stats API supports `sitCodes=vr`/`vl` on the hitting-stats endpoint (currently unused) — could replace the flat platoon bonus with a real stat-based split (e.g. batter's actual AVG vs LHP vs RHP). Not started; surfaced during N_001-N_003 research. Needs Commander sizing/approval before an Architect locks it — likely a multi-task effort given it touches enrichment (new fetch) and scoring (new formula).
