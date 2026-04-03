// NBA Stats - ESPN API for game context (free, no auth required)
// Provides matchup, game time, and team context for NBA props

const ESPN_NBA_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard";

// Cache for NBA games (refreshes hourly)
const nbaGamesCache = {
  games: null,
  timestamp: 0,
};
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Team abbreviation mapping (ESPN uses different abbrevs than Underdog)
const TEAM_ABBREV_MAP = {
  "Atlanta Hawks": "ATL",
  "Boston Celtics": "BOS",
  "Brooklyn Nets": "BKN",
  "Charlotte Hornets": "CHA",
  "Chicago Bulls": "CHI",
  "Cleveland Cavaliers": "CLE",
  "Dallas Mavericks": "DAL",
  "Denver Nuggets": "DEN",
  "Detroit Pistons": "DET",
  "Golden State Warriors": "GSW",
  "Houston Rockets": "HOU",
  "Indiana Pacers": "IND",
  "LA Clippers": "LAC",
  "Los Angeles Clippers": "LAC",
  "Los Angeles Lakers": "LAL",
  "LA Lakers": "LAL",
  "Memphis Grizzlies": "MEM",
  "Miami Heat": "MIA",
  "Milwaukee Bucks": "MIL",
  "Minnesota Timberwolves": "MIN",
  "New Orleans Pelicans": "NOP",
  "New York Knicks": "NYK",
  "Oklahoma City Thunder": "OKC",
  "Orlando Magic": "ORL",
  "Philadelphia 76ers": "PHI",
  "Phoenix Suns": "PHX",
  "Portland Trail Blazers": "POR",
  "Sacramento Kings": "SAC",
  "San Antonio Spurs": "SAS",
  "Toronto Raptors": "TOR",
  "Utah Jazz": "UTA",
  "Washington Wizards": "WAS",
};

function getTeamAbbrev(fullName) {
  return TEAM_ABBREV_MAP[fullName] || fullName?.split(" ").pop()?.substring(0, 3).toUpperCase() || "???";
}

// Fetch today's NBA games from ESPN
async function fetchTodaysNBAGames() {
  const now = Date.now();
  if (nbaGamesCache.games && now - nbaGamesCache.timestamp < CACHE_TTL) {
    return nbaGamesCache.games;
  }

  try {
    console.log("[NBAStats] Fetching today's NBA schedule from ESPN...");
    const res = await fetch(ESPN_NBA_SCOREBOARD, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) {
      console.warn(`[NBAStats] ESPN API returned ${res.status}`);
      return [];
    }

    const data = await res.json();
    const events = data.events || [];

    console.log(`[NBAStats] Found ${events.length} NBA games today`);

    const parsedGames = events.map((event) => {
      const competition = event.competitions?.[0];
      const homeTeam = competition?.competitors?.find((c) => c.homeAway === "home");
      const awayTeam = competition?.competitors?.find((c) => c.homeAway === "away");

      // Format game time
      const gameDate = new Date(event.date);
      const timeStr = gameDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      return {
        id: event.id,
        name: event.name,
        shortName: event.shortName, // e.g., "BOS @ LAL"
        status: event.status?.type?.name, // "STATUS_SCHEDULED", "STATUS_IN_PROGRESS", etc.
        gameTime: timeStr,
        gameDate: event.date,
        homeTeam: homeTeam?.team?.displayName,
        homeAbbrev: homeTeam?.team?.abbreviation,
        awayTeam: awayTeam?.team?.displayName,
        awayAbbrev: awayTeam?.team?.abbreviation,
        // Matchup in standard format
        matchup: `${awayTeam?.team?.abbreviation} @ ${homeTeam?.team?.abbreviation}`,
      };
    });

    nbaGamesCache.games = parsedGames;
    nbaGamesCache.timestamp = now;

    return parsedGames;
  } catch (err) {
    console.error("[NBAStats] Failed to fetch schedule:", err.message);
    return [];
  }
}

// Normalize player name for matching
function normalizeName(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\s+jr\.?$/i, "")
    .replace(/\s+sr\.?$/i, "")
    .replace(/\s+(ii|iii|iv|v)$/i, "")
    .replace(/[^a-z\s]/g, "")
    .trim();
}

// Find game by team abbreviation match
function findGameForTeam(games, teamAbbrev) {
  if (!teamAbbrev || !games) return null;
  const abbrev = teamAbbrev.toUpperCase();
  return games.find((g) =>
    g.homeAbbrev === abbrev || g.awayAbbrev === abbrev
  );
}

// Main enrichment function - adds ESPN game context to NBA props
export async function enrichNBAProps(props) {
  if (!props || props.length === 0) return props;

  console.log(`[NBAStats] Enriching ${props.length} NBA props with ESPN context...`);

  // Fetch today's games (cached)
  const games = await fetchTodaysNBAGames();

  if (games.length === 0) {
    console.warn("[NBAStats] No NBA games found, returning props without enrichment");
    return props;
  }

  let enrichedCount = 0;

  const enrichedProps = props.map((prop) => {
    // Try to match by existing matchup or team names
    let game = null;

    // If prop has matchup from Underdog, try to find matching ESPN game
    if (prop.matchup) {
      const parts = prop.matchup.split(" @ ");
      if (parts.length === 2) {
        const awayAbbrev = parts[0].trim();
        const homeAbbrev = parts[1].trim();
        game = games.find((g) =>
          g.awayAbbrev === awayAbbrev && g.homeAbbrev === homeAbbrev
        );
      }
    }

    // Fallback: try to match by home or away team
    if (!game && prop.homeTeam) {
      game = findGameForTeam(games, prop.homeTeam);
    }
    if (!game && prop.awayTeam) {
      game = findGameForTeam(games, prop.awayTeam);
    }

    if (!game) return prop;

    // Build enrichment
    const enrichment = {};

    // Always update matchup and time from ESPN (more reliable)
    if (game.matchup) {
      enrichment.matchup = game.matchup;
    }
    if (game.gameTime) {
      enrichment.gameTime = game.gameTime;
    }

    // Determine home/away if not already set
    if (prop.isHome === undefined && prop.homeTeam) {
      enrichment.isHome = game.homeAbbrev === prop.homeTeam ||
                          game.homeTeam?.includes(prop.homeTeam);
    }

    if (Object.keys(enrichment).length > 0) {
      enrichedCount++;
    }

    return { ...prop, ...enrichment };
  });

  console.log(`[NBAStats] Enriched ${enrichedCount}/${props.length} NBA props with game context`);
  return enrichedProps;
}

// Export for testing
export { fetchTodaysNBAGames, findGameForTeam, normalizeName };
