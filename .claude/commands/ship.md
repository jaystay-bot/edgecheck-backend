Pre-ship checklist. Run this before every deploy.

1. Run /brain first — confirm rules are loaded
2. Check all env vars are set — nothing missing
3. Run npm run build — must pass with zero errors
4. Run npm run lint — fix all errors before continuing
5. Test the critical user flow manually — sign up, core feature, payment if applicable
6. Check Supabase — confirm RLS is enabled on all tables
7. Check Stripe — confirm webhook is live and pointing to correct URL
8. Push to GitHub — confirm Vercel build passes
9. Check Vercel deployment logs — no runtime errors
10. Confirm live URL works end to end
11. Add any new lessons learned to lessons.md
Never mark shipped until all 10 steps are confirmed.
