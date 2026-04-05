import { NextResponse } from "next/server";

// Force dynamic rendering
export const dynamic = "force-dynamic";

// Cache splits for 10 minutes
let splitsCache = { data: null, timestamp: 0 };
const CACHE_TTL = 10 * 60 * 1000;

export async function GET() {
  try {
    const now = Date.now();

    // Return cached if fresh
    if (splitsCache.data && now - splitsCache.timestamp < CACHE_TTL) {
      return NextResponse.json({ splits: splitsCache.data, cached: true });
    }

    // Dynamic import to avoid Playwright at build time
    const { getBettingSplits } = await import("../../../lib/dkSplits");

    // Fetch fresh splits
    console.log("[Splits API] Fetching fresh DK betting splits...");
    const splits = await getBettingSplits();

    // Cache result
    splitsCache = { data: splits, timestamp: now };

    return NextResponse.json({ splits, cached: false });
  } catch (err) {
    console.error("[Splits API] Error:", err.message);
    return NextResponse.json({ splits: [], error: err.message }, { status: 500 });
  }
}
