Decide whether ranked props are safe to render right now.

Return:
- Render decision: ALLOW / SAFE_MODE / BLOCK
- Reason(s): missing feed / stale cache / thin slate / low comps / broken mapping
- Safe to show: full props / games only / odds only / nothing
- User-facing warning: YES / NO

Rules:
- Do not fetch new data
- Do not modify cache or dataset
- Only inspect current validation outputs and current dataset health
- BLOCK if any critical source is DOWN or slate is DEAD
- SAFE_MODE if cache is STALE, slate is THIN, or prop completeness is weak
- ALLOW only if sources are live, cache is fresh, and slate quality is strong

Stop after decision.
