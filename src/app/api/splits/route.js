import { NextResponse } from "next/server";

// Force dynamic rendering
export const dynamic = "force-dynamic";

// Note: DK Splits scraper requires Playwright which doesn't work on Vercel serverless.
// This endpoint returns empty data on Vercel. For local dev, run the scraper directly.

export async function GET() {
  // Playwright can't run on Vercel serverless - return empty splits
  // The UI gracefully hides the splits section when empty
  console.log("[Splits API] Playwright not available on serverless - returning empty splits");
  return NextResponse.json({ splits: [], note: "Playwright scraping not available on serverless" });
}
