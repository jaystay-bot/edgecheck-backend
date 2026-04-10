/validate

Check all upstream data sources before any render or ranking.

Return:
- ESPN odds feed: LIVE / DOWN / EMPTY
- Props feed: LIVE / DOWN / EMPTY
- Player stats API: LIVE / DOWN / EMPTY
- Props with complete data: X / X total

Rules:
- Do not fix anything
- Do not refactor
- Only inspect API responses and data presence
- If any source is EMPTY or DOWN, flag clearly

Stop after validation.
