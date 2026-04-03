// MLB Stats API - Free, no auth required
// Provides pitcher, lineup, handedness, recent performance, and pitcher quality context

const MLB_STATS_BASE = "https://statsapi.mlb.com/api/v1";

// Cache for MLB Stats data (refreshes hourly)
const mlbStatsCache = {
  games: null,
  lineups: {},
  playerStats: {}, // Cache for batter recent stats
  pitcherStats: {}, // Cache for pitcher season stats
  timestamp: 0,
};
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const PLAYER_STATS_TTL = 4 * 60 * 60 * 1000; // 4 hours for player stats

// Team abbreviation mapping for matching
const TEAM_ABBREV = {
  "Arizona Diamondbacks": "ARI",
  "Atlanta Braves": "ATL",
  "Baltimore Orioles": "BAL",
  "Boston Red Sox": "BOS",
  "Chicago Cubs": "CHC",
  "Chicago White Sox": "CWS",
  "Cincinnati Reds": "CIN",
  "Cleveland Guardians": "CLE",
  "Colorado Rockies": "COL",
  "Detroit Tigers": "DET",
  "Houston Astros": "HOU",
  "Kansas City Royals": "KC",
  "Los Angeles Angels": "LAA",
  "Los Angeles Dodgers": "LAD",
  "Miami Marlins": "MIA",
  "Milwaukee Brewers": "MIL",
  "Minnesota Twins": "MIN",
  "New York Mets": "NYM",
  "New York Yankees": "NYY",
  "Oakland Athletics": "OAK",
  "Philadelphia Phillies": "PHI",
  "Pittsburgh Pirates": "PIT",
  "San Diego Padres": "SD",
  "San Francisco Giants": "SF",
  "Seattle Mariners": "SEA",
  "St. Louis Cardinals": "STL",
  "Tampa Bay Rays": "TB",
  "Texas Rangers": "TEX",
  "Toronto Blue Jays": "TOR",
  "Washington Nationals": "WSH",
};

function getTeamAbbrev(fullName) {
  return TEAM_ABBREV[fullName] || fullName?.split(" ").pop()?.substring(0, 3).toUpperCase() || "???";
}

// Fetch today's MLB schedule with probable pitchers
async function fetchTodaysGames() {
  const now = Date.now();
  if (mlbStatsCache.games && now - mlbStatsCache.timestamp < CACHE_TTL) {
    return mlbStatsCache.games;
  }

  try {
    const today = new Date().toISOString().split("T")[0];
    const url = `${MLB_STATS_BASE}/schedule?sportId=1&date=${today}&hydrate=probablePitcher(note),linescore,team`;

    console.log("[MLBStats] Fetching today's schedule...");
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!res.ok) {
      console.warn(`[MLBStats] Schedule API returned ${res.status}`);
      return [];
    }

    const data = await res.json();
    const games = data.dates?.[0]?.games || [];

    console.log(`[MLBStats] Found ${games.length} games today`);

    // Parse games into lookup format
    const parsedGames = games.map((game) => {
      const away = game.teams?.away;
      const home = game.teams?.home;

      return {
        gamePk: game.gamePk,
        gameTime: game.gameDate,
        status: game.status?.detailedState,
        awayTeam: away?.team?.name,
        awayAbbrev: getTeamAbbrev(away?.team?.name),
        homeTeam: home?.team?.name,
        homeAbbrev: getTeamAbbrev(home?.team?.name),
        awayPitcher: away?.probablePitcher ? {
          id: away.probablePitcher.id,
          name: away.probablePitcher.fullName,
          hand: away.probablePitcher.pitchHand?.code, // L or R
        } : null,
        homePitcher: home?.probablePitcher ? {
          id: home.probablePitcher.id,
          name: home.probablePitcher.fullName,
          hand: home.probablePitcher.pitchHand?.code,
        } : null,
      };
    });

    mlbStatsCache.games = parsedGames;
    mlbStatsCache.timestamp = now;

    return parsedGames;
  } catch (err) {
    console.error("[MLBStats] Failed to fetch schedule:", err.message);
    return [];
  }
}

