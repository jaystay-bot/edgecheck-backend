// Shared analysis cache - stores pre-generated game analyses
// This is an in-memory cache that persists across requests in serverless

const analysisCache = new Map();
let lastBatchTimestamp = 0;

// Cache TTL - analyses are valid until next batch refresh
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours max

// User refresh rate limit - 1 per hour per user
const userRefreshMap = new Map();
const USER_REFRESH_LIMIT = 60 * 60 * 1000; // 1 hour

export function getAnalysis(gameId) {
  const cached = analysisCache.get(gameId);
  if (!cached) return null;

  // Check if still valid
  if (Date.now() - cached.analyzedAt > CACHE_TTL) {
    analysisCache.delete(gameId);
    return null;
  }

  return cached;
}

export function setAnalysis(gameId, analysis, betAnalyses) {
  analysisCache.set(gameId, {
    gameId,
    analysis,
    betAnalyses, // { spread_home, spread_away, ml_home, ml_away, over, under }
    analyzedAt: Date.now(),
  });
}

export function getAllAnalyses() {
  const result = {};
  for (const [gameId, data] of analysisCache) {
    if (Date.now() - data.analyzedAt <= CACHE_TTL) {
      result[gameId] = data;
    }
  }
  return result;
}

export function clearAllAnalyses() {
  analysisCache.clear();
  lastBatchTimestamp = 0;
}

export function getLastBatchTimestamp() {
  return lastBatchTimestamp;
}

export function setLastBatchTimestamp(ts) {
  lastBatchTimestamp = ts;
}

export function getCacheStats() {
  return {
    totalGames: analysisCache.size,
    lastBatch: lastBatchTimestamp,
    lastBatchAge: lastBatchTimestamp ? Math.round((Date.now() - lastBatchTimestamp) / 60000) : null,
  };
}

// User refresh rate limiting
export function canUserRefresh(userId) {
  const lastRefresh = userRefreshMap.get(userId);
  if (!lastRefresh) return true;
  return Date.now() - lastRefresh >= USER_REFRESH_LIMIT;
}

export function recordUserRefresh(userId) {
  userRefreshMap.set(userId, Date.now());
}

export function getNextRefreshTime(userId) {
  const lastRefresh = userRefreshMap.get(userId);
  if (!lastRefresh) return 0;
  const nextAllowed = lastRefresh + USER_REFRESH_LIMIT;
  return Math.max(0, nextAllowed - Date.now());
}

// Clean up old user refresh entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [userId, timestamp] of userRefreshMap) {
    if (now - timestamp > USER_REFRESH_LIMIT * 2) {
      userRefreshMap.delete(userId);
    }
  }
}, USER_REFRESH_LIMIT);
