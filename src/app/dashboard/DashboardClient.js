"use client";

import { useState, useEffect, useCallback } from "react";
import { UserButton } from "@clerk/nextjs";
import "../globals.css";

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

  if (odds?.moneyline?.home != null && odds?.moneyline?.away != null) {
    const hml = odds.moneyline.home > 0 ? `+${odds.moneyline.home}` : `${odds.moneyline.home}`;
    const aml = odds.moneyline.away > 0 ? `+${odds.moneyline.away}` : `${odds.moneyline.away}`;
    opts.push({ value: `ml_home`, label: `${home} ML ${hml}` });
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

function parseGame(event, sportKey) {
  const competition = event.competitions?.[0];
  if (!competition) return null;
  const homeTeamData = competition.competitors?.find((c) => c.homeAway === "home");
  const awayTeamData = competition.competitors?.find((c) => c.homeAway === "away");
  if (!homeTeamData || !awayTeamData) return null;
  const homeTeam = homeTeamData.team;
  const awayTeam = awayTeamData.team;
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
    odds: parseOdds(competition),
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
  if (!oddsGames.length) return games;

  return games.map((game) => {
    const match = oddsGames.find(
      (og) =>
        (teamsMatch(game.homeTeam.name, og.homeTeam) &&
         teamsMatch(game.awayTeam.name, og.awayTeam)) ||
        (teamsMatch(game.homeTeam.name, og.awayTeam) &&
         teamsMatch(game.awayTeam.name, og.homeTeam))
    );

    if (!match) return game;

    const flipped = teamsMatch(game.homeTeam.name, match.awayTeam);

    const existing = game.odds ?? {};
    const merged = { ...existing };

    if (existing.moneyline?.home == null || existing.moneyline?.away == null) {
      const homeML = flipped ? match.moneyline.away : match.moneyline.home;
      const awayML = flipped ? match.moneyline.home : match.moneyline.away;
      if (homeML != null && awayML != null) {
        merged.moneyline = { home: homeML, away: awayML };
        merged.mlProvider = match.bookmaker;
      }
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

  const sportConfig = SPORTS.find((s) => s.key === sport);

  // Check for upgrade success on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") === "true") {
      // Remove the query param
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []);

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

      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setAnalyses((prev) => ({ ...prev, [game.id]: data.analysis }));
    } catch (err) {
      setAnalyses((prev) => ({
        ...prev,
        [game.id]: { error: err.message, fullText: "" },
      }));
    } finally {
      setAnalyzing(null);
    }
  };

  const formatTime = (iso) => {
    try {
      return new Date(iso).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      });
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

      {/* Sport Tabs */}
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

            {/* Bet Type Selector + Analyze Button */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
              <button
                onClick={() => analyzeBet(game)}
                disabled={analyzing === game.id}
                style={{
                  padding: "8px 20px",
                  background: analyzing === game.id ? "var(--border)" : "var(--accent)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: analyzing === game.id ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  whiteSpace: "nowrap",
                  transition: "background 0.15s",
                }}
              >
                {analyzing === game.id ? "Analyzing..." : "Analyze Bet"}
              </button>
            </div>

            {/* Analysis Result */}
            {analyses[game.id] && (
              <div
                style={{
                  marginTop: 12,
                  background: "var(--surface2)",
                  borderRadius: 8,
                  padding: 16,
                  border: "1px solid var(--border)",
                }}
              >
                {analyses[game.id].error ? (
                  <div style={{ color: "var(--red)" }}>
                    Analysis error: {analyses[game.id].error}
                  </div>
                ) : (
                  <>
                    {/* Metrics Row */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>EDGE RATING</div>
                        <div style={{ fontSize: 24, fontWeight: 700 }}>
                          {analyses[game.id].edgeRating ?? "?"}/10
                        </div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>CONFIDENCE</div>
                        <div style={{ fontSize: 16, fontWeight: 600 }}>
                          {analyses[game.id].confidence ?? "N/A"}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                          RECOMMENDATION
                        </div>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: getRecColor(analyses[game.id].recommendation),
                          }}
                        >
                          {getRecDisplay(analyses[game.id].recommendation) ?? "N/A"}
                        </div>
                      </div>
                    </div>

                    {/* Decision Summary */}
                    {(() => {
                      const summary = getDecisionSummary(analyses[game.id].recommendation);
                      if (!summary) return null;
                      return (
                        <div style={{ fontSize: 12, fontWeight: 500, color: summary.color, marginBottom: 14 }}>
                          {summary.text}
                        </div>
                      );
                    })()}

                    {/* Parsed Sections */}
                    {(() => {
                      const { sections } = parseFullText(analyses[game.id].fullText);
                      if (!sections.length) {
                        return (
                          <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--text)" }}>
                            {analyses[game.id].fullText}
                          </div>
                        );
                      }
                      return sections.map((section, i) => (
                        <div key={section.label} style={{ marginTop: i === 0 ? 0 : 14 }}>
                          <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 500, marginBottom: 4 }}>
                            {section.label}
                          </div>
                          <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text)", whiteSpace: "pre-wrap" }}>
                            {section.label === "Analysis"
                              ? (() => {
                                  const firstDot = section.content.indexOf(".");
                                  if (firstDot === -1) return section.content;
                                  return (
                                    <>
                                      <span style={{ fontWeight: 600 }}>{section.content.slice(0, firstDot + 1)}</span>
                                      {section.content.slice(firstDot + 1)}
                                    </>
                                  );
                                })()
                              : section.content}
                          </div>
                        </div>
                      ));
                    })()}
                  </>
                )}
              </div>
            )}
          </div>
        ))}

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
