// DraftKings Betting Splits Scraper
// Scrapes public betting split data from DK Network

import { chromium } from "playwright";

const DK_SPLITS_URL = "https://dknetwork.draftkings.com/draftkings-sportsbook-betting-splits";

/**
 * Fetches betting splits from DraftKings Network
 * @returns {Promise<Array<{game: string, team: string, betPercent: number, handlePercent: number}>>}
 */
export async function getBettingSplits() {
  let browser = null;

  try {
    console.log("[DKSplits] Launching browser...");
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    console.log("[DKSplits] Navigating to DK splits page...");
    await page.goto(DK_SPLITS_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

    // Wait for betting splits content to load
    console.log("[DKSplits] Waiting for data to load...");

    // Wait for main content container
    await page.waitForSelector('[class*="split"], [class*="betting"], table, [data-testid]', { timeout: 30000 }).catch(() => {});

    // Additional wait for JS-rendered content
    await page.waitForTimeout(5000);

    // Extract betting splits data
    const splits = await page.evaluate(() => {
      const results = [];
      const seen = new Set();

      // Strategy: Find game matchup patterns and nearby percentages
      // Game patterns: "Team @ Team" or "Team vs Team"
      const bodyText = document.body.innerText;

      // Split into lines and process
      const lines = bodyText.split("\n").map(l => l.trim()).filter(l => l);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Look for game matchup pattern
        const gameMatch = line.match(/^([A-Za-z]+(?:\s+[A-Za-z]+)?)\s*[@vs]+\s*([A-Z]{2,3})$/i) ||
                          line.match(/^([A-Za-z\s]+)\s*[@]\s*([A-Za-z\s]+)$/i);

        if (gameMatch) {
          const gameName = line;

          // Look for percentages in nearby lines (next 10 lines)
          const nearbyText = lines.slice(i, i + 15).join(" ");
          const percents = nearbyText.match(/(\d+)%/g);

          if (percents && percents.length >= 2 && !seen.has(gameName)) {
            seen.add(gameName);

            // Find team names in nearby lines
            let team = gameMatch[1] || gameName.split(/[@vs]/i)[0].trim();

            results.push({
              game: gameName.trim(),
              team: team.trim(),
              betPercent: parseInt(percents[0], 10),
              handlePercent: parseInt(percents[1], 10),
            });
          }
        }
      }

      // Also try to find structured rows
      // Look for elements containing both game names and percentages
      const allElements = document.querySelectorAll("*");
      for (const el of allElements) {
        if (el.children.length > 0 && el.children.length < 20) {
          const text = el.innerText || "";
          // Match pattern: Game name followed by team stats with percentages
          const fullMatch = text.match(/([A-Za-z]+)\s*@\s*([A-Z]{2,3})\s+([A-Za-z]+)\s+.*?(\d+)%\s+(\d+)%/);
          if (fullMatch) {
            const game = `${fullMatch[1]} @ ${fullMatch[2]}`;
            if (!seen.has(game + fullMatch[3])) {
              seen.add(game + fullMatch[3]);
              results.push({
                game: game,
                team: fullMatch[3],
                betPercent: parseInt(fullMatch[4], 10),
                handlePercent: parseInt(fullMatch[5], 10),
              });
            }
          }
        }
      }

      return results;
    });

    console.log(`[DKSplits] Extracted ${splits.length} betting splits`);
    return splits;

  } catch (err) {
    console.error("[DKSplits] Scrape failed:", err.message);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run directly for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("[DKSplits] Running test...\n");
  getBettingSplits().then((splits) => {
    console.log("\n[DKSplits] First 3 results:");
    splits.slice(0, 3).forEach((s, i) => {
      console.log(`  ${i + 1}. game: "${s.game}", team: "${s.team}", betPercent: ${s.betPercent}, handlePercent: ${s.handlePercent}`);
    });
    console.log(`\n[DKSplits] Total: ${splits.length} splits`);
  });
}
