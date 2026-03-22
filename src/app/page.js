"use client";

import { useState, useEffect, useCallback } from "react";
import "./globals.css";

const SPORTS = [
  { key: "nba", label: "NBA" },
  { key: "nfl", label: "NFL" },
  { key: "mlb", label: "MLB" },
  { key: "nhl", label: "NHL" },
  { key: "ncaaf", label: "NCAAF" },
  { key: "ncaab", label: "NCAAB" },
  { key: "mls", label: "MLS" },
];

const BET_TYPES = [
  "Spread",
  "Moneyline (Home)",
  "Moneyline (Away)",
  "Over",
  "Under",
];

export default function Home() {
  const [sport, setSport] = useState("nba");
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analyzing, setAnalyzing] = useState(null);
  const [analyses, setAnalyses] = useState({});
  const [selectedBets, setSelectedBets] = useState({});

  const fetchGames = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/games?sport=${sport}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch games");
      setGames(data.games ?? []);
    } catch (err) {
      setError(err.message);
      setGames([]);
    } finally {
      setLoading(false);
    }
  }, [sport]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  const analyzeBet = async (game) => {
    const betType = selectedBets[game.id] || "Spread";
    let betValue = "";
    if (betType === "Spread" && game.odds?.spread) {
      betValue = `Home ${game.odds.spread.home}`;
    } else if (betType === "Over" || betType === "Under") {
      betValue = `${game.odds?.overUnder ?? "N/A"}`;
    } else if (betType === "Moneyline (Home)") {
      betValue = `${game.odds?.moneyline?.home ?? "N/A"}`;
    } else if (betType === "Moneyline (Away)") {
      betValue = `${game.odds?.moneyline?.away ?? "N/A"}`;
    }

    setAnalyzing(game.id);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game, betType, betValue }),
      });
      const data = await res.json();
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

  const getRecColor = (rec) => {
    if (!rec) return "var(--text-dim)";
    if (rec === "Strong Bet") return "var(--green)";
    if (rec === "Lean") return "var(--yellow)";
    if (rec === "Avoid") return "var(--orange)";
    if (rec === "Fade") return "var(--red)";
    return "var(--text-dim)";
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
          <span style={{ color: "var(--accent)" }}>Edge</span>Check
        </h1>
        <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
          AI-Powered Sports Betting Edge Analyzer
        </p>
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
              borderColor:
                sport === s.key ? "var(--accent)" : "var(--border)",
              background:
                sport === s.key ? "var(--accent)" : "var(--surface)",
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
        <div
          style={{
            textAlign: "center",
            padding: 60,
            color: "var(--text-dim)",
          }}
        >
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
          Loading games...
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Error */}
      {error && (
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
          {error}
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
          <p style={{ fontSize: 18, marginBottom: 8 }}>
            No games scheduled today for{" "}
            {SPORTS.find((s) => s.key === sport)?.label}
          </p>
          <p style={{ fontSize: 13 }}>
            Check back later or try a different sport.
          </p>
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
              <span>
                {game.state === "in"
                  ? "🔴 LIVE"
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
                  <span style={{ fontSize: 14, color: "var(--text-dim)" }}>
                    VS
                  </span>
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
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Odds Row */}
            {game.odds && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-around",
                  background: "var(--surface2)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  marginBottom: 12,
                  fontSize: 13,
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "var(--text-dim)", fontSize: 10 }}>
                    SPREAD
                  </div>
                  <div style={{ fontWeight: 600 }}>
                    {game.odds.spread?.home != null
                      ? (game.odds.spread.home > 0 ? "+" : "") +
                        game.odds.spread.home
                      : "N/A"}
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "var(--text-dim)", fontSize: 10 }}>
                    ML HOME
                  </div>
                  <div style={{ fontWeight: 600 }}>
                    {game.odds.moneyline?.home != null
                      ? (game.odds.moneyline.home > 0 ? "+" : "") +
                        game.odds.moneyline.home
                      : "N/A"}
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "var(--text-dim)", fontSize: 10 }}>
                    ML AWAY
                  </div>
                  <div style={{ fontWeight: 600 }}>
                    {game.odds.moneyline?.away != null
                      ? (game.odds.moneyline.away > 0 ? "+" : "") +
                        game.odds.moneyline.away
                      : "N/A"}
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "var(--text-dim)", fontSize: 10 }}>
                    O/U
                  </div>
                  <div style={{ fontWeight: 600 }}>
                    {game.odds.overUnder ?? "N/A"}
                  </div>
                </div>
              </div>
            )}

            {/* Bet Type Selector + Analyze Button */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                value={selectedBets[game.id] || "Spread"}
                onChange={(e) =>
                  setSelectedBets((prev) => ({
                    ...prev,
                    [game.id]: e.target.value,
                  }))
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
                {BET_TYPES.map((bt) => (
                  <option key={bt} value={bt}>
                    {bt}
                  </option>
                ))}
              </select>
              <button
                onClick={() => analyzeBet(game)}
                disabled={analyzing === game.id}
                style={{
                  padding: "8px 20px",
                  background:
                    analyzing === game.id
                      ? "var(--border)"
                      : "var(--accent)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor:
                    analyzing === game.id ? "not-allowed" : "pointer",
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
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 12,
                      }}
                    >
                      <div>
                        <div
                          style={{ fontSize: 11, color: "var(--text-dim)" }}
                        >
                          EDGE RATING
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700 }}>
                          {analyses[game.id].edgeRating ?? "?"}/10
                        </div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div
                          style={{ fontSize: 11, color: "var(--text-dim)" }}
                        >
                          CONFIDENCE
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 600 }}>
                          {analyses[game.id].confidence ?? "N/A"}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{ fontSize: 11, color: "var(--text-dim)" }}
                        >
                          RECOMMENDATION
                        </div>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: getRecColor(
                              analyses[game.id].recommendation
                            ),
                          }}
                        >
                          {analyses[game.id].recommendation ?? "N/A"}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                        color: "var(--text)",
                      }}
                    >
                      {analyses[game.id].fullText}
                    </div>
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
        EdgeCheck — Data from ESPN. Analysis powered by Claude AI.
        <br />
        For entertainment purposes only. Please bet responsibly.
      </div>
    </div>
  );
}
