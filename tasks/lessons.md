# EdgeCheck Lessons

## Claude API

Use current model IDs not date-based ones — Model IDs like `claude-sonnet-4-20250514` are outdated. Use `claude-sonnet-4-6` for Claude Sonnet 4.6, `claude-opus-4-6` for Opus 4.6, `claude-haiku-4-5-20251001` for Haiku 4.5. Date-based model IDs cause API failures.

## Auth

Email-only login bypasses paywall — Checking Whop membership by email alone lets anyone use any paying user's email. Use Clerk for proper auth with email verification BEFORE Whop check. Flow: Sign up → Verify email → Check Whop membership → Access granted.

Clerk v5 requires Next.js 14 — Latest @clerk/nextjs v7 requires Next.js 15+. Use `@clerk/nextjs@5` for Next.js 14 projects.
