Supabase database checklist. Run when creating or modifying tables.

Use claude.ai MCP for all of these — not Claude Code.
1. Create or modify table via Supabase MCP
2. Enable RLS immediately — no exceptions
3. Write RLS policies — users can only access their own data
4. Create indexes on foreign keys and frequently queried columns
5. Confirm /lib/supabase.ts exists as singleton
6. Confirm API routes use server-side client only
7. Test query returns correct data
8. Test RLS blocks unauthorized access
9. Never use browser client in API routes
Always enable RLS before writing any data.
