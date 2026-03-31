Check environment variables before starting any work.

1. List all required env vars for this project
2. Confirm each one exists in .env.local
3. Confirm none are hardcoded in any file
4. Confirm Stripe secret key is server-side only
5. Confirm Supabase service role key is server-side only
6. Confirm no secrets are committed to GitHub
7. If any are missing — stop and fix before writing any code
Never start a session without confirming env vars are set.
