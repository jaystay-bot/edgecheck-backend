// NBA Stats - ESPN API for game context (free, no auth required)
// Provides matchup, game time, team context, injury status, and player game logs for NBA props

const ESPN_NBA_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard";
const ESPN_NBA_INJURIES = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries";
const NBA_STATS_API = "https://stats.nba.com/stats";

// Required headers for stats.nba.com
const NBA_STATS_HEADERS = {
  "User-Agent": "Mozilla/5.0",
  "Referer": "https://www.nba.com",
  "Accept": "application/json",
};

// Cache for NBA games (refreshes hourly)
const nbaGamesCache = {
  games: null,
  timestamp: 0,
};
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Cache for NBA player IDs and stats
const nbaPlayerCache = {
  playerIds: {}, // name -> { id, timestamp }
  playerStats: {}, // playerId -> { data, timestamp }
};
const PLAYER_ID_TTL = 24 * 60 * 60 * 1000; // 24 hours for player ID lookup
const PLAYER_STATS_TTL = 4 * 60 * 60 * 1000; // 4 hours for player stats

// Cache for full NBA player list (fetched once, reused for all lookups)
let allPlayersCache = {
  players: null, // Map: normalizedName -> playerId
  timestamp: 0,
};
const ALL_PLAYERS_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Cache for injuries (refreshes every 30 min)
const nbaInjuriesCache = {
  injuries: null, // Map of normalized player name -> status
  timestamp: 0,
};
const INJURIES_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

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

// Fetch NBA injuries from ESPN (cached)
async function fetchNBAInjuries() {
  const now = Date.now();
  if (nbaInjuriesCache.injuries && now - nbaInjuriesCache.timestamp < INJURIES_CACHE_TTL) {
    return nbaInjuriesCache.injuries;
  }

  try {
    console.log("[NBAStats] Fetching NBA injuries from ESPN...");
    const res = await fetch(ESPN_NBA_INJURIES, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) {
      console.warn(`[NBAStats] Injuries API returned ${res.status}`);
      return nbaInjuriesCache.injuries || new Map();
    }

    const data = await res.json();
    const injuryMap = new Map();

    // Parse injuries by team
    for (const team of data.injuries || []) {
      for (const player of team.injuries || []) {
        const name = normalizeName(player.athlete?.displayName);
        if (!name) continue;

        // ESPN status: "Out", "Day-To-Day", "Questionable", "Doubtful", "Probable"
        const espnStatus = player.status || "";
        let status = "active";

        if (espnStatus.toLowerCase().includes("out")) {
          status = "out";
        } else if (espnStatus.toLowerCase().includes("doubtful")) {
          status = "doubtful";
        } else if (espnStatus.toLowerCase().includes("questionable") || espnStatus.toLowerCase().includes("day-to-day")) {
          status = "questionable";
        }

        injuryMap.set(name, {
          status,
          description: player.details?.type || espnStatus,
        });
      }
    }

    console.log(`[NBAStats] Loaded ${injuryMap.size} NBA player injuries`);
    nbaInjuriesCache.injuries = injuryMap;
    nbaInjuriesCache.timestamp = now;

    return injuryMap;
  } catch (err) {
    console.error("[NBAStats] Failed to fetch injuries:", err.message);
    return nbaInjuriesCache.injuries || new Map();
  }
}

// Fetch and cache full NBA player list (called once per session)
async function ensureAllPlayersLoaded() {
  const now = Date.now();
  if (allPlayersCache.players && now - allPlayersCache.timestamp < ALL_PLAYERS_TTL) {
    return allPlayersCache.players;
  }

  try {
    // Get current season string (e.g., "2024-25")
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;
    const seasonYear = month >= 10 ? year : year - 1;
    const seasonStr = `${seasonYear}-${String(seasonYear + 1).slice(-2)}`;

    console.log(`[NBAStats] Fetching full player list for season ${seasonStr}...`);
    const url = `${NBA_STATS_API}/commonallplayers?LeagueID=00&Season=${seasonStr}&IsOnlyCurrentSeason=1`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000), // 8s timeout (reduced from 15s)
      headers: NBA_STATS_HEADERS,
    });

    if (!res.ok) {
      console.warn(`[NBAStats] Player list API returned ${res.status}`);
      return null;
    }

    const data = await res.json();
    const headers = data.resultSets?.[0]?.headers || [];
    const rows = data.resultSets?.[0]?.rowSet || [];

    const idIdx = headers.indexOf("PERSON_ID");
    const nameIdx = headers.indexOf("DISPLAY_FIRST_LAST");

    if (idIdx === -1 || nameIdx === -1 || rows.length === 0) {
      console.warn("[NBAStats] Player list response missing expected fields");
      return null;
    }

    // Build lookup map: normalizedName -> playerId
    const playerMap = new Map();
    for (const row of rows) {
      const fullName = row[nameIdx] || "";
      const playerId = row[idIdx];
      if (fullName && playerId) {
        const normalized = normalizeName(fullName);
        playerMap.set(normalized, playerId);
      }
    }

    console.log(`[NBAStats] Cached ${playerMap.size} NBA players`);
    allPlayersCache = { players: playerMap, timestamp: now };
    return playerMap;
  } catch (err) {
    console.warn(`[NBAStats] Failed to fetch player list:`, err.message);
    return null;
  }
}

