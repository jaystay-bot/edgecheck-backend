Check if cached prop data is stale.

Return:
- Cache age (minutes/hours)
- Last fetch timestamp
- Status: FRESH / STALE / DEAD
- Recommended action: SERVE / REFRESH / BLOCK

Rules:
- Do not fetch new data
- Do not modify cache
- Only inspect existing cache state

Flag STALE if > 60 minutes (adjustable later).
Stop after check.
