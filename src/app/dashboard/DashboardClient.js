"use client";

import { useState, useEffect, useCallback } from "react";
import { UserButton } from "@clerk/nextjs";
import "../globals.css";

// Lucide icons as simple SVG components
const FlameIcon = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </svg>
);

const TrendingUpIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);

const AlertTriangleIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

const TargetIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

const UserIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const LockIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const EyeIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const ClockIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const ChartIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const CrownIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
    <path d="M5 21h14" />
  </svg>
);

const RefreshIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </svg>
);

const InfoIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);

function getHeaterScoreColor(score) {
  if (score >= 8) return "var(--green)";
  if (score >= 6) return "var(--yellow)";
  if (score >= 4) return "var(--orange, #f97316)";
  return "var(--text-dim)";
}

// localStorage caching utilities
const CACHE_KEYS = {
  HEATERS: "edgecheck_heaters_cache",
  BEST_PLAY: "edgecheck_bestplay_cache",
  ANALYSES: "edgecheck_analyses_cache",
};
const CACHE_TTL = {
  HEATERS: 30 * 60 * 1000, // 30 minutes
  BEST_PLAY: 60 * 60 * 1000, // 1 hour
  ANALYSES: 4 * 60 * 60 * 1000, // 4 hours (until next batch)
};

// Get cached analysis for a specific game/bet combo
function getCachedAnalysis(gameId, betKey) {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(CACHE_KEYS.ANALYSES);
    if (!cached) return null;
    const data = JSON.parse(cached);
    const key = `${gameId}_${betKey}`;
    const entry = data[key];
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL.ANALYSES) {
      // Expired - clean up
      delete data[key];
      localStorage.setItem(CACHE_KEYS.ANALYSES, JSON.stringify(data));
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

// Store analysis in localStorage
function setCachedAnalysis(gameId, betKey, analysis) {
  if (typeof window === "undefined") return;
  try {
    let data = {};
    const cached = localStorage.getItem(CACHE_KEYS.ANALYSES);
    if (cached) {
      data = JSON.parse(cached);
    }
    const key = `${gameId}_${betKey}`;
    data[key] = {
      analysis,
      timestamp: Date.now(),
    };
    // Clean old entries (keep last 50)
    const entries = Object.entries(data);
    if (entries.length > 50) {
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      data = Object.fromEntries(entries.slice(0, 50));
    }
    localStorage.setItem(CACHE_KEYS.ANALYSES, JSON.stringify(data));
  } catch {
    // localStorage full
  }
}

function getCachedData(key) {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    const ttl = key === CACHE_KEYS.HEATERS ? CACHE_TTL.HEATERS : CACHE_TTL.BEST_PLAY;
    if (Date.now() - timestamp > ttl) {
      localStorage.removeItem(key);
      return null;
    }
    return { data, timestamp };
  } catch {
    return null;
  }
}

function setCachedData(key, data) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // localStorage full or unavailable
  }
}

function clearCache(key) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function formatLastUpdated(timestamp) {
  if (!timestamp) return "";
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "1 hour ago";
  return `${hours} hours ago`;
}

