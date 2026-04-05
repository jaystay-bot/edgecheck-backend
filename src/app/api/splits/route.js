import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

// Force dynamic rendering
export const dynamic = "force-dynamic";

// Reads pre-scraped splits from data/splits.json
// Run `node scripts/runSplits.js` locally to update the data

export async function GET() {
  try {
    const filePath = join(process.cwd(), "data", "splits.json");
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json({ splits: data.splits || [], timestamp: data.timestamp });
  } catch (err) {
    // File missing or invalid - return empty array
    return NextResponse.json({ splits: [] });
  }
}
