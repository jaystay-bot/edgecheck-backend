// DraftKings Betting Splits Scraper
// Scrapes public betting split data from DK Network
// Note: Requires Playwright which only works locally, not on Vercel serverless

const DK_SPLITS_URL = "https://dknetwork.draftkings.com/draftkings-sportsbook-betting-splits";

// Team name normalization maps (name variants → standard abbreviation)
const TEAM_MAPS = {
  MLB: {
    "dodgers": "LAD", "la dodgers": "LAD", "los angeles dodgers": "LAD",
    "nationals": "WSH", "was nationals": "WSH", "washington nationals": "WSH", "washington": "WSH",
    "yankees": "NYY", "ny yankees": "NYY", "new york yankees": "NYY",
    "mets": "NYM", "ny mets": "NYM", "new york mets": "NYM",
    "phillies": "PHI", "phi phillies": "PHI", "philadelphia phillies": "PHI", "philadelphia": "PHI",
    "rockies": "COL", "col rockies": "COL", "colorado rockies": "COL", "colorado": "COL",
    "marlins": "MIA", "mia marlins": "MIA", "miami marlins": "MIA", "miami": "MIA",
    "astros": "HOU", "hou astros": "HOU", "houston astros": "HOU", "houston": "HOU",
    "athletics": "OAK", "oakland athletics": "OAK", "oakland": "OAK",
    "giants": "SF", "sf giants": "SF", "san francisco giants": "SF", "san francisco": "SF",
    "mariners": "SEA", "sea mariners": "SEA", "seattle mariners": "SEA", "seattle": "SEA",
    "angels": "LAA", "la angels": "LAA", "los angeles angels": "LAA",
    "braves": "ATL", "atl braves": "ATL", "atlanta braves": "ATL", "atlanta": "ATL",
    "diamondbacks": "ARI", "ari diamondbacks": "ARI", "arizona diamondbacks": "ARI", "arizona": "ARI",
    "cubs": "CHC", "chi cubs": "CHC", "chicago cubs": "CHC",
    "guardians": "CLE", "cle guardians": "CLE", "cleveland guardians": "CLE", "cleveland": "CLE",
    "cardinals": "STL", "stl cardinals": "STL", "st louis cardinals": "STL", "st. louis cardinals": "STL",
    "tigers": "DET", "det tigers": "DET", "detroit tigers": "DET", "detroit": "DET",
    "red sox": "BOS", "bos red sox": "BOS", "boston red sox": "BOS", "boston": "BOS",
    "rays": "TB", "tb rays": "TB", "tampa bay rays": "TB", "tampa bay": "TB",
    "orioles": "BAL", "bal orioles": "BAL", "baltimore orioles": "BAL", "baltimore": "BAL",
    "blue jays": "TOR", "tor blue jays": "TOR", "toronto blue jays": "TOR", "toronto": "TOR",
    "white sox": "CWS", "chi white sox": "CWS", "chicago white sox": "CWS",
    "twins": "MIN", "min twins": "MIN", "minnesota twins": "MIN", "minnesota": "MIN",
    "royals": "KC", "kc royals": "KC", "kansas city royals": "KC", "kansas city": "KC",
    "rangers": "TEX", "tex rangers": "TEX", "texas rangers": "TEX", "texas": "TEX",
    "padres": "SD", "sd padres": "SD", "san diego padres": "SD", "san diego": "SD",
    "reds": "CIN", "cin reds": "CIN", "cincinnati reds": "CIN", "cincinnati": "CIN",
    "brewers": "MIL", "mil brewers": "MIL", "milwaukee brewers": "MIL", "milwaukee": "MIL",
    "pirates": "PIT", "pit pirates": "PIT", "pittsburgh pirates": "PIT", "pittsburgh": "PIT",
  },
  NBA: {
    "lakers": "LAL", "la lakers": "LAL", "los angeles lakers": "LAL",
    "clippers": "LAC", "la clippers": "LAC", "los angeles clippers": "LAC",
    "warriors": "GSW", "golden state warriors": "GSW", "golden state": "GSW",
    "celtics": "BOS", "boston celtics": "BOS",
    "nets": "BKN", "brooklyn nets": "BKN", "brooklyn": "BKN",
    "knicks": "NYK", "ny knicks": "NYK", "new york knicks": "NYK",
    "76ers": "PHI", "sixers": "PHI", "philadelphia 76ers": "PHI",
    "heat": "MIA", "miami heat": "MIA",
    "magic": "ORL", "orlando magic": "ORL", "orlando": "ORL",
    "hawks": "ATL", "atlanta hawks": "ATL",
    "hornets": "CHA", "charlotte hornets": "CHA", "charlotte": "CHA",
    "wizards": "WAS", "washington wizards": "WAS",
    "bulls": "CHI", "chicago bulls": "CHI", "chicago": "CHI",
    "cavaliers": "CLE", "cavs": "CLE", "cleveland cavaliers": "CLE",
    "pistons": "DET", "detroit pistons": "DET",
    "pacers": "IND", "indiana pacers": "IND", "indiana": "IND",
    "bucks": "MIL", "milwaukee bucks": "MIL",
    "timberwolves": "MIN", "wolves": "MIN", "minnesota timberwolves": "MIN",
    "pelicans": "NOP", "new orleans pelicans": "NOP", "new orleans": "NOP",
    "thunder": "OKC", "oklahoma city thunder": "OKC", "oklahoma city": "OKC",
    "suns": "PHX", "phoenix suns": "PHX", "phoenix": "PHX",
    "trail blazers": "POR", "blazers": "POR", "portland trail blazers": "POR", "portland": "POR",
    "kings": "SAC", "sacramento kings": "SAC", "sacramento": "SAC",
    "spurs": "SAS", "san antonio spurs": "SAS", "san antonio": "SAS",
    "raptors": "TOR", "toronto raptors": "TOR",
    "jazz": "UTA", "utah jazz": "UTA", "utah": "UTA",
    "mavericks": "DAL", "mavs": "DAL", "dallas mavericks": "DAL", "dallas": "DAL",
    "rockets": "HOU", "houston rockets": "HOU",
    "grizzlies": "MEM", "memphis grizzlies": "MEM", "memphis": "MEM",
    "nuggets": "DEN", "denver nuggets": "DEN", "denver": "DEN",
  },
  NHL: {
    "bruins": "BOS", "boston bruins": "BOS",
    "sabres": "BUF", "buffalo sabres": "BUF", "buffalo": "BUF",
    "red wings": "DET", "detroit red wings": "DET",
    "panthers": "FLA", "florida panthers": "FLA", "florida": "FLA",
    "canadiens": "MTL", "montreal canadiens": "MTL", "montreal": "MTL",
    "senators": "OTT", "ottawa senators": "OTT", "ottawa": "OTT",
    "lightning": "TB", "tampa bay lightning": "TB",
    "maple leafs": "TOR", "leafs": "TOR", "toronto maple leafs": "TOR",
    "hurricanes": "CAR", "carolina hurricanes": "CAR", "carolina": "CAR",
    "blue jackets": "CBJ", "columbus blue jackets": "CBJ", "columbus": "CBJ",
    "devils": "NJ", "new jersey devils": "NJ", "new jersey": "NJ",
    "islanders": "NYI", "ny islanders": "NYI", "new york islanders": "NYI",
    "rangers": "NYR", "ny rangers": "NYR", "new york rangers": "NYR",
    "flyers": "PHI", "philadelphia flyers": "PHI",
    "penguins": "PIT", "pittsburgh penguins": "PIT",
    "capitals": "WSH", "washington capitals": "WSH",
    "blackhawks": "CHI", "chicago blackhawks": "CHI",
    "avalanche": "COL", "colorado avalanche": "COL",
    "stars": "DAL", "dallas stars": "DAL",
    "wild": "MIN", "minnesota wild": "MIN",
    "predators": "NSH", "nashville predators": "NSH", "nashville": "NSH",
    "blues": "STL", "st louis blues": "STL", "st. louis blues": "STL",
    "jets": "WPG", "winnipeg jets": "WPG", "winnipeg": "WPG",
    "coyotes": "ARI", "utah hockey club": "UTA", "arizona coyotes": "ARI",
    "flames": "CGY", "calgary flames": "CGY", "calgary": "CGY",
    "oilers": "EDM", "edmonton oilers": "EDM", "edmonton": "EDM",
    "kings": "LA", "la kings": "LA", "los angeles kings": "LA",
    "ducks": "ANA", "anaheim ducks": "ANA", "anaheim": "ANA",
    "sharks": "SJ", "san jose sharks": "SJ", "san jose": "SJ",
    "kraken": "SEA", "seattle kraken": "SEA",
    "canucks": "VAN", "vancouver canucks": "VAN", "vancouver": "VAN",
    "golden knights": "VGK", "vegas golden knights": "VGK", "vegas": "VGK",
  },
  NFL: {
    "cardinals": "ARI", "arizona cardinals": "ARI",
    "falcons": "ATL", "atlanta falcons": "ATL",
    "ravens": "BAL", "baltimore ravens": "BAL",
    "bills": "BUF", "buffalo bills": "BUF",
    "panthers": "CAR", "carolina panthers": "CAR",
    "bears": "CHI", "chicago bears": "CHI",
    "bengals": "CIN", "cincinnati bengals": "CIN",
    "browns": "CLE", "cleveland browns": "CLE",
    "cowboys": "DAL", "dallas cowboys": "DAL",
    "broncos": "DEN", "denver broncos": "DEN",
    "lions": "DET", "detroit lions": "DET",
    "packers": "GB", "green bay packers": "GB", "green bay": "GB",
    "texans": "HOU", "houston texans": "HOU",
    "colts": "IND", "indianapolis colts": "IND", "indianapolis": "IND",
    "jaguars": "JAX", "jacksonville jaguars": "JAX", "jacksonville": "JAX",
    "chiefs": "KC", "kansas city chiefs": "KC",
    "raiders": "LV", "las vegas raiders": "LV", "las vegas": "LV",
    "chargers": "LAC", "la chargers": "LAC", "los angeles chargers": "LAC",
    "rams": "LAR", "la rams": "LAR", "los angeles rams": "LAR",
    "dolphins": "MIA", "miami dolphins": "MIA",
    "vikings": "MIN", "minnesota vikings": "MIN",
    "patriots": "NE", "new england patriots": "NE", "new england": "NE",
    "saints": "NO", "new orleans saints": "NO",
    "giants": "NYG", "ny giants": "NYG", "new york giants": "NYG",
    "jets": "NYJ", "ny jets": "NYJ", "new york jets": "NYJ",
    "eagles": "PHI", "philadelphia eagles": "PHI",
    "steelers": "PIT", "pittsburgh steelers": "PIT",
    "49ers": "SF", "san francisco 49ers": "SF", "niners": "SF",
    "seahawks": "SEA", "seattle seahawks": "SEA",
    "buccaneers": "TB", "bucs": "TB", "tampa bay buccaneers": "TB",
    "titans": "TEN", "tennessee titans": "TEN", "tennessee": "TEN",
    "commanders": "WAS", "washington commanders": "WAS",
  },
};

