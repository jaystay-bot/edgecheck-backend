Stripe setup checklist. Run this when adding payments to any project.

Use claude.ai MCP for all of these — not Claude Code.
1. Create product in Stripe dashboard via MCP
2. Create price (monthly or one-time) via MCP
3. Create payment link via MCP
4. Add webhook endpoint in Stripe dashboard — point to /api/webhooks/stripe
5. Copy webhook signing secret to .env.local as STRIPE_WEBHOOK_SECRET
6. Confirm STRIPE_SECRET_KEY is in .env.local — server side only
7. Confirm NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is in .env.local
8. Test webhook with Stripe CLI before going live
9. Never build custom payment UI — always use Stripe Checkout
Never expose secret key to client. Never store payment info.