// Fetch lineup for a specific game (with caching)
async function fetchGameLineup(gamePk) {
  if (mlbStatsCache.lineups[gamePk]) {
    return mlbStatsCache.lineups[gamePk];
  }

  try {
    const url = `${MLB_STATS_BASE}.1/game/${gamePk}/feed/live`;
    console.log(`[MLBStats] Fetching lineup for game ${gamePk}...`);

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;

    const data = await res.json();
    const boxscore = data.liveData?.boxscore;

    if (!boxscore) return null;

    // Extract lineup data for both teams
    const lineup = {
      away: parseTeamLineup(boxscore.teams?.away),
      home: parseTeamLineup(boxscore.teams?.home),
    };

    mlbStatsCache.lineups[gamePk] = lineup;
    return lineup;
  } catch (err) {
    console.warn(`[MLBStats] Failed to fetch lineup for game ${gamePk}:`, err.message);
    return null;
  }
}

function parseTeamLineup(teamData) {
  if (!teamData) return { batters: [], pitcher: null };

  const batters = [];
  const battingOrder = teamData.battingOrder || [];
  const players = teamData.players || {};

  // Parse batting order (battingOrder contains player IDs in order)
  battingOrder.forEach((playerId, index) => {
    const playerKey = `ID${playerId}`;
    const player = players[playerKey];

    if (player?.person) {
      batters.push({
        id: player.person.id,
        name: player.person.fullName,
        position: player.position?.abbreviation,
        battingOrder: index + 1, // 1-9
        batSide: player.batSide?.code, // L, R, or S (switch)
      });
    }
  });

  // Find starting pitcher
  const pitchers = teamData.pitchers || [];
  let startingPitcher = null;

  if (pitchers.length > 0) {
    const firstPitcherId = pitchers[0];
    const pitcherKey = `ID${firstPitcherId}`;
    const pitcher = players[pitcherKey];

    if (pitcher?.person) {
      startingPitcher = {
        id: pitcher.person.id,
        name: pitcher.person.fullName,
        pitchHand: pitcher.pitchHand?.code, // L or R
      };
    }
  }

  return { batters, pitcher: startingPitcher };
}

// Fetch recent batter stats (last 10 games)
async function fetchBatterStats(playerId) {
  const cacheKey = `batter_${playerId}`;
  const cached = mlbStatsCache.playerStats[cacheKey];
  if (cached && Date.now() - cached.timestamp < PLAYER_STATS_TTL) {
    return cached.data;
  }

  try {
    const season = new Date().getFullYear();
    const url = `${MLB_STATS_BASE}/people/${playerId}/stats?stats=gameLog&group=hitting&season=${season}&limit=10`;

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;

    const data = await res.json();
    const splits = data.stats?.[0]?.splits || [];

    if (splits.length === 0) return null;

    // Calculate stats over last 5 and 10 games
    let last5 = { hits: 0, atBats: 0, games: 0 };
    let last10 = { hits: 0, atBats: 0, games: 0 };

    splits.slice(0, 10).forEach((game, i) => {
      const stat = game.stat || {};
      const hits = stat.hits || 0;
      const atBats = stat.atBats || 0;

      if (i < 5) {
        last5.hits += hits;
        last5.atBats += atBats;
        last5.games++;
      }
      last10.hits += hits;
      last10.atBats += atBats;
      last10.games++;
    });

    // Calculate averages
    const avgLast5 = last5.atBats > 0 ? (last5.hits / last5.atBats).toFixed(3) : null;
    const avgLast10 = last10.atBats > 0 ? (last10.hits / last10.atBats).toFixed(3) : null;

    // Determine if hot or cold
    let trend = null;
    if (avgLast5 && avgLast10) {
      const diff = parseFloat(avgLast5) - parseFloat(avgLast10);
      if (diff >= 0.050) trend = "heating up";
      else if (diff <= -0.050) trend = "cooling off";
    }

    const result = {
      hitsLast5: last5.hits,
      hitsLast10: last10.hits,
      avgLast5,
      avgLast10,
      gamesPlayed: last10.games,
      trend,
      isHot: avgLast5 && parseFloat(avgLast5) >= 0.300,
      isCold: avgLast5 && parseFloat(avgLast5) < 0.200,
    };

    mlbStatsCache.playerStats[cacheKey] = { data: result, timestamp: Date.now() };
    return result;
  } catch (err) {
    console.warn(`[MLBStats] Failed to fetch batter stats for ${playerId}:`, err.message);
    return null;
  }
}

