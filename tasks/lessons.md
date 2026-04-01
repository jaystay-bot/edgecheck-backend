# EdgeCheck Lessons

## Claude API

Use current model IDs not date-based ones — Model IDs like `claude-sonnet-4-20250514` are outdated. Use `claude-sonnet-4-6` for Claude Sonnet 4.6, `claude-opus-4-6` for Opus 4.6, `claude-haiku-4-5-20251001` for Haiku 4.5. Date-based model IDs cause API failures.

## Auth

Email-only login bypasses paywall — Checking Whop membership by email alone lets anyone use any paying user's email. Use Clerk for proper auth with email verification BEFORE Whop check. Flow: Sign up → Verify email → Check Whop membership → Access granted.

Clerk v5 requires Next.js 14 — Latest @clerk/nextjs v7 requires Next.js 15+. Use `@clerk/nextjs@5` for Next.js 14 projects.

Handle missing Clerk credentials gracefully — ClerkProvider and auth() crash the entire app if `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` or `CLERK_SECRET_KEY` are missing. Check for credentials before using Clerk components/functions. This allows the landing page to work while env vars are being configured.

Verify paywall server-side on every load — Cookie-based paywall checks can be bypassed (cookies can be forged). Use a server component wrapper that calls the payment provider API on every protected page load. No valid membership → redirect to checkout.

Lazy-initialize third-party SDKs — Initializing SDKs like Stripe at module load time (`const stripe = new Stripe(process.env.KEY)`) fails during Vercel builds when env vars aren't available. Use a getter function (`function getStripe() { return new Stripe(process.env.KEY); }`) and call it inside request handlers instead.

Use dynamic import for Clerk hook pages — Client components using `useUser` or `useClerk` fail during Next.js static generation at build time because ClerkProvider isn't available. Wrap the component with `dynamic(() => Promise.resolve(Component), { ssr: false })` to skip server-side rendering.

Remove all dead API references after provider migration — When replacing a payment provider (Whop → Stripe), search the entire codebase for ALL references to the old provider's endpoints. Mobile users may hit cached routes that still call deleted APIs, causing 404 errors.

Never show raw API errors to users — LLM APIs (Groq, OpenAI) return technical error messages that confuse users. Catch 429/rate limit errors specifically and show a clean message like "Analysis temporarily unavailable — check back in a few minutes". Add retry logic (30s delay) before giving up.

Cache expensive API results in localStorage — Premium features like Heaters and Best Play make API calls on every page load. Cache results in localStorage with TTL (30 min for heaters, 1 hour for best play). Check cache first, show "Last updated X minutes ago", and add manual refresh button.

Serverless in-memory caches don't persist — Vercel serverless functions may start fresh instances on each invocation. Module-level Maps/caches won't reliably persist data. Use client-side localStorage as primary cache, with on-demand generation fallback. For production persistence, use Vercel KV, Redis, or a database.
