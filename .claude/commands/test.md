Test the complete Sim2Round pipeline end to end:
1. Check /auth/signup loads correctly
2. Check /onboarding loads and saves to Supabase
3. Check /games loads with no errors
4. Try createGame action - check for UUID errors
5. Check /rounds loads correctly
6. Check /reports redirects to /upgrade for free users
Use Vercel MCP to check runtime logs after each step.
Report PASS or FAIL for each with the exact error if FAIL.
