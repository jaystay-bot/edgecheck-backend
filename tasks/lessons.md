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

AI scoring thresholds cause empty results — When using AI (Groq/LLM) to score bets, high thresholds (7+, 8+) often result in empty lists because AI scoring is inconsistent. Lower thresholds (5+ for heaters, 6+ for best play) ensure features display more reliably. The AI-generated scores are not real analytics data anyway.

Always return the best result when data exists — Don't fail with "no results found" when candidates exist but don't meet an arbitrary threshold. If games are available, always show the highest-scoring option. Users expect to see something, not an empty state when data is present.

Search all bookmakers for market data — The Odds API returns multiple bookmakers per game. Don't just use the first bookmaker — it may not have all markets (h2h, spreads, totals). Search through all bookmakers to find each market type.

Use fuzzy matching for team names — The Odds API returns team names inconsistently (e.g., "Los Angeles Lakers" vs "LA Lakers", "NY Yankees" vs "New York Yankees"). Exact string matching fails silently. Use fuzzy matching: normalize to lowercase letters only, try substring matching, and match on last word (team nickname like "Lakers", "Celtics").

Always display game date/time for betting features — Betting decisions depend on knowing when games occur. Always show game date and time prominently so users can identify which games to bet on and track line movements.

Format date+time together in betting UIs — When displaying game times, include both the date (e.g., "Thu, Apr 3") and time (e.g., "7:00 PM") together. Users need the full context without having to look elsewhere.

Return multiple elite picks not just one — For "best play" features, users want 1-3 top picks with high scores (8+), not a single result. Sample more candidates (40+), filter to score 8+, and return up to 3 elite plays with EV/edge data. Fall back gracefully to 6+ plays if no 8+ found.

Include all sports in betting features — Don't limit Heaters/Best Play to just NBA/MLB/NHL. Include all supported sports (NFL, NCAAF, NCAAB, MLS) to maximize available picks. There are always lines available across different sports/seasons.

Always return picks when games exist — If AI scoring returns no high scores, fall back to showing the best available picks with default scores. Users expect to see picks, not empty states. Empty results frustrate users when betting lines are clearly available.

Always use Odds API data over ESPN for betting lines — ESPN odds data is often incomplete or missing (especially moneylines). When merging ESPN game data with Odds API data, always overwrite with Odds API values since that's the authoritative source for betting lines. Don't conditionally skip the merge based on ESPN having partial data.

Use deterministic edge calculation for props — Don't use AI (Groq/LLM) for prop edge scoring - results are inconsistent. Calculate edge deterministically: impliedProb from American odds (odds > 0 ? 100/(odds+100) : |odds|/(|odds|+100)), modelProb from bookmaker consensus minus vig (~4%), edge = modelProb - impliedProb. Filter props by minimum edge threshold (3%+) for value plays.

Match API response shape to UI expectations — When an API returns `plays[]` (array) but the UI expects `play` (singular object), the UI renders empty state even when data exists. When refactoring APIs from single to multiple returns, either: (1) update the UI to use the new shape, or (2) include both `plays[]` AND `play: plays[0]` in the response for backward compatibility.

Edge thresholds must match model output range — A 3% edge threshold filters out everything when the model probability calculation rarely produces positive edge. The edge formula (modelProb - impliedProb) returned negative values because vig-adjusted model probability was typically lower than best-odds implied probability. Set thresholds based on actual model output distribution, not theoretical expectations. When in doubt, set threshold to 0 and sort by edge instead of filtering.