// Detect sport from team name
function detectSport(teamName) {
  const lower = teamName.toLowerCase();
  for (const [sport, map] of Object.entries(TEAM_MAPS)) {
    for (const name of Object.keys(map)) {
      if (lower.includes(name)) return sport;
    }
  }
  return null;
}

// Normalize team name to abbreviation
function normalizeTeam(teamName, sport = null) {
  const lower = teamName.toLowerCase().trim();

  // If sport known, use that map first
  if (sport && TEAM_MAPS[sport]) {
    for (const [name, abbrev] of Object.entries(TEAM_MAPS[sport])) {
      if (lower.includes(name) || lower === name) return abbrev;
    }
  }

  // Try all sports
  for (const [s, map] of Object.entries(TEAM_MAPS)) {
    for (const [name, abbrev] of Object.entries(map)) {
      if (lower.includes(name) || lower === name) return { abbrev, sport: s };
    }
  }
  return null;
}

// Parse game string like "LA Dodgers @ WAS Nationals" into away/home
function parseGameString(gameStr) {
  // Try "Away @ Home" pattern
  let match = gameStr.match(/^(.+?)\s*@\s*(.+)$/i);
  if (match) {
    return { away: match[1].trim(), home: match[2].trim() };
  }
  // Try "Away vs Home" pattern
  match = gameStr.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  if (match) {
    return { away: match[1].trim(), home: match[2].trim() };
  }
  return null;
}

