// NHL Stats API - Free, no auth required
// Provides player game logs for Last 10 calculation

const NHL_SEARCH_API = "https://search.d3.nhle.com/api/v1/search/player";
const NHL_GAMELOG_API = "https://api-web.nhle.com/v1/player";

// Cache for NHL player IDs and stats
const nhlStatsCache = {
  playerIds: {}, // name -> { id, timestamp }
  playerStats: {}, // playerId -> { data, timestamp }
};
const PLAYER_ID_TTL = 24 * 60 * 60 * 1000; // 24 hours for player ID lookup
const PLAYER_STATS_TTL = 4 * 60 * 60 * 1000; // 4 hours for player stats

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

// Search for NHL player ID by name
async function findNHLPlayerId(playerName) {
  const normalizedName = normalizeName(playerName);
  const cacheKey = normalizedName;

  // Check cache
  const cached = nhlStatsCache.playerIds[cacheKey];
  if (cached && Date.now() - cached.timestamp < PLAYER_ID_TTL) {
    return cached.id;
  }

  try {
    const url = `${NHL_SEARCH_API}?culture=en-us&limit=5&q=${encodeURIComponent(playerName)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) {
      console.warn(`[NHLStats] Player search returned ${res.status} for ${playerName}`);
      return null;
    }

    const results = await res.json();
    if (!results || results.length === 0) {
      console.warn(`[NHLStats] No player found for: ${playerName}`);
      return null;
    }

    // Find best match (first result is usually best)
    const player = results[0];
    const playerId = player.playerId;

    if (playerId) {
      nhlStatsCache.playerIds[cacheKey] = { id: playerId, timestamp: Date.now() };
      console.log(`[NHLStats] Found player ID ${playerId} for ${playerName}`);
    }

    return playerId || null;
  } catch (err) {
    console.warn(`[NHLStats] Player search failed for ${playerName}:`, err.message);
    return null;
  }
}

// Fetch player game log (last 10 games)
async function fetchNHLPlayerStats(playerId) {
  const cacheKey = `nhl_${playerId}`;
  const cached = nhlStatsCache.playerStats[cacheKey];
  if (cached && Date.now() - cached.timestamp < PLAYER_STATS_TTL) {
    return cached.data;
  }

  try {
    // Get current season (e.g., 20242025)
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    // NHL season starts in October, so if before October use previous season
    const seasonStart = month >= 10 ? year : year - 1;
    const season = `${seasonStart}${seasonStart + 1}`;

    const url = `${NHL_GAMELOG_API}/${playerId}/game-log/${season}/2`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) {
      console.warn(`[NHLStats] Game log API returned ${res.status} for player ${playerId}`);
      return null;
    }

    const data = await res.json();
    const gameLog = data.gameLog || [];

    if (gameLog.length === 0) {
      return null;
    }

    // Take first 10 games (most recent first)
    const last10Games = gameLog.slice(0, 10).map((game) => ({
      date: game.gameDate,
      goals: game.goals || 0,
      assists: game.assists || 0,
      points: game.points || 0,
      shots: game.shots || 0,
    }));

    // Calculate totals for trend analysis
    const last5 = last10Games.slice(0, 5);
    const goalsLast5 = last5.reduce((sum, g) => sum + g.goals, 0);
    const goalsLast10 = last10Games.reduce((sum, g) => sum + g.goals, 0);
    const pointsLast5 = last5.reduce((sum, g) => sum + g.points, 0);
    const pointsLast10 = last10Games.reduce((sum, g) => sum + g.points, 0);

    // Determine trend
    const avgGoalsLast5 = goalsLast5 / Math.min(5, last5.length);
    const avgGoalsLast10 = goalsLast10 / last10Games.length;
    let trend = null;
    if (avgGoalsLast5 > avgGoalsLast10 * 1.2) trend = "heating up";
    else if (avgGoalsLast5 < avgGoalsLast10 * 0.8) trend = "cooling off";

    const result = {
      goalsLast5,
      goalsLast10,
      pointsLast5,
      pointsLast10,
      gamesPlayed: last10Games.length,
      trend,
      isHot: avgGoalsLast5 >= 0.8, // 0.8+ goals per game is hot
      isCold: avgGoalsLast5 < 0.3,
      last10Games, // Raw game data for hit/miss calculation
    };

    nhlStatsCache.playerStats[cacheKey] = { data: result, timestamp: Date.now() };
    return result;
  } catch (err) {
    console.warn(`[NHLStats] Failed to fetch game log for player ${playerId}:`, err.message);
    return null;
  }
}

// Main enrichment function - adds Last 10 data to NHL props
// Uses batched parallel fetching (same pattern as NBA enrichment)
const NHL_BATCH_SIZE = 8;

export async function enrichNHLProps(props) {
  if (!props || props.length === 0) return props;

  console.log(`[NHLStats] Enriching ${props.length} NHL props with Last 10 data...`);

  // Dedupe players — many props share the same player (goals, assists, points, shots)
  const uniquePlayers = [...new Set(props.map((p) => p.playerName).filter(Boolean))];
  console.log(`[NHLStats] ${uniquePlayers.length} unique players to look up`);

  // Batch-fetch player IDs in parallel
  const playerIdMap = {}; // playerName -> playerId
  for (let i = 0; i < uniquePlayers.length; i += NHL_BATCH_SIZE) {
    const batch = uniquePlayers.slice(i, i + NHL_BATCH_SIZE);
    const results = await Promise.all(batch.map((name) => findNHLPlayerId(name)));
    batch.forEach((name, idx) => {
      if (results[idx]) playerIdMap[name] = results[idx];
    });
  }

  // Batch-fetch player stats in parallel (only for players with IDs)
  const uniqueIds = [...new Set(Object.values(playerIdMap))];
  const statsMap = {}; // playerId -> stats
  for (let i = 0; i < uniqueIds.length; i += NHL_BATCH_SIZE) {
    const batch = uniqueIds.slice(i, i + NHL_BATCH_SIZE);
    const results = await Promise.all(batch.map((id) => fetchNHLPlayerStats(id)));
    batch.forEach((id, idx) => {
      if (results[idx]) statsMap[id] = results[idx];
    });
  }

  // Apply enrichment to all props using the lookup maps
  let enrichedCount = 0;
  const enrichedProps = props.map((prop) => {
    const playerId = playerIdMap[prop.playerName];
    if (!playerId) return prop;

    const stats = statsMap[playerId];
    if (!stats || !stats.last10Games || stats.last10Games.length === 0) return prop;

    enrichedCount++;
    return {
      ...prop,
      last10Games: stats.last10Games,
      goalsLast10: stats.goalsLast10,
      pointsLast10: stats.pointsLast10,
      nhlTrend: stats.trend,
      isHot: stats.isHot,
      isCold: stats.isCold,
    };
  });

  console.log(`[NHLStats] Enriched ${enrichedCount}/${props.length} NHL props with Last 10 data (${uniquePlayers.length} players, ${uniqueIds.length} fetched)`);
  return enrichedProps;
}

// Export for testing
export { findNHLPlayerId, fetchNHLPlayerStats, normalizeName };