// Search for NBA player ID by name (uses cached player list)
async function findNBAPlayerId(playerName) {
  const normalizedName = normalizeName(playerName);

  // Check individual cache first
  const cached = nbaPlayerCache.playerIds[normalizedName];
  if (cached && Date.now() - cached.timestamp < PLAYER_ID_TTL) {
    return cached.id;
  }

  // Ensure full player list is loaded
  const playerMap = await ensureAllPlayersLoaded();
  if (!playerMap) return null;

  // Direct lookup
  let playerId = playerMap.get(normalizedName);

  // Fuzzy match if direct lookup fails
  if (!playerId) {
    for (const [name, id] of playerMap.entries()) {
      if (name.includes(normalizedName) || normalizedName.includes(name)) {
        playerId = id;
        break;
      }
    }
  }

  if (playerId) {
    nbaPlayerCache.playerIds[normalizedName] = { id: playerId, timestamp: Date.now() };
  }

  return playerId || null;
}

// Fetch player game log (last 10 games) from stats.nba.com
// Cache by playerId only - one API call returns all stat types
async function fetchNBAPlayerStats(playerId) {
  const cacheKey = `nba_${playerId}`;
  const cached = nbaPlayerCache.playerStats[cacheKey];
  if (cached && Date.now() - cached.timestamp < PLAYER_STATS_TTL) {
    return cached.data;
  }

  try {
    // Get current season string (e.g., "2024-25")
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const seasonYear = month >= 10 ? year : year - 1;
    const seasonStr = `${seasonYear}-${String(seasonYear + 1).slice(-2)}`;

    const url = `${NBA_STATS_API}/playergamelog?PlayerID=${playerId}&Season=${seasonStr}&SeasonType=Regular+Season`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000), // 5s timeout per player (reduced from 10s)
      headers: NBA_STATS_HEADERS,
    });

    if (!res.ok) {
      console.warn(`[NBAStats] Stats API returned ${res.status} for player ${playerId}`);
      return null;
    }

    const data = await res.json();
    const headers = data.resultSets?.[0]?.headers || [];
    const rows = data.resultSets?.[0]?.rowSet || [];

    if (rows.length === 0) {
      return null;
    }

    // Find column indices for stats we need
    const dateIdx = headers.indexOf("GAME_DATE");
    const ptsIdx = headers.indexOf("PTS");
    const rebIdx = headers.indexOf("REB");
    const astIdx = headers.indexOf("AST");
    const stlIdx = headers.indexOf("STL");
    const blkIdx = headers.indexOf("BLK");
    const fg3mIdx = headers.indexOf("FG3M");

    // DEBUG: Log first raw game object
    if (rows[0]) {
      const rawGame = {};
      headers.forEach((h, i) => { rawGame[h] = rows[0][i]; });
      console.log("[NBAStats] Raw game object:", JSON.stringify(rawGame, null, 2));
    }

    // Take first 10 games (already sorted most recent first by NBA API)
    const last10Games = rows.slice(0, 10).map((row) => ({
      date: row[dateIdx] || null,
      points: row[ptsIdx] || 0,
      rebounds: row[rebIdx] || 0,
      assists: row[astIdx] || 0,
      steals: row[stlIdx] || 0,
      blocks: row[blkIdx] || 0,
      threes: row[fg3mIdx] || 0,
    }));

    console.log(`[NBAStats] Mapped last10Games[0]:`, JSON.stringify(last10Games[0], null, 2));

    const result = {
      gamesPlayed: last10Games.length,
      last10Games,
    };

    nbaPlayerCache.playerStats[cacheKey] = { data: result, timestamp: Date.now() };
    return result;
  } catch (err) {
    console.warn(`[NBAStats] Failed to fetch stats for player ${playerId}:`, err.message);
    return null;
  }
}

