// Run DK Splits scraper locally and save to JSON
// Usage: node scripts/runSplits.js

import { getBettingSplits } from "../src/lib/dkSplits.js";
import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

const OUTPUT_PATH = "./data/splits.json";

async function main() {
  console.log("[runSplits] Starting DK splits scraper...\n");

  const splits = await getBettingSplits();

  console.log(`\n[runSplits] Got ${splits.length} splits`);

  // Ensure data directory exists
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });

  // Write results
  const output = {
    timestamp: new Date().toISOString(),
    count: splits.length,
    splits,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`[runSplits] Saved to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("[runSplits] Error:", err.message);
  process.exit(1);
});