/**
 * Fetches betting splits from DraftKings Network
 * @returns {Promise<Array<{sport: string, game: string, awayTeam: string, homeTeam: string, betPercent: number, handlePercent: number}>>}
 */
export async function getBettingSplits() {
  let browser = null;

  try {
    // Dynamic import to avoid build-time errors on Vercel
    let chromium;
    try {
      const pw = await import("playwright");
      chromium = pw.chromium;
    } catch (importErr) {
      console.warn("[DKSplits] Playwright not available (serverless env):", importErr.message);
      return [];
    }

    console.log("[DKSplits] Launching browser...");
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    console.log("[DKSplits] Navigating to DK splits page...");
    await page.goto(DK_SPLITS_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(5000);

    // Scroll extensively to load all content
    console.log("[DKSplits] Scrolling to load content...");
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await page.waitForTimeout(400);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);

    // Extract all visible splits (sport detected from team names)
    const rawSplits = await page.evaluate(() => {
      const results = [];
      const seen = new Set();
      const bodyText = document.body.innerText;
      const lines = bodyText.split("\n").map(l => l.trim()).filter(l => l);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Look for game matchup patterns
        let gameMatch = line.match(/^([A-Za-z][A-Za-z0-9\s.'-]+?)\s*@\s*([A-Za-z][A-Za-z0-9\s.'-]+)$/i);
        if (!gameMatch) {
          gameMatch = line.match(/^([A-Za-z][A-Za-z0-9\s.'-]+?)\s+vs\.?\s+([A-Za-z][A-Za-z0-9\s.'-]+)$/i);
        }

        if (gameMatch) {
          const awayRaw = gameMatch[1].trim();
          const homeRaw = gameMatch[2].trim();

          if (awayRaw.length < 3 || homeRaw.length < 3) continue;

          const gameName = `${awayRaw} @ ${homeRaw}`;
          if (seen.has(gameName)) continue;

          const nearbyText = lines.slice(i, i + 20).join(" ");
          const percents = nearbyText.match(/(\d+)%/g);

          if (percents && percents.length >= 2) {
            seen.add(gameName);
            results.push({
              game: gameName,
              awayRaw,
              homeRaw,
              betPercent: parseInt(percents[0], 10),
              handlePercent: parseInt(percents[1], 10),
            });
          }
        }
      }

      return results;
    });

    console.log(`[DKSplits] Extracted ${rawSplits.length} raw entries`);

    // Normalize and deduplicate
    const normalized = [];
    const seen = new Set();

    for (const raw of rawSplits) {
      // Normalize away team (detects sport from team name)
      const awayResult = normalizeTeam(raw.awayRaw);
      if (!awayResult) continue;

      const awayTeam = typeof awayResult === "string" ? awayResult : awayResult.abbrev;
      const detectedSport = typeof awayResult === "string" ? null : awayResult.sport;

      // Normalize home team using detected sport
      const homeResult = normalizeTeam(raw.homeRaw, detectedSport);
      if (!homeResult) continue;

      const homeTeam = typeof homeResult === "string" ? homeResult : homeResult.abbrev;
      const finalSport = detectedSport || (typeof homeResult === "object" ? homeResult.sport : null);

      if (!finalSport || !awayTeam || !homeTeam) continue;

      // Create normalized game string
      const gameKey = `${finalSport}:${awayTeam}@${homeTeam}`;
      if (seen.has(gameKey)) continue;
      seen.add(gameKey);

      normalized.push({
        sport: finalSport,
        game: `${awayTeam} @ ${homeTeam}`,
        awayTeam,
        homeTeam,
        betPercent: raw.betPercent,
        handlePercent: raw.handlePercent,
      });
    }

    console.log(`[DKSplits] Normalized: ${normalized.length} unique splits`);
    return normalized;

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
    console.log("\n[DKSplits] Sample results:");
    splits.slice(0, 5).forEach((s, i) => {
      console.log(`  ${i + 1}. [${s.sport}] ${s.game} - ${s.betPercent}% bets / ${s.handlePercent}% handle`);
    });
    console.log(`\n[DKSplits] Total: ${splits.length} splits`);

    // Show sport breakdown
    const bySport = {};
    for (const s of splits) {
      bySport[s.sport] = (bySport[s.sport] || 0) + 1;
    }
    console.log("[DKSplits] By sport:", bySport);
  });
}