// Fetch pitcher season stats
async function fetchPitcherStats(pitcherId) {
  const cacheKey = `pitcher_${pitcherId}`;
  const cached = mlbStatsCache.pitcherStats[cacheKey];
  if (cached && Date.now() - cached.timestamp < PLAYER_STATS_TTL) {
    return cached.data;
  }

  try {
    const season = new Date().getFullYear();
    const url = `${MLB_STATS_BASE}/people/${pitcherId}/stats?stats=season&group=pitching&season=${season}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;

    const data = await res.json();
    const stat = data.stats?.[0]?.splits?.[0]?.stat;

    if (!stat) return null;

    const era = parseFloat(stat.era) || null;
    const whip = parseFloat(stat.whip) || null;
    const k9 = parseFloat(stat.strikeoutsPer9Inn) || null;
    const ip = parseFloat(stat.inningsPitched) || 0;

    // Determine pitcher quality tier
    let quality = "unknown";
    if (era !== null && ip >= 10) {
      if (era <= 3.00) quality = "elite";
      else if (era <= 3.75) quality = "good";
      else if (era <= 4.50) quality = "average";
      else if (era <= 5.50) quality = "below average";
      else quality = "struggling";
    }

    const result = {
      era,
      whip,
      k9,
      inningsPitched: ip,
      quality,
      isElite: quality === "elite" || quality === "good",
      isStruggling: quality === "struggling" || quality === "below average",
    };

    mlbStatsCache.pitcherStats[cacheKey] = { data: result, timestamp: Date.now() };
    return result;
  } catch (err) {
    console.warn(`[MLBStats] Failed to fetch pitcher stats for ${pitcherId}:`, err.message);
    return null;
  }
}

// Normalize player name for matching (handles Jr., III, etc.)
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

// Match player name to lineup data
function findPlayerInLineup(playerName, lineupData) {
  if (!lineupData || !playerName) return null;

  const normalizedSearch = normalizeName(playerName);

  for (const side of ["away", "home"]) {
    const teamLineup = lineupData[side];
    if (!teamLineup?.batters) continue;

    for (const batter of teamLineup.batters) {
      if (normalizeName(batter.name) === normalizedSearch) {
        // Found the player - determine opposing pitcher
        const opposingSide = side === "away" ? "home" : "away";
        const opposingPitcher = lineupData[opposingSide]?.pitcher;

        return {
          battingOrder: batter.battingOrder,
          position: batter.position,
          batSide: batter.batSide,
          opposingPitcher: opposingPitcher?.name || null,
          pitcherHand: opposingPitcher?.pitchHand || null,
          matchup: formatHandednessMatchup(batter.batSide, opposingPitcher?.pitchHand),
        };
      }
    }
  }

  return null;
}

function formatHandednessMatchup(batSide, pitchHand) {
  if (!batSide || !pitchHand) return null;

  const batLabel = batSide === "L" ? "LHB" : batSide === "R" ? "RHB" : "Switch";
  const pitchLabel = pitchHand === "L" ? "LHP" : "RHP";

  // Add advantage indicator
  let advantage = "";
  if (batSide === "L" && pitchHand === "R") advantage = " (advantage)";
  else if (batSide === "R" && pitchHand === "L") advantage = " (advantage)";
  else if (batSide === "S") advantage = " (switch-hitter)";

  return `${batLabel} vs ${pitchLabel}${advantage}`;
}

// Find game for a player based on team matchup string (e.g., "NYY @ BOS")
function findGameForMatchup(games, matchup) {
  if (!matchup || !games) return null;

  const parts = matchup.split(" @ ");
  if (parts.length !== 2) return null;

  const [awayAbbrev, homeAbbrev] = parts;

  return games.find((g) =>
    g.awayAbbrev === awayAbbrev && g.homeAbbrev === homeAbbrev
  );
}

// Main enrichment function - adds MLB context to props
export async function enrichMLBProps(props) {
  if (!props || props.length === 0) return props;

  console.log(`[MLBStats] Enriching ${props.length} MLB props with context...`);

  // Fetch today's games (cached)
  const games = await fetchTodaysGames();

  if (games.length === 0) {
    console.warn("[MLBStats] No games found, returning props without enrichment");
    return props;
  }

  // Group props by matchup to batch lineup fetches
  const matchupGroups = {};
  for (const prop of props) {
    const matchup = prop.matchup;
    if (matchup) {
      if (!matchupGroups[matchup]) {
        matchupGroups[matchup] = { game: findGameForMatchup(games, matchup), props: [] };
      }
      matchupGroups[matchup].props.push(prop);
    }
  }

  // Fetch lineups for games we have props for
  const matchups = Object.keys(matchupGroups);
  console.log(`[MLBStats] Fetching lineups for ${matchups.length} games...`);

  for (const matchup of matchups) {
    const group = matchupGroups[matchup];
    if (group.game?.gamePk) {
      const lineup = await fetchGameLineup(group.game.gamePk);
      group.lineup = lineup;
    }
  }

  // Collect player IDs and pitcher IDs for batch stat fetching
  const playerIdMap = {}; // playerName -> playerId
  const pitcherIds = new Set();

  for (const matchup of matchups) {
    const group = matchupGroups[matchup];
    if (!group.lineup) continue;

    // Map batter names to IDs
    for (const side of ["away", "home"]) {
      const batters = group.lineup[side]?.batters || [];
      for (const batter of batters) {
        playerIdMap[normalizeName(batter.name)] = batter.id;
      }
    }

    // Collect pitcher IDs
    if (group.game?.awayPitcher?.id) pitcherIds.add(group.game.awayPitcher.id);
    if (group.game?.homePitcher?.id) pitcherIds.add(group.game.homePitcher.id);
  }

  // Batch fetch pitcher stats (limit to 10 concurrent)
  console.log(`[MLBStats] Fetching stats for ${pitcherIds.size} pitchers...`);
  const pitcherStatsMap = {};
  const pitcherIdArray = Array.from(pitcherIds).slice(0, 10);

  await Promise.all(pitcherIdArray.map(async (id) => {
    const stats = await fetchPitcherStats(id);
    if (stats) pitcherStatsMap[id] = stats;
  }));

  // Enrich each prop with context and stats
  let enrichedCount = 0;
  let statsCount = 0;

  const enrichedProps = await Promise.all(props.map(async (prop) => {
    const matchup = prop.matchup;
    const group = matchupGroups[matchup];

    if (!group?.game) return prop;

    // Get probable pitcher for the player's opponent
    const awayTeam = matchup.split(" @ ")[0];
    const isAwayBatter = prop.awayTeam === awayTeam;
    const opposingPitcher = isAwayBatter ? group.game.homePitcher : group.game.awayPitcher;

    // Try to find player in lineup for detailed context
    const lineupContext = group.lineup
      ? findPlayerInLineup(prop.playerName, group.lineup)
      : null;

    // Build enrichment object
    const enrichment = {};

    // Opposing pitcher from schedule
    if (opposingPitcher?.name) {
      enrichment.opposingPitcher = opposingPitcher.name;
      enrichment.pitcherHand = opposingPitcher.hand;

      // Add pitcher stats
      const pitcherStats = pitcherStatsMap[opposingPitcher.id];
      if (pitcherStats) {
        enrichment.pitcherERA = pitcherStats.era;
        enrichment.pitcherWHIP = pitcherStats.whip;
        enrichment.pitcherK9 = pitcherStats.k9;
        enrichment.pitcherQuality = pitcherStats.quality;
        enrichment.isPitcherElite = pitcherStats.isElite;
        enrichment.isPitcherStruggling = pitcherStats.isStruggling;
      }
    }

    // Lineup context (only if lineup posted)
    if (lineupContext) {
      if (lineupContext.battingOrder) enrichment.lineupSpot = lineupContext.battingOrder;
      if (lineupContext.batSide) enrichment.batSide = lineupContext.batSide;
      if (lineupContext.matchup) enrichment.handednessMatchup = lineupContext.matchup;

      // Override pitcher info with lineup data if available
      if (lineupContext.opposingPitcher) {
        enrichment.opposingPitcher = lineupContext.opposingPitcher;
      }
      if (lineupContext.pitcherHand) {
        enrichment.pitcherHand = lineupContext.pitcherHand;
      }

      // Fetch batter recent stats
      const batterId = playerIdMap[normalizeName(prop.playerName)];
      if (batterId) {
        const batterStats = await fetchBatterStats(batterId);
        if (batterStats) {
          enrichment.hitsLast5 = batterStats.hitsLast5;
          enrichment.hitsLast10 = batterStats.hitsLast10;
          enrichment.avgLast5 = batterStats.avgLast5;
          enrichment.avgLast10 = batterStats.avgLast10;
          enrichment.batterTrend = batterStats.trend;
          enrichment.isBatterHot = batterStats.isHot;
          enrichment.isBatterCold = batterStats.isCold;
          statsCount++;
        }
      }
    }

    if (Object.keys(enrichment).length > 0) {
      enrichedCount++;
    }

    return { ...prop, ...enrichment };
  }));

  console.log(`[MLBStats] Enriched ${enrichedCount}/${props.length} props (${statsCount} with recent stats)`);
  return enrichedProps;
}

// Export for testing
export { fetchTodaysGames, fetchGameLineup, findPlayerInLineup, normalizeName };