function formatCountdown(isoTime) {
  const gameTime = new Date(isoTime);
  const now = new Date();
  const diff = gameTime - now;

  if (diff <= 0) return "Started";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Explain American odds in plain English
function explainOdds(odds) {
  if (odds === null || odds === undefined) return null;
  if (odds > 0) {
    return `+${odds} means $100 wins $${odds}`;
  } else {
    return `${odds} means bet $${Math.abs(odds)} to win $100`;
  }
}

// Format game time for display
function formatGameTime(gameTime, commenceTime) {
  // If we have gameTime from API (e.g., "Fri 07:00pm"), use it
  if (gameTime) return gameTime;

  // Otherwise format from commenceTime
  if (!commenceTime) return null;

  const date = new Date(commenceTime);
  const now = new Date();

  // If game already started
  if (date <= now) return "Live";

  // Format as "Today 7:05 PM" or "Fri 7:05 PM"
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  if (isToday) return `Today ${time}`;

  const day = date.toLocaleDateString("en-US", { weekday: "short" });
  return `${day} ${time}`;
}

// Get tier badge color
function getTierColor(tier) {
  switch (tier) {
    case "Top Pick": return { bg: "rgba(34,197,94,0.15)", text: "var(--green)" };
    case "Strong": return { bg: "var(--yellow)", text: "#000" };
    case "Value": return { bg: "var(--orange)", text: "#fff" };
    default: return { bg: "var(--surface2)", text: "var(--text-dim)" };
  }
}

const SPORTS = [
  { key: "nba", label: "NBA", espn: "basketball/nba" },
  { key: "nfl", label: "NFL", espn: "football/nfl" },
  { key: "mlb", label: "MLB", espn: "baseball/mlb" },
  { key: "nhl", label: "NHL", espn: "hockey/nhl" },
  { key: "ncaaf", label: "NCAAF", espn: "football/college-football" },
  { key: "ncaab", label: "NCAAB", espn: "basketball/mens-college-basketball" },
  { key: "mls", label: "MLS", espn: "soccer/usa.1" },
];

function getBetOptions(game) {
  const opts = [];
  const home = game.homeTeam?.abbreviation ?? "HOME";
  const away = game.awayTeam?.abbreviation ?? "AWAY";
  const odds = game.odds;

  if (odds?.spread?.home != null) {
    const hs = odds.spread.home > 0 ? `+${odds.spread.home}` : `${odds.spread.home}`;
    const as = odds.spread.away != null
      ? (odds.spread.away > 0 ? `+${odds.spread.away}` : `${odds.spread.away}`)
      : (odds.spread.home > 0 ? `-${odds.spread.home}` : `+${Math.abs(odds.spread.home)}`);
    opts.push({ value: `spread_home`, label: `${home} Spread ${hs}` });
    opts.push({ value: `spread_away`, label: `${away} Spread ${as}` });
  }

  // Include ML options independently (don't require both)
  if (odds?.moneyline?.home != null) {
    const hml = odds.moneyline.home > 0 ? `+${odds.moneyline.home}` : `${odds.moneyline.home}`;
    opts.push({ value: `ml_home`, label: `${home} ML ${hml}` });
  }
  if (odds?.moneyline?.away != null) {
    const aml = odds.moneyline.away > 0 ? `+${odds.moneyline.away}` : `${odds.moneyline.away}`;
    opts.push({ value: `ml_away`, label: `${away} ML ${aml}` });
  }

  if (odds?.overUnder != null) {
    opts.push({ value: `over`, label: `Over ${odds.overUnder}` });
    opts.push({ value: `under`, label: `Under ${odds.overUnder}` });
  }

  if (opts.length === 0) {
    opts.push({ value: "spread_home", label: "Spread" });
  }

  return opts;
}

function formatDateParam(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function parseOdds(competition) {
  const odds = competition.odds?.[0];
  if (!odds) return null;
  return {
    spread: {
      home: odds.homeTeamOdds?.spread ?? odds.spread ?? null,
      away: odds.awayTeamOdds?.spread ?? (odds.spread ? -odds.spread : null),
      homeOdds: odds.homeTeamOdds?.spreadOdds ?? null,
      awayOdds: odds.awayTeamOdds?.spreadOdds ?? null,
    },
    moneyline: {
      home: odds.homeTeamOdds?.moneyLine ?? null,
      away: odds.awayTeamOdds?.moneyLine ?? null,
    },
    overUnder: odds.overUnder ?? null,
    overOdds: odds.overOdds ?? null,
    underOdds: odds.underOdds ?? null,
    provider: odds.provider?.name ?? "ESPN",
  };
}

// Normalize enriched odds from /api/games (ESPN pickcenter) to client format
function normalizeEnrichedOdds(enrichedOdds) {
  if (!enrichedOdds) return null;
  const spreadLine = enrichedOdds.spread?.line;
  return {
    spread: {
      home: spreadLine ?? null,
      away: spreadLine != null ? -spreadLine : null,
      homeOdds: enrichedOdds.spread?.homeOdds ?? -110,
      awayOdds: enrichedOdds.spread?.awayOdds ?? -110,
    },
    moneyline: {
      home: enrichedOdds.moneyline?.home ?? null,
      away: enrichedOdds.moneyline?.away ?? null,
    },
    overUnder: enrichedOdds.total?.line ?? null,
    overOdds: enrichedOdds.total?.overOdds ?? -110,
    underOdds: enrichedOdds.total?.underOdds ?? -110,
    provider: enrichedOdds.provider ?? "ESPN",
  };
}

function parseGame(event, sportKey) {
  const competition = event.competitions?.[0];
  if (!competition) return null;
  const homeTeamData = competition.competitors?.find((c) => c.homeAway === "home");
  const awayTeamData = competition.competitors?.find((c) => c.homeAway === "away");
  if (!homeTeamData || !awayTeamData) return null;
  const homeTeam = homeTeamData.team;
  const awayTeam = awayTeamData.team;

  // Use enriched odds from /api/games if available, otherwise parse from competition
  const odds = event.odds
    ? normalizeEnrichedOdds(event.odds)
    : parseOdds(competition);

  return {
    id: event.id,
    sport: sportKey,
    status: event.status?.type?.description ?? "Scheduled",
    statusDetail: event.status?.type?.detail ?? "",
    shortDetail: event.status?.type?.shortDetail ?? "",
    state: event.status?.type?.state ?? "pre",
    startTime: event.date,
    venue: competition.venue?.fullName ?? "",
    broadcast: competition.broadcasts?.[0]?.names?.[0] ?? "",
    homeTeam: {
      id: homeTeam.id,
      name: homeTeam.displayName ?? homeTeam.name,
      abbreviation: homeTeam.abbreviation,
      logo: homeTeam.logo,
      score: homeTeamData.score ?? "0",
      record: homeTeamData.records?.[0]?.summary ?? "",
    },
    awayTeam: {
      id: awayTeam.id,
      name: awayTeam.displayName ?? awayTeam.name,
      abbreviation: awayTeam.abbreviation,
      logo: awayTeam.logo,
      score: awayTeamData.score ?? "0",
      record: awayTeamData.records?.[0]?.summary ?? "",
    },
    odds,
  };
}

function normalizeTeamName(name) {
  return (name ?? "").toLowerCase().replace(/[^a-z]/g, "");
}

function teamsMatch(espnName, oddsName) {
  const a = normalizeTeamName(espnName);
  const b = normalizeTeamName(oddsName);
  if (a === b) return true;
  if (a.length > 3 && b.length > 3) {
    if (a.includes(b) || b.includes(a)) return true;
  }
  const aWords = a.match(/[a-z]+/g) ?? [];
  const bWords = b.match(/[a-z]+/g) ?? [];
  const aLast = aWords[aWords.length - 1];
  const bLast = bWords[bWords.length - 1];
  if (aLast && bLast && aLast === bLast && aLast.length > 3) return true;
  return false;
}

async function fetchOddsAPI(sportKey) {
  try {
    const res = await fetch(`/api/odds?sport=${sportKey}`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.games ?? [];
  } catch (err) {
    console.warn("Odds API fetch failed:", err.message);
    return [];
  }
}

function mergeOddsData(games, oddsGames) {
  console.log(`[Merge Debug] ESPN games: ${games.length}, Odds games: ${oddsGames.length}`);
  if (!oddsGames.length) return games;

  return games.map((game) => {
    const match = oddsGames.find(
      (og) =>
        (teamsMatch(game.homeTeam.name, og.homeTeam) &&
         teamsMatch(game.awayTeam.name, og.awayTeam)) ||
        (teamsMatch(game.homeTeam.name, og.awayTeam) &&
         teamsMatch(game.awayTeam.name, og.homeTeam))
    );

    if (!match) {
      console.log(`[Merge Debug] No match for: ${game.homeTeam.name} vs ${game.awayTeam.name}`);
      return game;
    }

    console.log(`[Merge Debug] Matched: ${game.homeTeam.name} vs ${game.awayTeam.name} -> ML: ${match.moneyline?.home}/${match.moneyline?.away}`);

    const flipped = teamsMatch(game.homeTeam.name, match.awayTeam);

    const existing = game.odds ?? {};
    const merged = { ...existing };

    // Always use Odds API moneyline - it's the authoritative source for betting lines
    const homeML = flipped ? match.moneyline?.away : match.moneyline?.home;
    const awayML = flipped ? match.moneyline?.home : match.moneyline?.away;
    if (homeML != null && awayML != null) {
      merged.moneyline = { home: homeML, away: awayML };
      merged.mlProvider = match.bookmaker;
    }

    if (existing.spread?.home == null) {
      const homeSpread = flipped ? match.spread.away : match.spread.home;
      const awaySpread = flipped ? match.spread.home : match.spread.away;
      const homeOdds = flipped ? match.spread.awayOdds : match.spread.homeOdds;
      const awayOdds = flipped ? match.spread.homeOdds : match.spread.awayOdds;
      if (homeSpread != null) {
        merged.spread = { home: homeSpread, away: awaySpread, homeOdds, awayOdds };
      }
    }

    if (existing.overUnder == null && match.total.overUnder != null) {
      merged.overUnder = match.total.overUnder;
      merged.overOdds = match.total.overOdds;
      merged.underOdds = match.total.underOdds;
    }

    return { ...game, odds: merged };
  });
}

async function fetchESPNGames(sportConfig) {
  const today = formatDateParam(new Date());

  // For NBA and NHL, use our /api/games which includes enriched pickcenter odds
  if (sportConfig.key === "nba" || sportConfig.key === "nhl") {
    try {
      const res = await fetch(`/api/games?sport=${sportConfig.key}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const events = data.events ?? [];
        if (events.length > 0) {
          return {
            games: events.map((e) => parseGame(e, sportConfig.key)).filter(Boolean),
            date: today,
            league: data.leagues?.[0]?.name ?? sportConfig.label,
          };
        }
      }
    } catch (err) {
      console.warn(`/api/games fetch failed for ${sportConfig.key}:`, err.message);
    }
  }

  // Fallback to direct ESPN fetch for other sports or if /api/games fails
  const baseUrl = "https://site.api.espn.com/apis/site/v2/sports";
  const urls = [
    `${baseUrl}/${sportConfig.espn}/scoreboard?dates=${today}`,
    `${baseUrl}/${sportConfig.espn}/scoreboard`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      const events = data.events ?? [];
      if (events.length > 0) {
        return {
          games: events.map((e) => parseGame(e, sportConfig.key)).filter(Boolean),
          date: today,
          league: data.leagues?.[0]?.name ?? sportConfig.label,
        };
      }
    } catch (err) {
      console.warn(`ESPN fetch failed for ${url}:`, err.message);
    }
  }

  return { games: [], date: today, league: sportConfig.label };
}

export default function DashboardClient({ userEmail }) {
  const [sport, setSport] = useState("nba");
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [leagueInfo, setLeagueInfo] = useState("");
  const [analyzing, setAnalyzing] = useState(null);
  const [analyses, setAnalyses] = useState({});
  const [selectedBets, setSelectedBets] = useState({});
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [heaters, setHeaters] = useState([]);
  const [heatersLoading, setHeatersLoading] = useState(true);
  const [heatersError, setHeatersError] = useState(null);

  // Best Play state
  const [bestPlay, setBestPlay] = useState(null);
  const [bestPlayLoading, setBestPlayLoading] = useState(true);
  const [bestPlayRefreshing, setBestPlayRefreshing] = useState(false);
  const [bestPlayTimestamp, setBestPlayTimestamp] = useState(null);

  // Heaters refresh state
  const [heatersRefreshing, setHeatersRefreshing] = useState(false);
  const [heatersTimestamp, setHeatersTimestamp] = useState(null);

  // Props state
  const [activeView, setActiveView] = useState("games"); // games | props | linewatch
  const [propsCategories, setPropsCategories] = useState([]);
  const [propsLoading, setPropsLoading] = useState(false);
  const [propsSport, setPropsSport] = useState("mlb"); // mlb | nba | nhl
  const [isPaidUser, setIsPaidUser] = useState(false);
  const [propsScored, setPropsScored] = useState(false);

  // Line Watch state
  const [lineWatchGames, setLineWatchGames] = useState([]);
  const [lineWatchLoading, setLineWatchLoading] = useState(false);
  const [lineWatchError, setLineWatchError] = useState(null);
  const [lineWatchValueAlerts, setLineWatchValueAlerts] = useState(0);

  // Expanded prop card state
  const [expandedPropId, setExpandedPropId] = useState(null);

  // Expanded game card state (EdgeCheck breakdown)
  const [expandedGameId, setExpandedGameId] = useState(null);

  // Expanded game props state (inline props per game)
  const [expandedGamePropsId, setExpandedGamePropsId] = useState(null);

  // Betting splits state (DraftKings public betting data)
  const [bettingSplits, setBettingSplits] = useState([]);

  const sportConfig = SPORTS.find((s) => s.key === sport);

  // Check for upgrade success on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") === "true") {
      // Remove the query param
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []);

  // Fetch heaters with localStorage caching
  const fetchHeatersData = useCallback(async (forceRefresh = false) => {
    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = getCachedData(CACHE_KEYS.HEATERS);
      if (cached) {
        setHeaters(cached.data);
        setHeatersTimestamp(cached.timestamp);
        setHeatersLoading(false);
        return;
      }
    }

    if (forceRefresh) {
      setHeatersRefreshing(true);
      clearCache(CACHE_KEYS.HEATERS);
    } else {
      setHeatersLoading(true);
    }
    setHeatersError(null);

    try {
      const res = await fetch("/api/heaters");
      const data = await res.json();

      if (res.status === 402 && data.code === "SUBSCRIPTION_REQUIRED") {
        setHeaters([]);
        setHeatersLoading(false);
        setHeatersRefreshing(false);
        return;
      }

      if (!res.ok) throw new Error(data.error || "Failed to load heaters");

      const heatersList = data.heaters || [];
      setHeaters(heatersList);
      setHeatersTimestamp(Date.now());

      // Cache the data
      if (heatersList.length > 0) {
        setCachedData(CACHE_KEYS.HEATERS, heatersList);
      }
    } catch (err) {
      console.warn("Heaters fetch failed:", err.message);
      setHeatersError(err.message);
      setHeaters([]);
    } finally {
      setHeatersLoading(false);
      setHeatersRefreshing(false);
    }
  }, []);

  // Fetch heaters on mount
  useEffect(() => {
    fetchHeatersData();
  }, [fetchHeatersData]);

  // Fetch Best Play with localStorage caching
  const fetchBestPlay = useCallback(async (forceRefresh = false) => {
    // Check cache first (unless forcing refresh)
    // Skip cache if it has locked:true - always verify subscription status fresh
    if (!forceRefresh) {
      const cached = getCachedData(CACHE_KEYS.BEST_PLAY);
      if (cached && !cached.data.locked) {
        setBestPlay(cached.data);
        setBestPlayTimestamp(cached.timestamp);
        if (cached.data.isPaidUser !== undefined) {
          setIsPaidUser(cached.data.isPaidUser);
        }
        setBestPlayLoading(false);
        return;
      }
    }

    if (forceRefresh) {
      setBestPlayRefreshing(true);
      clearCache(CACHE_KEYS.BEST_PLAY);
    } else {
      setBestPlayLoading(true);
    }

    try {
      const url = forceRefresh ? "/api/best-play?refresh=true" : "/api/best-play";
      const res = await fetch(url);
      const data = await res.json();

      if (res.ok) {
        setBestPlay(data);
        setBestPlayTimestamp(Date.now());
        if (data.isPaidUser !== undefined) {
          setIsPaidUser(data.isPaidUser);
        }
        // Cache the data
        setCachedData(CACHE_KEYS.BEST_PLAY, data);
      } else {
        console.warn("Best Play fetch failed:", data.error);
        setBestPlay(null);
      }
    } catch (err) {
      console.warn("Best Play fetch error:", err.message);
      setBestPlay(null);
    } finally {
      setBestPlayLoading(false);
      setBestPlayRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBestPlay();
  }, [fetchBestPlay]);

  // Fetch props when view changes to props or sport filter changes
  const fetchProps = useCallback(async () => {
    setPropsLoading(true);
    try {
      const res = await fetch(`/api/props?sport=${propsSport}`);
      const data = await res.json();

      if (res.ok) {
        setPropsCategories(data.categories || []);
        setIsPaidUser(data.isPaidUser || false);
        setPropsScored(data.scored || false);
      } else {
        console.warn("Props fetch failed:", data.error);
        setPropsCategories([]);
      }
    } catch (err) {
      console.warn("Props fetch error:", err.message);
      setPropsCategories([]);
    } finally {
      setPropsLoading(false);
    }
  }, [propsSport]);

  useEffect(() => {
    if (activeView === "props") {
      fetchProps();
    }
  }, [activeView, fetchProps]);

  // Fetch Line Watch data
  const fetchLineWatch = useCallback(async () => {
    setLineWatchLoading(true);
    setLineWatchError(null);
    try {
      const res = await fetch("/api/line-watch");
      const data = await res.json();

      if (res.status === 402 && data.code === "SUBSCRIPTION_REQUIRED") {
        setLineWatchError("subscription_required");
        setLineWatchGames([]);
        return;
      }

      if (!res.ok) throw new Error(data.error || "Failed to load Line Watch");
      setLineWatchGames(data.games || []);
      setLineWatchValueAlerts(data.valueAlerts || 0);
    } catch (err) {
      console.warn("Line Watch fetch error:", err.message);
      setLineWatchError(err.message);
      setLineWatchGames([]);
    } finally {
      setLineWatchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeView === "linewatch") {
      fetchLineWatch();
    }
  }, [activeView, fetchLineWatch]);

  const fetchGames = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [result, oddsGames] = await Promise.all([
        fetchESPNGames(sportConfig),
        fetchOddsAPI(sportConfig.key),
      ]);
      const merged = mergeOddsData(result.games, oddsGames);
      setGames(merged);
      setLeagueInfo(result.league);
    } catch (err) {
      console.error("Failed to load games:", err);
      setError(err.message);
      setGames([]);
    } finally {
      setLoading(false);
    }
  }, [sportConfig]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  // Fetch DK betting splits on mount
  useEffect(() => {
    async function fetchSplits() {
      try {
        const res = await fetch("/api/splits");
        if (res.ok) {
          const data = await res.json();
          setBettingSplits(data.splits || []);
        }
      } catch (err) {
        console.warn("[Splits] Failed to load:", err.message);
      }
    }
    fetchSplits();
  }, []);

  // MLB team name → abbreviation mapping for splits matching
  const MLB_TEAM_MAP = {
    "dodgers": "LAD", "la dodgers": "LAD",
    "nationals": "WSH", "was nationals": "WSH",
    "yankees": "NYY", "ny yankees": "NYY",
    "mets": "NYM", "ny mets": "NYM",
    "phillies": "PHI", "phi phillies": "PHI",
    "rockies": "COL", "col rockies": "COL",
    "marlins": "MIA", "mia marlins": "MIA",
    "astros": "HOU", "hou astros": "HOU",
    "athletics": "OAK",
    "giants": "SF", "sf giants": "SF",
    "mariners": "SEA", "sea mariners": "SEA",
    "angels": "LAA", "la angels": "LAA",
    "braves": "ATL", "atl braves": "ATL",
    "diamondbacks": "ARI", "ari diamondbacks": "ARI",
    "cubs": "CHC", "chi cubs": "CHC",
    "guardians": "CLE", "cle guardians": "CLE",
    "cardinals": "STL", "stl cardinals": "STL",
    "tigers": "DET", "det tigers": "DET",
    "red sox": "BOS", "bos red sox": "BOS",
    "rays": "TB", "tb rays": "TB",
    "orioles": "BAL", "bal orioles": "BAL",
    "blue jays": "TOR", "tor blue jays": "TOR",
    "white sox": "CWS", "chi white sox": "CWS",
    "twins": "MIN", "min twins": "MIN",
    "royals": "KC", "kc royals": "KC",
    "rangers": "TEX", "tex rangers": "TEX",
    "padres": "SD", "sd padres": "SD",
    "reds": "CIN", "cin reds": "CIN",
    "brewers": "MIL", "mil brewers": "MIL",
    "pirates": "PIT", "pit pirates": "PIT",
  };

  // Extract abbreviations from split game string
  const extractTeamAbbrevs = (splitGame) => {
    const lower = (splitGame || "").toLowerCase();
    const abbrevs = [];
    for (const [name, abbrev] of Object.entries(MLB_TEAM_MAP)) {
      if (lower.includes(name)) abbrevs.push(abbrev);
    }
    return [...new Set(abbrevs)]; // dedupe
  };

  // Helper to find betting splits for a game
  const getSplitsForGame = (game) => {
    if (!bettingSplits.length || !game) return null;
    const homeAbbrev = game.homeTeam?.abbreviation?.toUpperCase();
    const awayAbbrev = game.awayTeam?.abbreviation?.toUpperCase();

    for (const split of bettingSplits) {
      // Use stored abbreviations directly (awayTeam/homeTeam already normalized)
      const splitHome = split.homeTeam?.toUpperCase();
      const splitAway = split.awayTeam?.toUpperCase();
      if ((splitHome === homeAbbrev && splitAway === awayAbbrev) ||
          (splitHome === awayAbbrev && splitAway === homeAbbrev)) {
        return split;
      }
    }
    return null;
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to start checkout");
        setUpgrading(false);
      }
    } catch (err) {
      alert("Failed to start checkout: " + err.message);
      setUpgrading(false);
    }
  };

  const analyzeBet = async (game) => {
    const options = getBetOptions(game);
    const selected = selectedBets[game.id] || options[0]?.value || "spread_home";
    const selectedOption = options.find((o) => o.value === selected);
    const betType = selectedOption?.label ?? "Spread";
    let betValue = selectedOption?.label ?? "";
    const betKey = selected; // e.g., "spread_home", "ml_away", etc.

    // Check localStorage cache first
    const localCached = getCachedAnalysis(game.id, betKey);
    if (localCached) {
      setAnalyses((prev) => ({
        ...prev,
        [game.id]: {
          ...localCached.analysis,
          analyzedAt: formatLastUpdated(localCached.timestamp),
          cached: true,
          fromLocalCache: true,
        },
      }));
      return;
    }

    setAnalyzing(game.id);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game, betType, betValue }),
      });
      const data = await res.json();

      // Handle subscription required
      if (res.status === 402 && data.code === "SUBSCRIPTION_REQUIRED") {
        setShowUpgradeModal(true);
        setAnalyzing(null);
        return;
      }

      // Handle pending analysis (not yet generated)
      if (data.pending) {
        setAnalyses((prev) => ({
          ...prev,
          [game.id]: {
            pending: true,
            status: data.status || "no_data",
            reason: data.reason || null,
            rateLimited: data.rateLimited || false,
            message: data.message || "No analysis available",
            fullText: "",
          },
        }));
        setAnalyzing(null);
        return;
      }

      if (!res.ok) throw new Error(data.error || "Analysis failed");

      // Cache in localStorage for future use
      if (data.analysis) {
        setCachedAnalysis(game.id, betKey, data.analysis);
      }

      // Store analysis with timestamp
      setAnalyses((prev) => ({
        ...prev,
        [game.id]: {
          ...data.analysis,
          analyzedAt: data.analyzedAtFormatted || "recently",
          cached: data.cached,
        },
      }));
    } catch (err) {
      setAnalyses((prev) => ({
        ...prev,
        [game.id]: {
          error: "Analysis failed — please try again",
          fullText: "",
        },
      }));
    } finally {
      setAnalyzing(null);
    }
  };

  const formatTime = (iso) => {
    try {
      const d = new Date(iso);
      const date = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      return `${date} ${time}`;
    } catch {
      return "";
    }
  };

  const getRecDisplay = (rec) => {
    if (rec === "Lean") return "Slight Edge";
    if (rec === "Avoid") return "No Edge";
    return rec;
  };

  const getRecColor = (rec) => {
    if (!rec) return "var(--text-dim)";
    if (rec === "Strong Bet") return "var(--green)";
    if (rec === "Lean") return "var(--yellow)";
    if (rec === "Avoid") return "var(--orange)";
    if (rec === "Fade") return "var(--red)";
    return "var(--text-dim)";
  };

  const getDecisionSummary = (rec) => {
    if (rec === "Lean") return { text: "Slight edge detected \u2014 not a strong position", color: "var(--text-dim)" };
    if (rec === "Avoid") return { text: "No betting edge \u2014 pass on this", color: "var(--orange)" };
    if (rec === "Strong Bet") return { text: "Strong edge identified \u2014 high-value position", color: "var(--green)" };
    if (rec === "Fade") return { text: "Negative edge \u2014 consider the opposite side", color: "var(--red)" };
    return null;
  };

  const parseFullText = (text) => {
    if (!text) return { sections: [] };
    const sections = [];
    const sectionPatterns = [
      { pattern: /KEY FACTORS:\s*\n([\s\S]*?)(?=\n\s*(?:ANALYSIS|RISK FACTORS|$))/i, label: "Why This Matters" },
      { pattern: /ANALYSIS:\s*\n([\s\S]*?)(?=\n\s*(?:RISK FACTORS|$))/i, label: "Analysis" },
      { pattern: /RISK FACTORS:\s*\n([\s\S]*?)$/i, label: "What Could Go Wrong" },
    ];
    for (const { pattern, label } of sectionPatterns) {
      const match = text.match(pattern);
      if (match?.[1]?.trim()) {
        sections.push({ label, content: match[1].trim() });
      }
    }
    return { sections };
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px" }}>
      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => setShowUpgradeModal(false)}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 16,
              padding: 32,
              maxWidth: 400,
              width: "100%",
              textAlign: "center",
              border: "1px solid var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#128640;</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
              Upgrade to <span style={{ color: "var(--accent)" }}>EdgeCheck Pro</span>
            </h2>
            <p style={{ color: "var(--text-dim)", marginBottom: 24, lineHeight: 1.6 }}>
              Unlock AI-powered bet analysis with edge ratings, confidence scores, and detailed recommendations.
            </p>
            <div
              style={{
                background: "var(--surface2)",
                borderRadius: 12,
                padding: 16,
                marginBottom: 24,
              }}
            >
              <div style={{ fontSize: 36, fontWeight: 700 }}>
                $4.99<span style={{ fontSize: 16, color: "var(--text-dim)" }}>/month</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>
                Cancel anytime
              </div>
            </div>
            <button
              onClick={handleUpgrade}
              disabled={upgrading}
              style={{
                width: "100%",
                padding: "14px 24px",
                background: upgrading ? "var(--border)" : "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 16,
                cursor: upgrading ? "not-allowed" : "pointer",
                marginBottom: 12,
              }}
            >
              {upgrading ? "Redirecting..." : "Upgrade Now"}
            </button>
            <button
              onClick={() => setShowUpgradeModal(false)}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-dim)",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Maybe later
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
            <span style={{ color: "var(--accent)" }}>Edge</span>Check
          </h1>
          <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
            Sports Betting Edge Analyzer
          </p>
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      {/* View Toggle: Games | Props */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 16,
          background: "var(--surface)",
          borderRadius: 10,
          padding: 4,
          width: "fit-content",
        }}
      >
        <button
          onClick={() => setActiveView("games")}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            background: activeView === "games" ? "var(--accent)" : "transparent",
            color: activeView === "games" ? "#fff" : "var(--text-dim)",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 14,
            transition: "all 0.15s",
          }}
        >
          Games
        </button>
        <button
          onClick={() => setActiveView("props")}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            background: activeView === "props" ? "var(--accent)" : "transparent",
            color: activeView === "props" ? "#fff" : "var(--text-dim)",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 14,
            transition: "all 0.15s",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <FlameIcon size={16} color={activeView === "props" ? "#fff" : "var(--text-dim)"} />
          Props
        </button>
        <button
          onClick={() => setActiveView("linewatch")}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            background: activeView === "linewatch" ? "var(--accent)" : "transparent",
            color: activeView === "linewatch" ? "#fff" : "var(--text-dim)",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 14,
            transition: "all 0.15s",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <EyeIcon size={16} color={activeView === "linewatch" ? "#fff" : "var(--text-dim)"} />
          Line Watch
        </button>
      </div>

      {/* Best Play of the Day - Primary Focus (All Views) */}
      <div style={{ marginBottom: 24 }}>
          {/* Loading State */}
          {bestPlayLoading && (
            <div
              style={{
                background: "linear-gradient(135deg, var(--surface) 0%, rgba(251,191,36,0.1) 100%)",
                border: "3px solid var(--yellow)",
                borderRadius: 16,
                padding: 24,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ background: "var(--border)", height: 24, width: 24, borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite" }} />
                <div style={{ background: "var(--border)", height: 20, width: 180, borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite" }} />
              </div>
              <div style={{ background: "var(--border)", height: 24, width: "60%", borderRadius: 4, marginBottom: 12, animation: "pulse 1.5s ease-in-out infinite" }} />
              <div style={{ background: "var(--border)", height: 16, width: "80%", borderRadius: 4, marginBottom: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
              <div style={{ background: "var(--border)", height: 16, width: "70%", borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite" }} />
              <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
            </div>
          )}

          {/* No Best Play Found */}
          {!bestPlayLoading && bestPlay && !bestPlay.found && (
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 16,
                padding: 24,
                textAlign: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12 }}>
                <CrownIcon size={24} color="var(--text-dim)" />
                <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text-dim)" }}>Best Play of the Day</span>
              </div>
              <p style={{ fontSize: 14, color: "var(--text-dim)", margin: 0 }}>
                {bestPlay.reason || "No strong edges found today"}
              </p>
            </div>
          )}

          {/* Best Play Found - Locked for Free Users */}
          {!bestPlayLoading && bestPlay && bestPlay.found && bestPlay.locked && (
            <div
              style={{
                background: "linear-gradient(135deg, var(--surface) 0%, rgba(251,191,36,0.15) 100%)",
                border: "3px solid var(--yellow)",
                borderRadius: 16,
                padding: 24,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <CrownIcon size={24} color="var(--yellow)" />
                  <span style={{ fontSize: 20, fontWeight: 800 }}>Best Play of the Day</span>
                  <span style={{ background: "var(--surface2)", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, color: "var(--text-dim)" }}>
                    {bestPlay.sport}
                  </span>
                </div>
              </div>
              <div
                style={{
                  padding: 20,
                  background: "linear-gradient(135deg, var(--surface2) 0%, rgba(99,102,241,0.15) 100%)",
                  borderRadius: 12,
                  textAlign: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}>
                  <LockIcon size={20} color="var(--accent)" />
                  <span style={{ fontWeight: 700, fontSize: 16, color: "var(--accent)" }}>Best Play Found</span>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "0 0 16px 0" }}>
                  Upgrade to see full analysis, ATS records, and key factors
                </p>
                <button
                  onClick={handleUpgrade}
                  disabled={upgrading}
                  style={{
                    padding: "10px 24px",
                    background: "var(--accent)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: upgrading ? "not-allowed" : "pointer",
                  }}
                >
                  {upgrading ? "..." : "Unlock Best Play"}
                </button>
              </div>
            </div>
          )}

          {/* Best Play Found - Full Card for Paid Users */}
          {!bestPlayLoading && bestPlay && bestPlay.found && bestPlay.play && !bestPlay.locked && (
            <div
              style={{
                background: "linear-gradient(135deg, var(--surface) 0%, rgba(251,191,36,0.15) 100%)",
                border: "3px solid var(--yellow)",
                borderRadius: 16,
                padding: 24,
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <CrownIcon size={24} color="var(--yellow)" />
                  <span style={{ fontSize: 20, fontWeight: 800 }}>Best Play of the Day</span>
                  <span style={{ background: "var(--surface2)", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, color: "var(--text-dim)" }}>
                    {bestPlay.play.sport}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {bestPlayTimestamp && (
                    <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                      Updated {formatLastUpdated(bestPlayTimestamp)}
                    </span>
                  )}
                  <button
                    onClick={() => fetchBestPlay(true)}
                    disabled={bestPlayRefreshing}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      background: "var(--surface2)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      color: "var(--text-dim)",
                      fontSize: 12,
                      cursor: bestPlayRefreshing ? "not-allowed" : "pointer",
                    }}
                  >
                    <RefreshIcon size={14} color="var(--text-dim)" />
                    {bestPlayRefreshing ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
              </div>

              {/* Main Info */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 4 }}>
                  {bestPlay.play.awayTeam} @ {bestPlay.play.homeTeam}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <span style={{ fontSize: 22, fontWeight: 800 }}>{bestPlay.play.teamOrPlayer}</span>
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        background: getHeaterScoreColor(bestPlay.play.heaterScore),
                        padding: "6px 14px 4px",
                        borderRadius: 10,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <FlameIcon size={14} color="#fff" />
                        <span style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
                          {bestPlay.play.heaterScore}/10
                        </span>
                        <div
                          className="heater-info-trigger"
                          style={{
                            marginLeft: 4,
                            cursor: "help",
                            opacity: 0.85,
                          }}
                          title="Heater Score rates the strength of this bet 1-10 based on ATS records, line value, matchup data, and sharp money indicators. 8+ = strong edge."
                        >
                          <InfoIcon size={12} color="#fff" />
                        </div>
                      </div>
                      <span style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.9)", letterSpacing: 1, marginTop: 2 }}>
                        HEATER SCORE
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                  {bestPlay.play.betType}: {bestPlay.play.betValue}
                  <span style={{ marginLeft: 10, color: bestPlay.play.odds > 0 ? "var(--green)" : "var(--text-dim)" }}>
                    {bestPlay.play.odds > 0 ? "+" : ""}{bestPlay.play.odds}
                  </span>
                </div>
              </div>

              {/* Stats Grid - Show prop stats for props, ATS stats for games */}
              {bestPlay.play.type === "prop" ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 12,
                    marginBottom: 16,
                    background: "var(--surface2)",
                    padding: 16,
                    borderRadius: 10,
                  }}
                >
                  {bestPlay.play.last10HitRate && (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>Hit Rate L10</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--green)" }}>{bestPlay.play.last10HitRate}</div>
                    </div>
                  )}
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>Edge</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: bestPlay.play.edge > 0 ? "var(--green)" : "var(--red)" }}>
                      {bestPlay.play.edge > 0 ? "+" : ""}{bestPlay.play.edge}%
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>EV</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: bestPlay.play.ev > 0 ? "var(--green)" : "var(--red)" }}>
                      {bestPlay.play.ev > 0 ? "+" : ""}{bestPlay.play.ev}%
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 12,
                    marginBottom: 16,
                    background: "var(--surface2)",
                    padding: 16,
                    borderRadius: 10,
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>ATS L5</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{bestPlay.play.atsLast5}</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>ATS L10</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{bestPlay.play.atsLast10}</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>Season ATS</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{bestPlay.play.atsSeason}</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>H/A ATS</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{bestPlay.play.homeAwayAts}</div>
                  </div>
                </div>
              )}

              {/* Write-up */}
              {bestPlay.play.writeup && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 6, textTransform: "uppercase" }}>
                    Analysis
                  </div>
                  <p style={{ fontSize: 14, lineHeight: 1.7, margin: 0, color: "var(--text)" }}>
                    {bestPlay.play.writeup}
                  </p>
                </div>
              )}

              {/* Key Factors */}
              {bestPlay.play.keyFactors && bestPlay.play.keyFactors.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 8, textTransform: "uppercase" }}>
                    Key Factors
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {bestPlay.play.keyFactors.map((factor, idx) => (
                      <li key={idx} style={{ fontSize: 13, color: "var(--text)", marginBottom: 4 }}>
                        {factor}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* What Could Go Wrong */}
              {bestPlay.play.whatCouldGoWrong && (
                <div
                  style={{
                    padding: "12px 16px",
                    background: "rgba(239,68,68,0.1)",
                    borderRadius: 8,
                    borderLeft: "3px solid var(--red)",
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <AlertTriangleIcon size={14} color="var(--red)" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--red)" }}>What Could Go Wrong</span>
                  </div>
                  <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0, color: "var(--text-dim)" }}>
                    {bestPlay.play.whatCouldGoWrong}
                  </p>
                </div>
              )}

              {/* Confidence + Cache Info */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Confidence:</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: bestPlay.play.confidence >= 8 ? "var(--green)" : "var(--text)" }}>
                    {bestPlay.play.confidence}/10
                  </span>
                </div>
                {bestPlay.cached && bestPlay.cacheAge > 0 && (
                  <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                    Updated {bestPlay.cacheAge}m ago
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

      {/* Sport Tabs - Games View Only */}
      {activeView === "games" && (
      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 20,
          overflowX: "auto",
          paddingBottom: 4,
        }}
      >
        {SPORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSport(s.key)}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid",
              borderColor: sport === s.key ? "var(--accent)" : "var(--border)",
              background: sport === s.key ? "var(--accent)" : "var(--surface)",
              color: sport === s.key ? "#fff" : "var(--text-dim)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
              whiteSpace: "nowrap",
              transition: "all 0.15s",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
      )}

      {/* Today's Heaters Section - Games View Only */}
      {activeView === "games" && (
      <>
      {/* Today's Heaters Section */}
      {!heatersLoading && heaters.length > 0 && (
        <div
          style={{
            background: "linear-gradient(135deg, var(--surface) 0%, rgba(239,68,68,0.1) 100%)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 24 }}>&#128293;</span>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
                Today&apos;s Heaters
              </h2>
              <span
                style={{
                  background: "var(--red)",
                  color: "#fff",
                  padding: "2px 8px",
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {heaters.length} HOT
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {heatersTimestamp && (
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                  Updated {formatLastUpdated(heatersTimestamp)}
                </span>
              )}
              <button
                onClick={() => fetchHeatersData(true)}
                disabled={heatersRefreshing}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--text-dim)",
                  fontSize: 12,
                  cursor: heatersRefreshing ? "not-allowed" : "pointer",
                }}
              >
                <RefreshIcon size={14} color="var(--text-dim)" />
                {heatersRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          <p style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 16 }}>
            AI-scanned bets with edge scores of 7+ across NBA, MLB, and NHL
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {heaters.map((heater) => (
              <div
                key={heater.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "12px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span
                      style={{
                        background: "var(--surface2)",
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--text-dim)",
                      }}
                    >
                      {heater.sport}
                    </span>
                    <span style={{ fontSize: 13, color: "var(--text-dim)" }}>
                      {heater.awayTeam} @ {heater.homeTeam}
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                    {heater.betType}: {heater.betValue}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                    {heater.reason}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    minWidth: 60,
                  }}
                >
                  <div
                    style={{
                      background:
                        heater.heaterScore >= 9
                          ? "var(--green)"
                          : heater.heaterScore >= 8
                            ? "var(--yellow)"
                            : "var(--orange)",
                      color: "#fff",
                      padding: "6px 12px",
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: 18,
                    }}
                  >
                    {heater.heaterScore}
                  </div>
                  <span style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
                    EDGE
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Heaters Loading Skeleton */}
      {heatersLoading && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 24 }}>&#128293;</span>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
              Today&apos;s Heaters
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  background: "var(--surface2)",
                  borderRadius: 10,
                  padding: "16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      background: "var(--border)",
                      height: 12,
                      width: 80,
                      borderRadius: 4,
                      marginBottom: 8,
                      animation: "pulse 1.5s ease-in-out infinite",
                    }}
                  />
                  <div
                    style={{
                      background: "var(--border)",
                      height: 16,
                      width: 200,
                      borderRadius: 4,
                      animation: "pulse 1.5s ease-in-out infinite",
                    }}
                  />
                </div>
                <div
                  style={{
                    background: "var(--border)",
                    height: 40,
                    width: 50,
                    borderRadius: 8,
                    animation: "pulse 1.5s ease-in-out infinite",
                  }}
                />
              </div>
            ))}
          </div>
          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-dim)" }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: "3px solid var(--border)",
              borderTopColor: "var(--accent)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 12px",
            }}
          />
          Loading {sportConfig?.label} games from ESPN...
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid var(--red)",
            borderRadius: 8,
            padding: 16,
            textAlign: "center",
            color: "var(--red)",
          }}
        >
          Failed to load games: {error}
          <br />
          <button
            onClick={fetchGames}
            style={{
              marginTop: 8,
              padding: "6px 16px",
              background: "var(--red)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* No Games */}
      {!loading && !error && games.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            color: "var(--text-dim)",
            background: "var(--surface)",
            borderRadius: 12,
            border: "1px solid var(--border)",
          }}
        >
          <p style={{ fontSize: 40, marginBottom: 12 }}>&#127944;</p>
          <p style={{ fontSize: 18, marginBottom: 8 }}>
            No {sportConfig?.label} games scheduled today
          </p>
          <p style={{ fontSize: 13, marginBottom: 16 }}>
            This league may be in the off-season, or there are no games on today&apos;s schedule.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {SPORTS.filter((s) => s.key !== sport).map((s) => (
              <button
                key={s.key}
                onClick={() => setSport(s.key)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--surface2)",
                  color: "var(--text-dim)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Try {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Games Count */}
      {!loading && games.length > 0 && (
        <div style={{ marginBottom: 12, fontSize: 13, color: "var(--text-dim)" }}>
          {games.length} game{games.length !== 1 ? "s" : ""} today
          {leagueInfo ? ` — ${leagueInfo}` : ""}
        </div>
      )}

      {/* Games List */}
      {!loading &&
        games.map((game) => (
          <div
            key={game.id}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 20,
              marginBottom: 12,
            }}
          >
            {/* Game Status Bar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
                fontSize: 12,
                color: "var(--text-dim)",
              }}
            >
              <span
                style={{
                  color: game.state === "in" ? "var(--red)" : "var(--text-dim)",
                  fontWeight: game.state === "in" ? 700 : 400,
                }}
              >
                {game.state === "in"
                  ? `LIVE - ${game.shortDetail || game.statusDetail}`
                  : game.state === "post"
                    ? "Final"
                    : formatTime(game.startTime)}
              </span>
              <span>{game.broadcast || game.venue}</span>
            </div>

            {/* Teams */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              {/* Away Team */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {game.awayTeam.logo && (
                    <img
                      src={game.awayTeam.logo}
                      alt=""
                      style={{ width: 36, height: 36 }}
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                  )}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>
                      {game.awayTeam.abbreviation}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                      {game.awayTeam.record}
                    </div>
                  </div>
                </div>
              </div>

              {/* Score or VS */}
              <div
                style={{
                  textAlign: "center",
                  minWidth: 80,
                  fontWeight: 700,
                  fontSize: 20,
                }}
              >
                {game.state === "pre" ? (
                  <span style={{ fontSize: 14, color: "var(--text-dim)" }}>VS</span>
                ) : (
                  <span>
                    {game.awayTeam.score} - {game.homeTeam.score}
                  </span>
                )}
              </div>

              {/* Home Team */}
              <div style={{ flex: 1, textAlign: "right" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    justifyContent: "flex-end",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>
                      {game.homeTeam.abbreviation}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                      {game.homeTeam.record}
                    </div>
                  </div>
                  {game.homeTeam.logo && (
                    <img
                      src={game.homeTeam.logo}
                      alt=""
                      style={{ width: 36, height: 36 }}
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Odds Section */}
            {game.odds && (
              <div
                style={{
                  background: "var(--surface2)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  marginBottom: 12,
                  fontSize: 13,
                }}
              >
                {/* Spread */}
                {game.odds.spread?.home != null && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ color: "var(--text-dim)", fontSize: 10, textTransform: "uppercase", marginBottom: 4 }}>Spread</div>
                    <div style={{ display: "flex", justifyContent: "center", gap: 8, fontWeight: 600 }}>
                      <span>{game.homeTeam.abbreviation} {game.odds.spread.home > 0 ? "+" : ""}{game.odds.spread.home}</span>
                      <span style={{ color: "var(--text-dim)" }}>|</span>
                      <span>{game.awayTeam.abbreviation} {(() => { const v = game.odds.spread.away ?? -game.odds.spread.home; return (v > 0 ? "+" : "") + v; })()}</span>
                    </div>
                  </div>
                )}

                {/* Moneyline */}
                {game.odds.moneyline?.home != null && game.odds.moneyline?.away != null && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ color: "var(--text-dim)", fontSize: 10, textTransform: "uppercase", marginBottom: 4 }}>Moneyline</div>
                    <div style={{ display: "flex", justifyContent: "center", gap: 8, fontWeight: 600 }}>
                      <span>{game.homeTeam.abbreviation} {game.odds.moneyline.home > 0 ? "+" : ""}{game.odds.moneyline.home}</span>
                      <span style={{ color: "var(--text-dim)" }}>|</span>
                      <span>{game.awayTeam.abbreviation} {game.odds.moneyline.away > 0 ? "+" : ""}{game.odds.moneyline.away}</span>
                    </div>
                  </div>
                )}

                {/* Total */}
                {game.odds.overUnder != null && (
                  <div>
                    <div style={{ color: "var(--text-dim)", fontSize: 10, textTransform: "uppercase", marginBottom: 4 }}>Total ({game.odds.overUnder})</div>
                    <div style={{ display: "flex", justifyContent: "center", gap: 8, fontWeight: 600 }}>
                      <span>Over {game.odds.overUnder}</span>
                      <span style={{ color: "var(--text-dim)" }}>|</span>
                      <span>Under {game.odds.overUnder}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* DK Betting Splits */}
            {(() => {
              const splits = getSplitsForGame(game);
              if (!splits) return null;
              return (
                <div
                  style={{
                    background: "var(--surface2)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    marginBottom: 12,
                    fontSize: 12,
                  }}
                >
                  <div style={{ color: "var(--text-dim)", fontSize: 10, textTransform: "uppercase", marginBottom: 4 }}>
                    Public Betting
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
                    <span><strong>{splits.betPercent}%</strong> bets</span>
                    <span style={{ color: "var(--text-dim)" }}>|</span>
                    <span><strong>{splits.handlePercent}%</strong> handle</span>
                  </div>
                </div>
              );
            })()}

            {/* No Odds Notice */}
            {!game.odds && game.state === "pre" && (
              <div
                style={{
                  background: "var(--surface2)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  marginBottom: 12,
                  fontSize: 12,
                  color: "var(--text-dim)",
                  textAlign: "center",
                }}
              >
                Odds not yet available for this game
              </div>
            )}

            {/* Action Buttons: Props | Bet Selector | EdgeCheck */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {/* Props Button - Left */}
              <button
                onClick={() => setExpandedGamePropsId(expandedGamePropsId === game.id ? null : game.id)}
                style={{
                  padding: "8px 16px",
                  background: expandedGamePropsId === game.id ? "var(--border)" : "var(--surface2)",
                  color: expandedGamePropsId === game.id ? "#fff" : "var(--text)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  whiteSpace: "nowrap",
                  transition: "background 0.15s",
                }}
              >
                Props
              </button>

              {/* Bet Type Selector - Center */}
              <select
                value={selectedBets[game.id] || getBetOptions(game)[0]?.value || "spread_home"}
                onChange={(e) =>
                  setSelectedBets((prev) => ({ ...prev, [game.id]: e.target.value }))
                }
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  background: "var(--surface2)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                {getBetOptions(game).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* EdgeCheck Button - Right */}
              <button
                onClick={() => setExpandedGameId(expandedGameId === game.id ? null : game.id)}
                style={{
                  padding: "8px 20px",
                  background: expandedGameId === game.id ? "var(--border)" : "var(--accent)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  whiteSpace: "nowrap",
                  transition: "background 0.15s",
                }}
              >
                {expandedGameId === game.id ? "Hide" : "EdgeCheck"}
              </button>
            </div>

            {/* EdgeCheck Breakdown */}
            {expandedGameId === game.id && (() => {
              const options = getBetOptions(game);
              const selected = selectedBets[game.id] || options[0]?.value || "spread_home";
              const selectedOption = options.find((o) => o.value === selected);
              const splits = getSplitsForGame(game);
              const odds = game.odds;

              // Determine recommendation based on odds movement and public betting
              let recommendation = "HOLD";
              let confidence = "Medium";
              let edgeRating = 5;
              const factors = [];

              if (odds) {
                // Check for line value
                if (selected.includes("spread")) {
                  const spread = selected.includes("home") ? odds.spread?.home : odds.spread?.away;
                  if (spread) {
                    if (Math.abs(spread) <= 3) factors.push("Close spread game - high variance");
                    else if (Math.abs(spread) >= 7) factors.push("Large spread - consider ML instead");
                  }
                }
                if (selected.includes("ml")) {
                  const ml = selected.includes("home") ? odds.moneyline?.home : odds.moneyline?.away;
                  if (ml && ml > 0) {
                    factors.push("Betting underdog - higher risk/reward");
                    edgeRating += 1;
                  }
                  if (ml && ml < -200) factors.push("Heavy favorite - low value odds");
                }
                if (selected.includes("total")) {
                  factors.push("Total bet - weather and pace matter");
                }
              }

              // Factor in public betting (fade the public)
              if (splits) {
                if (splits.betPercent >= 70) {
                  factors.push(`Public heavily on one side (${splits.betPercent}% bets)`);
                  if (splits.handlePercent < splits.betPercent - 10) {
                    factors.push("Sharp money may be fading public");
                    recommendation = "LEAN";
                    edgeRating += 2;
                  }
                } else if (splits.betPercent <= 30) {
                  factors.push("Contrarian play - public avoiding this side");
                  edgeRating += 1;
                }
              }

              if (edgeRating >= 7) { recommendation = "BET"; confidence = "High"; }
              else if (edgeRating >= 5) { recommendation = "LEAN"; confidence = "Medium"; }
              else { recommendation = "HOLD"; confidence = "Low"; }

              return (
                <div
                  style={{
                    marginTop: 12,
                    background: "var(--surface2)",
                    borderRadius: 8,
                    padding: 16,
                    border: "1px solid var(--border)",
                  }}
                >
                  {/* Selected Market */}
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 12 }}>
                    SELECTED: <span style={{ color: "var(--text)", fontWeight: 600 }}>{selectedOption?.label || "N/A"}</span>
                  </div>

                  {/* Metrics Row */}
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-dim)" }}>RECOMMENDATION</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: recommendation === "BET" ? "var(--green)" : recommendation === "LEAN" ? "var(--yellow)" : "var(--text-dim)" }}>
                        {recommendation}
                      </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "var(--text-dim)" }}>CONFIDENCE</div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{confidence}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: "var(--text-dim)" }}>EDGE RATING</div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{edgeRating}/10</div>
                    </div>
                  </div>

                  {/* Public Betting */}
                  {splits && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 500, marginBottom: 4 }}>PUBLIC BETTING</div>
                      <div style={{ fontSize: 13, color: "var(--text)" }}>
                        <strong>{splits.betPercent}%</strong> bets / <strong>{splits.handlePercent}%</strong> handle on {splits.team}
                      </div>
                    </div>
                  )}

                  {/* Key Factors */}
                  {factors.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 500, marginBottom: 4 }}>KEY FACTORS</div>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>
                        {factors.map((f, i) => <li key={i}>{f}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Simple Analysis */}
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 500, marginBottom: 4 }}>ANALYSIS</div>
                    <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>
                      {recommendation === "BET"
                        ? "Multiple factors align favorably. This bet shows positive expected value based on current data."
                        : recommendation === "LEAN"
                        ? "Some positive signals present, but not overwhelming. Consider position sizing accordingly."
                        : "No clear edge detected. Consider passing or waiting for better line movement."}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        ))}
      </>
      )}

      {/* Props View */}
      {activeView === "props" && (
        <>
          {/* Props Header */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <ChartIcon size={20} color="var(--accent)" />
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Smart Props</h2>
              {!propsLoading && propsScored && (
                <span style={{ fontSize: 11, color: "var(--green)", background: "rgba(34,197,94,0.1)", padding: "2px 8px", borderRadius: 10 }}>
                  AI Scored
                </span>
              )}
            </div>
            <p style={{ fontSize: 13, color: "var(--text-dim)", margin: 0 }}>
              Top-ranked props by category. Cached 4 hours. One API call per sport.
            </p>
          </div>

          {/* Sport Filter */}
          <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
            {["mlb", "nba", "nhl"].map((s) => (
              <button
                key={s}
                onClick={() => setPropsSport(s)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid",
                  borderColor: propsSport === s ? "var(--accent)" : "var(--border)",
                  background: propsSport === s ? "var(--accent)" : "var(--surface)",
                  color: propsSport === s ? "#fff" : "var(--text-dim)",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Props Loading Skeleton */}
          {propsLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Loading Message */}
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                padding: "20px 24px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
              }}>
                <div style={{
                  width: 20,
                  height: 20,
                  border: "2px solid var(--border)",
                  borderTopColor: "var(--accent)",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }} />
                <span style={{ color: "var(--text)", fontSize: 15, fontWeight: 600 }}>
                  Loading {propsSport.toUpperCase()} props...
                </span>
              </div>
              {/* Skeleton Cards */}
              {[1, 2].map((i) => (
                <div key={i}>
                  <div style={{ background: "var(--border)", height: 20, width: 180, borderRadius: 4, marginBottom: 12, animation: "pulse 1.5s ease-in-out infinite" }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[1, 2, 3].map((j) => (
                      <div key={j} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
                        <div style={{ display: "flex", gap: 16 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ background: "var(--border)", height: 14, width: 120, borderRadius: 4, marginBottom: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
                            <div style={{ background: "var(--border)", height: 18, width: 180, borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite" }} />
                          </div>
                          <div style={{ background: "var(--border)", height: 50, width: 50, borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <style>{`
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                @keyframes spin { to { transform: rotate(360deg); } }
              `}</style>
            </div>
          )}

          {/* No Props */}
          {!propsLoading && propsCategories.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: 60,
                color: "var(--text-dim)",
                background: "var(--surface)",
                borderRadius: 12,
                border: "1px solid var(--border)",
              }}
            >
              <FlameIcon size={48} color="var(--text-dim)" />
              <p style={{ fontSize: 18, marginTop: 16, marginBottom: 8 }}>
                No {propsSport.toUpperCase()} props available
              </p>
              <p style={{ fontSize: 13 }}>
                Check back closer to game time for player props
              </p>
            </div>
          )}

          {/* Props Categories */}
          {!propsLoading && propsCategories.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              {propsCategories.map((category) => (
                <div key={category.id}>
                  {/* Category Header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <FlameIcon size={18} color="var(--accent)" />
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{category.name}</h3>
                    <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                      ({category.props.length} props)
                    </span>
                  </div>

                  {/* Category Props */}
                  {category.props.length === 0 ? (
                    <div style={{ padding: 20, background: "var(--surface)", borderRadius: 10, color: "var(--text-dim)", fontSize: 13, textAlign: "center" }}>
                      No props in this category tonight
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {category.props.map((prop) => {
                        const isExpanded = expandedPropId === prop.id;
                        const tierColors = getTierColor(prop.tier);
                        const gameTimeStr = formatGameTime(prop.gameTime, prop.commenceTime);

                        return (
                        <div
                          key={prop.id}
                          style={{
                            background: "var(--surface)",
                            border: prop.heaterScore >= 8 ? "2px solid var(--green)" : "1px solid var(--border)",
                            borderRadius: 12,
                            padding: 16,
                            cursor: isPaidUser ? "pointer" : "default",
                            transition: "all 0.2s ease",
                          }}
                          onClick={() => isPaidUser && setExpandedPropId(isExpanded ? null : prop.id)}
                        >
                          {/* Prop Header Row */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                            <div style={{ flex: 1 }}>
                              {/* Tier Badge + Game Time */}
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                {prop.tier && (
                                  <span style={{
                                    background: tierColors.bg,
                                    color: tierColors.text,
                                    padding: "2px 8px",
                                    borderRadius: 4,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                  }}>
                                    {prop.tier}
                                  </span>
                                )}
                                {gameTimeStr && (
                                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                                    <ClockIcon size={12} color={gameTimeStr === "Live" ? "var(--red)" : "var(--accent)"} />
                                    <span style={{ color: gameTimeStr === "Live" ? "var(--red)" : "var(--accent)", fontWeight: gameTimeStr === "Live" ? 700 : 400 }}>
                                      {gameTimeStr}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Matchup */}
                              <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 4 }}>
                                {prop.matchup || `${prop.awayTeam} @ ${prop.homeTeam}`}
                              </div>

                              {/* Player Name */}
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <UserIcon size={16} color="var(--accent)" />
                                <span style={{ fontWeight: 700, fontSize: 16 }}>{prop.playerName}</span>
                              </div>

                              {/* Prop Line + Best Odds with explanation */}
                              <div style={{ fontSize: 14, fontWeight: 600 }}>
                                {prop.overUnder} {prop.line} {prop.propType}
                                <span
                                  style={{ marginLeft: 8, color: prop.bestOdds > 0 ? "var(--green)" : "var(--text-dim)" }}
                                  title={explainOdds(prop.bestOdds)}
                                >
                                  {prop.bestOdds > 0 ? "+" : ""}{prop.bestOdds}
                                </span>
                              </div>
                              {/* Odds explanation inline */}
                              <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
                                {explainOdds(prop.bestOdds)}
                              </div>
                            </div>

                            {/* Heater Score Badge */}
                            {prop.heaterScore ? (
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 60 }}>
                                <div
                                  style={{
                                    background:
                                      prop.heaterScore >= 9 ? "var(--green)"
                                      : prop.heaterScore >= 8 ? "var(--yellow)"
                                      : prop.heaterScore >= 7 ? "var(--orange)"
                                      : "var(--surface2)",
                                    color: prop.heaterScore >= 7 ? "#fff" : "var(--text)",
                                    padding: "6px 12px",
                                    borderRadius: 8,
                                    fontWeight: 700,
                                    fontSize: 20,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  <FlameIcon size={16} color={prop.heaterScore >= 7 ? "#fff" : "var(--text-dim)"} />
                                  {prop.heaterScore}
                                </div>
                                <span style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 2 }}>HEATER</span>
                                {/* Expand hint for paid users */}
                                {isPaidUser && (
                                  <span style={{ fontSize: 9, color: "var(--accent)", marginTop: 4 }}>
                                    {isExpanded ? "tap to collapse" : "tap for details"}
                                  </span>
                                )}
                              </div>
                            ) : !isPaidUser ? (
                              <div
                                style={{
                                  background: "var(--surface2)",
                                  padding: "10px",
                                  borderRadius: 8,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                <LockIcon size={14} color="var(--text-dim)" />
                                <span style={{ fontSize: 10, color: "var(--text-dim)" }}>PRO</span>
                              </div>
                            ) : null}
                          </div>

                          {/* Paid User Stats + Analysis */}
                          {isPaidUser && prop.heaterScore && (
                            <>
                              {/* Stats Row - Edge & Probabilities */}
                              <div
                                style={{
                                  display: "flex",
                                  gap: 12,
                                  marginBottom: 8,
                                  padding: "8px 12px",
                                  background: "var(--surface2)",
                                  borderRadius: 6,
                                  flexWrap: "wrap",
                                  fontSize: 12,
                                }}
                              >
                                {prop.edge && (
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <TrendingUpIcon size={12} color={parseFloat(prop.edge) >= 3 ? "var(--green)" : "var(--text-dim)"} />
                                    <span style={{ color: "var(--text-dim)" }}>Edge:</span>
                                    <span style={{ fontWeight: 700, color: parseFloat(prop.edge) >= 5 ? "var(--green)" : parseFloat(prop.edge) >= 2 ? "var(--yellow)" : "var(--text-dim)" }}>
                                      {prop.edge}%
                                    </span>
                                  </div>
                                )}
                                {prop.impliedProbability && (
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <span style={{ color: "var(--text-dim)" }}>Book:</span>
                                    <span style={{ fontWeight: 600 }}>{prop.impliedProbability}%</span>
                                  </div>
                                )}
                                {prop.modelProbability && (
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <span style={{ color: "var(--text-dim)" }}>True:</span>
                                    <span style={{ fontWeight: 600, color: parseFloat(prop.modelProbability) > parseFloat(prop.impliedProbability || 0) ? "var(--green)" : "var(--text-dim)" }}>
                                      {prop.modelProbability}%
                                    </span>
                                  </div>
                                )}
                                {/* L10 for MLB/NBA/NHL when available, CONF as fallback */}
                                {prop.sport === "MLB" && prop.seasonAvg && (
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <span style={{ color: "var(--text-dim)" }}>AVG:</span>
                                    <span style={{ fontWeight: 700, color: parseFloat(prop.seasonAvg) >= 0.300 ? "var(--green)" : parseFloat(prop.seasonAvg) >= 0.250 ? "var(--text)" : "var(--text-dim)" }}>
                                      {prop.seasonAvg}
                                    </span>
                                  </div>
                                )}
                                {prop.last10HitRate ? (
                                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: (prop.sport === "MLB" && prop.seasonAvg) ? 0 : "auto" }}>
                                    <TargetIcon size={12} color="var(--green)" />
                                    <span style={{ color: "var(--text-dim)" }}>L10:</span>
                                    <span style={{ fontWeight: 700, color: prop.hitRateLast10 >= 7 ? "var(--green)" : prop.hitRateLast10 >= 5 ? "var(--yellow)" : "var(--text-dim)" }}>
                                      {prop.last10HitRate}
                                    </span>
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
                                    <span style={{ color: "var(--text-dim)" }}>Conf:</span>
                                    <span style={{ fontWeight: 700, color: prop.confidence >= 8 ? "var(--green)" : "var(--text-dim)" }}>
                                      {prop.confidence}/10
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Expanded Details */}
                              {isExpanded && (
                                <>
                                  {/* Write-up */}
                                  {prop.writeup && (
                                    <p style={{ fontSize: 13, lineHeight: 1.6, margin: "0 0 8px 0", color: "var(--text)" }}>
                                      {prop.writeup}
                                    </p>
                                  )}

                                  {/* Key Factor */}
                                  {prop.keyFactor && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                                      <TrendingUpIcon size={12} color="var(--accent)" />
                                      <span style={{ color: "var(--accent)", fontWeight: 600 }}>Key:</span>
                                      <span style={{ color: "var(--text-dim)" }}>{prop.keyFactor}</span>
                                    </div>
                                  )}

                                  {/* EV & Risk Summary */}
                                  <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, flexWrap: "wrap" }}>
                                    {prop.edge && prop.bestOdds && (
                                      <div>
                                        <span style={{ color: "var(--text-dim)" }}>EV: </span>
                                        <span style={{
                                          fontWeight: 700,
                                          color: parseFloat(prop.edge) >= 3 ? "var(--green)" : parseFloat(prop.edge) >= 0 ? "var(--yellow)" : "var(--red)"
                                        }}>
                                          {parseFloat(prop.edge) >= 0 ? "+" : ""}{prop.edge}%
                                        </span>
                                      </div>
                                    )}
                                    {prop.riskReason && (
                                      <div>
                                        <span style={{ color: "var(--orange)" }}>Risk: </span>
                                        <span style={{ color: "var(--text-dim)" }}>{prop.riskReason}</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Source */}
                                  {prop.odds?.[0]?.bookmaker && (
                                    <div style={{ marginTop: 6, fontSize: 10, color: "var(--text-dim)" }}>
                                      Source: {prop.odds[0].bookmaker}
                                    </div>
                                  )}

                                  {/* Multi-book odds */}
                                  {prop.odds && prop.odds.length > 1 && (
                                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                                      {prop.odds.slice(0, 4).map((o, idx) => (
                                        <span
                                          key={idx}
                                          style={{
                                            fontSize: 10,
                                            padding: "2px 6px",
                                            background: "var(--surface2)",
                                            borderRadius: 4,
                                            color: "var(--text-dim)",
                                          }}
                                        >
                                          {o.bookmaker}: {o.price > 0 ? "+" : ""}{o.price}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {/* Last 10 Results */}
                                  {prop.last10HitRate && (
                                    <div style={{ marginTop: 10, padding: "8px 10px", background: "var(--surface2)", borderRadius: 6 }}>
                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>Last 10 Games</span>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: prop.hitRateLast10 >= 7 ? "var(--green)" : prop.hitRateLast10 >= 5 ? "var(--yellow)" : "var(--red)" }}>
                                          {prop.last10HitRate}
                                        </span>
                                      </div>
                                      {prop.last10Results && (
                                        <div style={{ display: "flex", gap: 3 }}>
                                          {prop.last10Results.split("").map((r, idx) => (
                                            <span
                                              key={idx}
                                              style={{
                                                width: 18,
                                                height: 18,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: 10,
                                                fontWeight: 700,
                                                borderRadius: 3,
                                                background: r === "H" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)",
                                                color: r === "H" ? "var(--green)" : "var(--red)",
                                              }}
                                            >
                                              {r}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </>
                              )}
                            </>
                          )}

                          {/* Free User Upsell */}
                          {!isPaidUser && (
                            <div
                              style={{
                                padding: "12px",
                                background: "linear-gradient(135deg, var(--surface2) 0%, rgba(99,102,241,0.1) 100%)",
                                borderRadius: 6,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginTop: 8,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <LockIcon size={14} color="var(--accent)" />
                                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Unlock hit rates, AI analysis, and heater scores</span>
                              </div>
                              <button
                                onClick={handleUpgrade}
                                disabled={upgrading}
                                style={{
                                  padding: "6px 14px",
                                  background: "var(--accent)",
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: 6,
                                  fontWeight: 600,
                                  fontSize: 12,
                                  cursor: upgrading ? "not-allowed" : "pointer",
                                }}
                              >
                                {upgrading ? "..." : "Upgrade"}
                              </button>
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Line Watch View */}
      {activeView === "linewatch" && (
        <>
          {/* Line Watch Header */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <EyeIcon size={20} color="var(--accent)" />
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Tomorrow&apos;s Line Watch</h2>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-dim)", margin: 0 }}>
              AI-predicted lines vs current market. Value alerts when gap is 2+ points.
            </p>
            {!lineWatchLoading && lineWatchValueAlerts > 0 && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 8,
                  padding: "6px 12px",
                  background: "rgba(34,197,94,0.1)",
                  borderRadius: 20,
                  border: "1px solid var(--green)",
                }}
              >
                <AlertTriangleIcon size={14} color="var(--green)" />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--green)" }}>
                  {lineWatchValueAlerts} Value Alert{lineWatchValueAlerts > 1 ? "s" : ""} Found
                </span>
              </div>
            )}
          </div>

          {/* Line Watch Loading */}
          {lineWatchLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: 20,
                  }}
                >
                  <div style={{ display: "flex", gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ background: "var(--border)", height: 16, width: 80, borderRadius: 4, marginBottom: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
                      <div style={{ background: "var(--border)", height: 20, width: 250, borderRadius: 4, marginBottom: 12, animation: "pulse 1.5s ease-in-out infinite" }} />
                      <div style={{ background: "var(--border)", height: 40, width: "100%", borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite" }} />
                    </div>
                  </div>
                </div>
              ))}
              <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
            </div>
          )}

          {/* Subscription Required */}
          {!lineWatchLoading && lineWatchError === "subscription_required" && (
            <div
              style={{
                textAlign: "center",
                padding: 60,
                background: "var(--surface)",
                borderRadius: 12,
                border: "1px solid var(--border)",
              }}
            >
              <LockIcon size={48} color="var(--accent)" />
              <h3 style={{ fontSize: 20, marginTop: 16, marginBottom: 8 }}>
                Unlock Line Watch
              </h3>
              <p style={{ fontSize: 14, color: "var(--text-dim)", marginBottom: 20 }}>
                Get AI-predicted lines and value alerts with EdgeCheck Pro
              </p>
              <button
                onClick={handleUpgrade}
                disabled={upgrading}
                style={{
                  padding: "12px 28px",
                  background: "var(--accent)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: upgrading ? "not-allowed" : "pointer",
                }}
              >
                {upgrading ? "..." : "Upgrade to Pro"}
              </button>
            </div>
          )}

          {/* Line Watch Error */}
          {!lineWatchLoading && lineWatchError && lineWatchError !== "subscription_required" && (
            <div
              style={{
                textAlign: "center",
                padding: 40,
                color: "var(--red)",
                background: "var(--surface)",
                borderRadius: 12,
                border: "1px solid var(--border)",
              }}
            >
              <AlertTriangleIcon size={32} color="var(--red)" />
              <p style={{ marginTop: 12 }}>{lineWatchError}</p>
            </div>
          )}

          {/* No Games */}
          {!lineWatchLoading && !lineWatchError && lineWatchGames.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: 60,
                color: "var(--text-dim)",
                background: "var(--surface)",
                borderRadius: 12,
                border: "1px solid var(--border)",
              }}
            >
              <EyeIcon size={48} color="var(--text-dim)" />
              <p style={{ fontSize: 18, marginTop: 16, marginBottom: 8 }}>
                No games scheduled for tomorrow
              </p>
              <p style={{ fontSize: 13 }}>
                Check back later for upcoming matchups
              </p>
            </div>
          )}

          {/* Line Watch Games */}
          {!lineWatchLoading && !lineWatchError && lineWatchGames.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {lineWatchGames.map((game) => (
                <div
                  key={game.id}
                  style={{
                    background: "var(--surface)",
                    border: game.hasValueAlert ? "2px solid var(--green)" : "1px solid var(--border)",
                    borderRadius: 12,
                    padding: 20,
                    position: "relative",
                  }}
                >
                  {/* Value Alert Badge */}
                  {game.hasValueAlert && (
                    <div
                      style={{
                        position: "absolute",
                        top: -10,
                        right: 16,
                        background: "var(--green)",
                        color: "#fff",
                        padding: "4px 12px",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <AlertTriangleIcon size={12} color="#fff" />
                      VALUE ALERT
                    </div>
                  )}

                  {/* Game Header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          background: "var(--surface2)",
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 700,
                          color: "var(--text-dim)",
                        }}
                      >
                        {game.sport}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: 16 }}>
                        {game.awayTeam} @ {game.homeTeam}
                      </span>
                    </div>
                    {game.commenceTime && (
                      <span style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>
                        {new Date(game.commenceTime).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        {" "}
                        {new Date(game.commenceTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </span>
                    )}
                  </div>

                  {/* Lines Comparison Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: 12,
                      marginBottom: 16,
                      background: "var(--surface2)",
                      padding: 16,
                      borderRadius: 10,
                    }}
                  >
                    {/* Headers */}
                    <div style={{ fontWeight: 600, fontSize: 12, color: "var(--text-dim)" }}></div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: "var(--text-dim)", textAlign: "center" }}>Current Line</div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: "var(--accent)", textAlign: "center" }}>Our Prediction</div>

                    {/* Spread Row */}
                    <div style={{ fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center" }}>Spread</div>
                    <div style={{ textAlign: "center", fontSize: 15, fontWeight: 700 }}>
                      {game.currentOdds?.homeSpread != null ? (
                        <>
                          {game.homeAbbrev || game.homeTeam.split(" ").pop()}{" "}
                          {game.currentOdds.homeSpread > 0 ? "+" : ""}{game.currentOdds.homeSpread}
                        </>
                      ) : (
                        <span style={{ color: "var(--text-dim)" }}>N/A</span>
                      )}
                    </div>
                    <div
                      style={{
                        textAlign: "center",
                        fontSize: 15,
                        fontWeight: 700,
                        color: game.spreadGap?.hasValue ? "var(--green)" : "var(--text)",
                      }}
                    >
                      {game.homeAbbrev || game.homeTeam.split(" ").pop()}{" "}
                      {game.prediction?.predictedHomeSpread > 0 ? "+" : ""}
                      {game.prediction?.predictedHomeSpread?.toFixed(1)}
                      {game.spreadGap?.hasValue && (
                        <span style={{ fontSize: 11, marginLeft: 6, color: "var(--green)" }}>
                          ({game.spreadGap.gap}pt gap)
                        </span>
                      )}
                    </div>

                    {/* Total Row */}
                    <div style={{ fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center" }}>Total</div>
                    <div style={{ textAlign: "center", fontSize: 15, fontWeight: 700 }}>
                      {game.currentOdds?.total != null ? (
                        <>O/U {game.currentOdds.total}</>
                      ) : (
                        <span style={{ color: "var(--text-dim)" }}>N/A</span>
                      )}
                    </div>
                    <div
                      style={{
                        textAlign: "center",
                        fontSize: 15,
                        fontWeight: 700,
                        color: game.totalGap?.hasValue ? "var(--green)" : "var(--text)",
                      }}
                    >
                      O/U {game.prediction?.predictedTotal?.toFixed(1)}
                      {game.totalGap?.hasValue && (
                        <span style={{ fontSize: 11, marginLeft: 6, color: "var(--green)" }}>
                          ({game.totalGap.gap}pt gap)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Confidence Meters */}
                  <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>Spread Confidence</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: "var(--surface2)", borderRadius: 3, overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${(game.prediction?.spreadConfidence || 0) * 10}%`,
                              height: "100%",
                              background: game.prediction?.spreadConfidence >= 8 ? "var(--green)" : game.prediction?.spreadConfidence >= 6 ? "var(--yellow)" : "var(--text-dim)",
                              borderRadius: 3,
                            }}
                          />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{game.prediction?.spreadConfidence}/10</span>
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>Total Confidence</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: "var(--surface2)", borderRadius: 3, overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${(game.prediction?.totalConfidence || 0) * 10}%`,
                              height: "100%",
                              background: game.prediction?.totalConfidence >= 8 ? "var(--green)" : game.prediction?.totalConfidence >= 6 ? "var(--yellow)" : "var(--text-dim)",
                              borderRadius: 3,
                            }}
                          />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{game.prediction?.totalConfidence}/10</span>
                      </div>
                    </div>
                  </div>

                  {/* Analysis */}
                  {game.prediction?.spreadAnalysis && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", marginBottom: 6, textTransform: "uppercase" }}>
                        Spread Analysis
                      </div>
                      <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, color: "var(--text)" }}>
                        {game.prediction.spreadAnalysis}
                      </p>
                    </div>
                  )}

                  {game.prediction?.totalAnalysis && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", marginBottom: 6, textTransform: "uppercase" }}>
                        Total Analysis
                      </div>
                      <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, color: "var(--text)" }}>
                        {game.prediction.totalAnalysis}
                      </p>
                    </div>
                  )}

                  {/* Key Factors */}
                  {game.prediction?.keyFactors?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", marginBottom: 6, textTransform: "uppercase" }}>
                        Key Factors
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {game.prediction.keyFactors.map((factor, idx) => (
                          <span
                            key={idx}
                            style={{
                              background: "var(--surface2)",
                              padding: "4px 10px",
                              borderRadius: 12,
                              fontSize: 12,
                              color: "var(--text-dim)",
                            }}
                          >
                            {factor}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Footer */}
      <div
        style={{
          textAlign: "center",
          padding: "24px 0",
          color: "var(--text-dim)",
          fontSize: 12,
        }}
      >
        EdgeCheck — Data from ESPN. Independent matchup analysis.
        <br />
        For entertainment purposes only. Please bet responsibly.
      </div>
    </div>
  );
}
