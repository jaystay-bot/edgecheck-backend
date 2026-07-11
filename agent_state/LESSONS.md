# LESSONS

## Usage
Record reusable patterns learned from failures, Watcher findings, Commander corrections, deployment mistakes, and verification gaps.
Do not store secrets, tokens, passwords, private keys, complete environment variables, or sensitive customer data.

## Active Lessons
1. Repository files are the source of truth. Do not rely on prior chat context.
2. Never report PASS without a real verification command and exit code.
3. Never edit outside the locked allowed-files list.
4. Do not silently broaden an atomic task.
5. Do not expose, print, commit, or copy secrets.
6. Preserve existing working behavior unless the locked contract explicitly changes it.
7. Fix one sport at a time, one pipeline layer at a time (source / normalize / merge / enrichment / response shaping / UI render) — see PROJECT_FLOW.md.
8. Do not change merge + enrichment + UI in a single task.
9. Do not modify Auth (Clerk) or Payments (Stripe) flow, scoring engine logic, or API key handling unless explicitly asked.
10. See tasks/lessons.md for accumulated project-specific pipeline/auth/payment lessons predating this system — treat it as a companion reference, not a duplicate to merge in.
11. This sandbox's outbound network policy blocks `statsapi.mlb.com` (and likely other external sports-data/odds APIs) — confirmed via `curl "$HTTPS_PROXY/__agentproxy/status"` showing `connect_rejected` / `403 policy denial`. Live end-to-end verification of MLB/NBA/NHL enrichment against real APIs is not possible from this environment. Use `npm run build` plus offline fixture-based logic checks that mirror the exact shipped code, and disclose the live-data gap explicitly in TRUTH_RESULT_N.md rather than implying live verification occurred.
12. Before extending a per-player enrichment field (e.g. handedness), check whether the data is already present but discarded in an existing bulk-fetched response (e.g. `fetchAllPlayers()` in src/lib/mlbStats.js already fetches full player bio records) before adding a new network call.
13. When writing an offline fixture check for summed scoring-engine floats (e.g. contextScore/riskPenalty additions), use an epsilon comparison, not strict `===` — ordinary IEEE-754 sums (e.g. 0.8 + 0.4) produce values like 1.2000000000000002. This is not a code defect; the real pipeline already rounds via `Math.round(rawScore * 10) / 10` before the value is used. Don't mistake a strict-equality test-script bug for a real scoring bug.
14. When a request explicitly asks to change scoring/EV logic despite CLAUDE.md's default "Do NOT Touch: Scoring engine logic," treat that as a narrow, named override for the specific change requested — not blanket permission to refactor the scoring engine further. Keep the edit to the smallest block that satisfies the request (see N_003: one `if` block inside `scoreMLBProp`, nothing else touched).
