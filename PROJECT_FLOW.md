# EdgeCheck Project Flow

## Main pipeline
1. Fetch source data
2. Normalize source data
3. Merge props
4. Enrich props
5. Filter/rank props
6. Shape API response
7. Render UI

---

## MLB pipeline
### Sources
- Underdog: props, odds
- PrizePicks: props, player names
- MLB/ESPN stats: AVG, L10, matchup, game time

### Merge behavior
- Underdog is primary
- PrizePicks supplements missing props
- Duplicate rule: same player + same line + same prop type

### Enrichment required before UI
- matchup
- gameTime
- fullMatchup
- last10HitRate
- hitRateLast10
- last10Results
- seasonAvg

### UI fallback symptoms
- AWY @ HOM = matchup missing
- Live = gameTime missing
- L10: — = last10 field missing
- AVG missing = seasonAvg missing

---

## NBA pipeline
### Sources
- Underdog / PrizePicks / current NBA stats sources
### Required fields
- matchup
- gameTime
- prop display fields
- scoring/enrichment fields
### Known issues
- NBA props/debugging still unstable locally

---

## NHL pipeline
### Sources
- current NHL props source(s)
- current NHL stats/enrichment source(s)
### Required fields
- matchup
- gameTime
- prop display fields
- scoring/enrichment fields
### Known issues
- NHL props/debugging still unstable locally

---

## Important files
- src/app/api/props/route.js = props source fetch / merge / response shaping
- src/app/dashboard/DashboardClient.js = frontend render for dashboard and smart props
- src/lib/mlbStats.js = MLB enrichment
- src/lib/nbaStats.js = NBA enrichment
- src/lib/nhlStats.js = NHL enrichment

---

## Rules
- Never change merge + enrichment + UI in one task
- Fix one sport at a time
- Fix one layer at a time
- Always identify whether a bug is:
  - source
  - merge
  - enrichment
  - response shaping
  - UI render
