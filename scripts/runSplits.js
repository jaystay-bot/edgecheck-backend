// Run DK Splits scraper locally and save to JSON
// Usage: node scripts/runSplits.js

import { getBettingSplits } from "../src/lib/dkSplits.js";
import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

const OUTPUT_PATH = "./data/splits.json";

async function main() {
  console.log("[runSplits] Starting DK splits scraper...\n");

  const splits = await getBettingSplits();

  console.log(`\n[runSplits] Got ${splits.length} normalized splits`);

  // Show sport breakdown
  const bySport = {};
  for (const s of splits) {
    bySport[s.sport] = (bySport[s.sport] || 0) + 1;
  }
  console.log("[runSplits] By sport:", bySport);

  // Ensure data directory exists
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });

  // Write results (array at top level for simpler consumption)
  const output = {
    timestamp: new Date().toISOString(),
    count: splits.length,
    bySport,
    splits,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`[runSplits] Saved to ${OUTPUT_PATH}`);

  // Show samples
  console.log("\n[runSplits] Sample entries:");
  splits.slice(0, 5).forEach((s, i) => {
    console.log(`  ${i + 1}. [${s.sport}] ${s.game} - ${s.betPercent}% / ${s.handlePercent}%`);
  });
}

main().catch((err) => {
  console.error("[runSplits] Error:", err.message);
  process.exit(1);
});