// Main enrichment function - adds ESPN game context and player stats to NBA props
// Optimized: batch fetch unique players first, then apply cached stats to all props
// Time-budgeted: stops fetching stats after MAX_ENRICHMENT_TIME to avoid timeouts
export async function enrichNBAProps(props) {
  if (!props || props.length === 0) return props;

  const startTime = Date.now();
  const MAX_ENRICHMENT_TIME = 15000; // 15 seconds max for all enrichment
  const MAX_PLAYERS_TO_FETCH = 30; // Limit player stats fetches (increased after disabling injuries)

  console.log(`[NBAStats] Enriching ${props.length} NBA props (max ${MAX_ENRICHMENT_TIME}ms budget)...`);

  // Fetch today's games only (injuries disabled to prioritize L10 stats fetch time)
  const games = await fetchTodaysNBAGames();
  const injuries = new Map(); // Disabled: fetchNBAInjuries() - saves ~1-2s for L10 budget

  // STEP 1: Pre-sort props by quality indicators to prioritize top props for enrichment
  // Quick score based on line (lower = easier) and odds (closer to -110 = better)
  const scoredProps = props.map(p => {
    const line = p.line || 10;
    const odds = Math.abs(p.odds?.[0]?.price || -110);
    // Lower lines and better odds = higher priority
    const priority = (1 / (line + 1)) * 100 + (odds <= 120 ? 10 : 0);
    return { ...p, _priority: priority };
  }).sort((a, b) => b._priority - a._priority);

  // Reserve slots for top steals/blocks props (these categories need guaranteed L10 enrichment)
  const uniquePlayers = [];
  const seenPlayers = new Set();

  // Find top 2 steals props and add their players first
  const stealsProps = props.filter(p =>
    p.propType?.toLowerCase().includes('steal') || p.statType?.toLowerCase()?.includes('steal')
  ).sort((a, b) => (a.line || 10) - (b.line || 10)); // Lower lines = better

  for (const p of stealsProps.slice(0, 2)) {
    if (p.playerName && !seenPlayers.has(p.playerName)) {
      uniquePlayers.push(p.playerName);
      seenPlayers.add(p.playerName);
    }
  }

  // Find top 2 blocks props and add their players
  const blocksProps = props.filter(p =>
    p.propType?.toLowerCase().includes('block') || p.statType?.toLowerCase()?.includes('block')
  ).sort((a, b) => (a.line || 10) - (b.line || 10));

  for (const p of blocksProps.slice(0, 2)) {
    if (p.playerName && !seenPlayers.has(p.playerName)) {
      uniquePlayers.push(p.playerName);
      seenPlayers.add(p.playerName);
    }
  }

  console.log(`[NBAStats] Reserved ${uniquePlayers.length} slots for steals/blocks players`);

  // Fill remaining slots with high-priority players from other categories
  for (const p of scoredProps) {
    if (!seenPlayers.has(p.playerName) && uniquePlayers.length < MAX_PLAYERS_TO_FETCH) {
      uniquePlayers.push(p.playerName);
      seenPlayers.add(p.playerName);
    }
  }
  console.log(`[NBAStats] Prioritized ${uniquePlayers.length} players total (incl. reserved steals/blocks)...`);

  // Batch fetch player IDs (with concurrency limit to avoid rate limiting)
  const playerStatsMap = new Map(); // playerName -> last10Games
  const BATCH_SIZE = 5;
  let timedOut = false;

  for (let i = 0; i < uniquePlayers.length && !timedOut; i += BATCH_SIZE) {
    // Check time budget before each batch
    if (Date.now() - startTime > MAX_ENRICHMENT_TIME) {
      console.log(`[NBAStats] Time budget exceeded after ${i} players, returning partial data`);
      timedOut = true;
      break;
    }

    const batch = uniquePlayers.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (playerName) => {
        const playerId = await findNBAPlayerId(playerName);
        if (!playerId) return { playerName, stats: null };
        const stats = await fetchNBAPlayerStats(playerId);
        return { playerName, stats };
      })
    );
    for (const { playerName, stats } of batchResults) {
      if (stats?.last10Games?.length > 0) {
        playerStatsMap.set(playerName, stats.last10Games);
      }
    }
  }
  console.log(`[NBAStats] Fetched stats for ${playerStatsMap.size}/${uniquePlayers.length} players in ${Date.now() - startTime}ms`);

  // STEP 2: Process props using cached data (no more API calls)
  let enrichedCount = 0;
  let injuryCount = 0;
  let statsCount = 0;
  const enrichedProps = [];

  for (const prop of props) {
    // Injury status
    const playerNameNorm = normalizeName(prop.playerName);
    const injury = injuries.get(playerNameNorm);
    const injuryEnrichment = {
      injuryStatus: injury ? injury.status : "active",
      injuryNote: injury ? injury.description : null,
    };
    if (injury) injuryCount++;

    // Player stats from cache (no API call)
    let statsEnrichment = {};
    const cachedStats = playerStatsMap.get(prop.playerName);
    if (cachedStats) {
      statsEnrichment.last10Games = cachedStats;
      statsCount++;
    }

    // Game matching
    let game = null;
    if (games.length > 0) {
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
      if (!game && prop.homeTeam) game = findGameForTeam(games, prop.homeTeam);
      if (!game && prop.awayTeam) game = findGameForTeam(games, prop.awayTeam);
    }

    // Build enrichment
    const enrichment = { ...injuryEnrichment, ...statsEnrichment };
    if (game) {
      if (game.matchup) enrichment.matchup = game.matchup;
      if (game.gameTime) enrichment.gameTime = game.gameTime;
      if (prop.isHome === undefined && prop.homeTeam) {
        enrichment.isHome = game.homeAbbrev === prop.homeTeam ||
                            game.homeTeam?.includes(prop.homeTeam);
      }
    }

    if (Object.keys(enrichment).length > 0) enrichedCount++;
    enrichedProps.push({ ...prop, ...enrichment });
  }

  console.log(`[NBAStats] Enriched ${enrichedCount}/${props.length} NBA props (${injuryCount} injuries, ${statsCount} with last10 stats)`);
  return enrichedProps;
}

// Export for testing
export { fetchTodaysNBAGames, findGameForTeam, normalizeName };
