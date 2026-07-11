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
