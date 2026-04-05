import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { hasActiveSubscription } from "../../../lib/subscription";
import { enrichMLBProps } from "../../../lib/mlbStats";
import { enrichNBAProps } from "../../../lib/nbaStats";

export const maxDuration = 60;

// Minimum edge percentage required to show a prop (0 = show all props, sort by edge)
const MIN_EDGE_PERCENT = 0;

// Minimum heater score to display a prop (filters weak plays)
const MIN_HEATER_SCORE = 7.0;

// Sport and category configuration with STRICT limits per user requirements
const SPORT_CONFIG = {
  mlb: {
    oddsKey: "baseball_mlb",
    cacheTTL: 30 * 60 * 1000, // 30 minutes for freshness
    categories: [
      {
        id: "home_runs",
        name: "Home Run Props",
        markets: ["batter_home_runs"],
        maxProps: 3, // Max 3 HR props per requirements
        filterFn: () => true,
      },
      {
        id: "hits",
        name: "Hit Props",
        markets: ["batter_hits"],
        maxProps: 5, // Reduced to show only top-quality plays
        filterFn: (prop) => prop.overUnder === "Over",
      },
    ],
  },
  nhl: {
    oddsKey: "icehockey_nhl",
    cacheTTL: 30 * 60 * 1000,
    categories: [
      {
        id: "goals",
        name: "Goals",
        markets: ["player_goals"],
        maxProps: 10,
        filterFn: () => true,
      },
      {
        id: "assists",
        name: "Assists",
        markets: ["player_assists"],
        maxProps: 10,
        filterFn: () => true,
      },
      {
        id: "shots",
        name: "Shots on Goal",
        markets: ["player_shots_on_goal"],
        maxProps: 10,
        filterFn: () => true,
      },
      {
        id: "blocked_shots",
        name: "Blocked Shots",
        markets: ["player_blocked_shots"],
        maxProps: 10,
        filterFn: () => true,
      },
    ],
  },
  nba: {
    oddsKey: "basketball_nba",
    cacheTTL: 30 * 60 * 1000,
    categories: [
      {
        id: "points",
        name: "Points",
        markets: ["player_points"],
        maxProps: 10,
        filterFn: () => true,
      },
      {
        id: "rebounds",
        name: "Rebounds",
        markets: ["player_rebounds"],
        maxProps: 10,
        filterFn: () => true,
      },
      {
        id: "assists",
        name: "Assists",
        markets: ["player_assists"],
        maxProps: 10,
        filterFn: () => true,
      },
      {
        id: "threes",
        name: "3-Pointers",
        markets: ["player_threes"],
        maxProps: 10,
        filterFn: () => true,
      },
      {
        id: "blocks",
        name: "Blocks",
        markets: ["player_blocks"],
        maxProps: 8,
        filterFn: () => true,
      },
      {
        id: "steals",
        name: "Steals",
        markets: ["player_steals"],
        maxProps: 8,
        filterFn: () => true,
      },
    ],
  },
};

// Cache per sport - stores all props for the day
const propsCache = {
  mlb: { data: null, timestamp: 0 },
  nba: { data: null, timestamp: 0 },
  nhl: { data: null, timestamp: 0 },
};

// Calculate implied probability from American odds
function calculateImpliedProbability(odds) {
  if (odds > 0) {
    return 100 / (odds + 100);
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}

// Calculate model probability based on odds patterns across bookmakers
function calculateModelProbability(oddsArray, propType) {
  if (!oddsArray || oddsArray.length === 0) return 0.5;

  // Average implied probability across all bookmakers (remove vig estimate)
  const impliedProbs = oddsArray.map((o) => calculateImpliedProbability(o.price));
  const avgImplied = impliedProbs.reduce((a, b) => a + b, 0) / impliedProbs.length;

  // Vig removal: typical vig is ~4-10%, so true probability is slightly lower
  // For props, bookmakers typically have ~8% vig total, so divide by ~1.04 per side
  const vigAdjusted = avgImplied / 1.04;

  // Slight boost for favorable line movement (best odds significantly better than average)
  const bestOdds = Math.max(...oddsArray.map((o) => o.price));
  const avgOdds = oddsArray.reduce((a, b) => a + b.price, 0) / oddsArray.length;
  const lineBoost = bestOdds > avgOdds + 10 ? 0.02 : 0;

  return Math.min(0.95, Math.max(0.05, vigAdjusted + lineBoost));
}

// Calculate edge percentage
function calculateEdge(modelProb, impliedProb) {
  return ((modelProb - impliedProb) * 100).toFixed(1);
}

// Score MLB props using REAL data-driven logic
// Inputs: line difficulty, odds value, edge calculation, MLB context
// NO simulated or fake data
function scoreMLBProp(prop, bestOdds, edge) {
  const line = prop.line || 0.5;
  const propType = prop.propType || prop.marketKey || "";
  const playerName = prop.playerName || "Player";

  // MLB Stats context (from enrichment)
  const lineupSpot = prop.lineupSpot;
  const handednessMatchup = prop.handednessMatchup;
  const opposingPitcher = prop.opposingPitcher;
  const pitcherHand = prop.pitcherHand;
  const batSide = prop.batSide;

  // Recent performance stats
  const avgLast5 = prop.avgLast5 ? parseFloat(prop.avgLast5) : null;
  const hitsLast5 = prop.hitsLast5;
  const batterTrend = prop.batterTrend;
  const isBatterHot = prop.isBatterHot;
  const isBatterCold = prop.isBatterCold;
  const last10Games = prop.last10Games || [];

  // Calculate hit/miss rate based on prop type and line
  let last10HitRate = null;
  let last10Results = null;
  if (last10Games.length > 0) {
    const isHits = propType.includes("Hits") || propType === "batter_hits";
    const isHR = propType.includes("Home Run") || propType === "batter_home_runs";

    const results = last10Games.map((g) => {
      const statValue = isHR ? g.homeRuns : g.hits;
      return statValue >= line ? "H" : "M"; // Hit or Miss
    });

    const hitCount = results.filter((r) => r === "H").length;
    const totalGames = results.length;
    last10HitRate = `${hitCount}/${totalGames}`;
    last10Results = results.join(""); // e.g., "HHMHHMHHHM"
  }

  // Pitcher quality stats
  const pitcherERA = prop.pitcherERA;
  const pitcherQuality = prop.pitcherQuality;
  const isPitcherElite = prop.isPitcherElite;
  const isPitcherStruggling = prop.isPitcherStruggling;

  // Score components (all based on real, available data)
  let lineValueScore = 0;
  let oddsValueScore = 0;
  let edgeScore = 0;
  let contextScore = 0;
  let riskPenalty = 0;

  const factors = [];
  const risks = [];

  // === LINE VALUE SCORE ===
  // Lower lines are statistically easier to hit
  const isHits = propType.includes("Hits") || propType === "batter_hits";
  const isHR = propType.includes("Home Run") || propType === "batter_home_runs";

  if (isHits) {
    if (line === 0.5) {
      lineValueScore = 2.5; // Any hit = high probability
      factors.push("0.5 line - only needs 1 hit");
    } else if (line === 1.5) {
      lineValueScore = 1.5;
      factors.push("1.5 line - needs multi-hit game");
      risks.push("Requires 2+ hits");
    } else if (line >= 2.5) {
      lineValueScore = 0.5;
      risks.push("High line - difficult to cover");
    }
  } else if (isHR) {
    lineValueScore = 1.0; // HRs are always volatile
    factors.push("Home run prop");
    risks.push("HRs are low-frequency (~3% per AB)");
    riskPenalty = 1.0; // Inherent volatility
  }

  // === ODDS VALUE SCORE ===
  // Calculate implied probability
  const impliedProb = bestOdds > 0
    ? 100 / (bestOdds + 100)
    : Math.abs(bestOdds) / (Math.abs(bestOdds) + 100);

  if (bestOdds >= -115 && bestOdds <= -100) {
    oddsValueScore = 2.0;
    factors.push(`Strong odds value (${bestOdds > 0 ? "+" : ""}${bestOdds})`);
  } else if (bestOdds > 0 && bestOdds <= 130) {
    oddsValueScore = 1.5;
    factors.push(`Plus-money odds (${bestOdds > 0 ? "+" : ""}${bestOdds})`);
  } else if (bestOdds >= -140 && bestOdds < -115) {
    oddsValueScore = 1.0;
    factors.push("Standard juice");
  } else if (bestOdds < -150) {
    oddsValueScore = 0;
    riskPenalty += 0.5;
    risks.push(`Heavy juice (${bestOdds}) reduces value`);
  } else if (bestOdds > 130) {
    oddsValueScore = 0.5;
    risks.push("Long odds - lower expected hit rate");
  }

  // === EDGE SCORE ===
  const edgeNum = parseFloat(edge) || 0;
  if (edgeNum >= 5) {
    edgeScore = 1.5;
    factors.push(`${edgeNum.toFixed(1)}% edge vs implied odds`);
  } else if (edgeNum >= 2) {
    edgeScore = 1.0;
    factors.push(`${edgeNum.toFixed(1)}% edge`);
  } else if (edgeNum >= 0) {
    edgeScore = 0.5;
  } else {
    // Negative edge
    riskPenalty += 0.5;
    risks.push("Negative edge vs market");
  }

  // === MLB CONTEXT SCORE (from MLB Stats API) ===
  // Lineup position bonus (top of order = more ABs) - AMPLIFIED for differentiation
  if (lineupSpot) {
    if (lineupSpot <= 2) {
      contextScore += 1.5; // Top 2 get extra boost
      factors.push(`Batting ${lineupSpot}${lineupSpot === 1 ? "st" : "nd"} - premium spot`);
    } else if (lineupSpot === 3) {
      contextScore += 1.2;
      factors.push("Batting 3rd - cleanup vicinity");
    } else if (lineupSpot <= 5) {
      contextScore += 0.6;
      factors.push(`Batting ${lineupSpot}th - middle of order`);
    } else if (lineupSpot >= 7) {
      riskPenalty += 0.6; // Stronger penalty for bottom of order
      risks.push(`Batting ${lineupSpot}th - fewer ABs expected`);
    }
  }

  // Handedness matchup bonus - AMPLIFIED
  if (batSide && pitcherHand) {
    const hasAdvantage =
      (batSide === "L" && pitcherHand === "R") ||
      (batSide === "R" && pitcherHand === "L") ||
      batSide === "S"; // Switch hitters always have advantage

    if (hasAdvantage) {
      contextScore += 0.8; // Increased from 0.5
      factors.push(handednessMatchup || `${batSide === "S" ? "Switch-hitter" : "Platoon"} advantage`);
    } else {
      // Same-side matchup (disadvantage)
      riskPenalty += 0.5; // Increased from 0.3
      risks.push(handednessMatchup || "Same-side pitcher matchup");
    }
  }

  // === RECENT PERFORMANCE SCORE === AMPLIFIED
  if (avgLast5 !== null) {
    if (isBatterHot) {
      contextScore += 1.5; // Increased from 1.0
      factors.push(`Hot bat - .${(avgLast5 * 1000).toFixed(0)} last 5 games`);
    } else if (isBatterCold) {
      riskPenalty += 1.0; // Increased from 0.5
      risks.push(`Cold bat - .${(avgLast5 * 1000).toFixed(0)} last 5 games`);
    } else if (avgLast5 >= 0.280) {
      contextScore += 0.5;
      factors.push(`Solid recent - .${(avgLast5 * 1000).toFixed(0)} last 5`);
    } else if (avgLast5 < 0.220) {
      riskPenalty += 0.4;
      risks.push(`Struggling - .${(avgLast5 * 1000).toFixed(0)} last 5`);
    }

    if (batterTrend === "heating up") {
      contextScore += 0.5; // Increased from 0.3
      factors.push("Trending up");
    } else if (batterTrend === "cooling off") {
      riskPenalty += 0.4; // Increased from 0.2
      risks.push("Trending down");
    }
  }

  // === PITCHER QUALITY SCORE === AMPLIFIED
  if (pitcherQuality && pitcherQuality !== "unknown") {
    if (isPitcherStruggling) {
      contextScore += 1.2; // Increased from 0.8
      factors.push(`vs ${pitcherQuality} pitcher (${pitcherERA?.toFixed(2)} ERA)`);
    } else if (isPitcherElite) {
      riskPenalty += 1.0; // Increased from 0.6
      risks.push(`vs ${pitcherQuality} pitcher (${pitcherERA?.toFixed(2)} ERA)`);
    } else if (pitcherQuality === "average") {
      // Neutral - no adjustment
      factors.push(`vs average pitcher (${pitcherERA?.toFixed(2)} ERA)`);
    }
  }

  // === CALCULATE FINAL SCORE ===
  // Base 5.0 + components - penalties
  const rawScore = 5.0 + lineValueScore + oddsValueScore + edgeScore + contextScore - riskPenalty;
  const heaterScore = Math.min(10, Math.max(1, Math.round(rawScore * 10) / 10));

  // Confidence based on data quality (we have: line, odds, edge)
  // Higher confidence when factors align
  const confidence = Math.min(10, Math.max(1, Math.round(
    5 + (factors.length * 0.8) - (risks.length * 0.5)
  )));

  // === GENERATE OUTPUT ===
  const propLabel = isHits ? "hits" : "home runs";
  const lineLabel = line === 0.5 ? "0.5+" : `${line}+`;

  // Build writeup with real context
  let writeup = `${playerName} ${lineLabel} ${propLabel} at ${bestOdds > 0 ? "+" : ""}${bestOdds}. `;

  // Add recent performance and hit rate
  if (last10HitRate) {
    writeup += `Hit rate L10: ${last10HitRate}. `;
  } else if (avgLast5 !== null && hitsLast5 != null) {
    writeup += `${hitsLast5} hits in last 5 (.${(avgLast5 * 1000).toFixed(0)}). `;
  }

  // Add pitcher context
  if (opposingPitcher) {
    let pitcherInfo = `vs ${opposingPitcher}`;
    if (pitcherERA) pitcherInfo += ` (${pitcherERA.toFixed(2)} ERA)`;
    else if (pitcherHand) pitcherInfo += ` (${pitcherHand}HP)`;
    writeup += pitcherInfo + ". ";
  }

  if (factors.length > 0) {
    writeup += factors[0] + ".";
  }

  const keyFactor = factors.length > 0 ? factors[0] : "Standard line";
  const riskReason = risks.length > 0 ? risks.join(". ") : "Normal variance";

  // === TIER LABEL based on final score ===
  // Block Top Pick/Strong if negative edge (strict +EV requirement)
  let tier;
  if (edgeNum <= 0) {
    // Negative edge = cannot be Top Pick or Strong regardless of heaterScore
    tier = heaterScore >= 7.0 ? "Value" : "Risky";
  } else if (heaterScore >= 9.0) {
    tier = "Top Pick";
  } else if (heaterScore >= 8.0) {
    tier = "Strong";
  } else if (heaterScore >= 7.0) {
    tier = "Value";
  } else {
    tier = "Risky";
  }

  // Compute hitRateLast10 as numeric for UI (e.g., 7 from "7/10")
  const hitRateLast10 = last10HitRate ? parseInt(last10HitRate.split("/")[0], 10) : null;

  return {
    heaterScore,
    confidence,
    tier, // Easy label for quick identification (blocked for negative edge)
    writeup,
    keyFactor,
    keyFactors: factors,
    riskReason,
    whatCouldGoWrong: riskReason,
    // Hit rate context
    last10HitRate, // e.g., "7/10"
    last10Results, // e.g., "HHMHHMHHHM"
    hitRateLast10, // numeric for UI (e.g., 7)
    // Score breakdown for transparency
    scoreBreakdown: {
      base: 5.0,
      lineValue: lineValueScore,
      oddsValue: oddsValueScore,
      edge: edgeScore,
      context: contextScore,
      riskPenalty: -riskPenalty,
    },
  };
}

// Score NBA points props using NBA-specific factors
// Inputs: line difficulty, odds value, edge, position context, home/away
function scoreNBAProp(prop, bestOdds, edge) {
  const line = prop.line || 0.5;
  const playerName = prop.playerName || "Player";
  const propType = prop.propType || prop.marketKey || "";
  const oddsArray = prop.odds || [];

  // NBA context from Underdog
  const position = prop.position;
  const isHome = prop.isHome;
  const matchup = prop.matchup;

  // Score components
  let lineValueScore = 0;
  let oddsValueScore = 0;
  let edgeScore = 0;
  let contextScore = 0;
  let riskPenalty = 0;

  const factors = [];
  const risks = [];

  // === LINE VALUE SCORE (NBA-specific thresholds) ===
  const isPoints = propType.includes("Points") || propType === "player_points";

  if (isPoints) {
    // Role player lines (under 16) are easier to hit
    if (line <= 15.5) {
      lineValueScore = 2.0;
      factors.push(`Low line (${line}) - role player threshold`);
    }
    // Starter lines (16-22) are moderate
    else if (line <= 22.5) {
      lineValueScore = 1.5;
      factors.push(`Starter line (${line})`);
    }
    // Star lines (23-29) are standard for top players
    else if (line <= 29.5) {
      lineValueScore = 1.0;
      factors.push(`Star scorer line (${line})`);
    }
    // Superstar lines (30+) require elite performance
    else {
      lineValueScore = 0.5;
      risks.push(`Elite line (${line}) - needs 30+ point game`);
      riskPenalty = 0.5;
    }
  }

  // === ODDS VALUE SCORE ===
  if (bestOdds >= -115 && bestOdds <= -100) {
    oddsValueScore = 2.0;
    factors.push(`Strong odds value (${bestOdds > 0 ? "+" : ""}${bestOdds})`);
  } else if (bestOdds > 0 && bestOdds <= 130) {
    oddsValueScore = 1.5;
    factors.push(`Plus-money odds (${bestOdds > 0 ? "+" : ""}${bestOdds})`);
  } else if (bestOdds >= -140 && bestOdds < -115) {
    oddsValueScore = 1.0;
    factors.push("Standard juice");
  } else if (bestOdds < -150) {
    oddsValueScore = 0;
    riskPenalty += 0.5;
    risks.push(`Heavy juice (${bestOdds}) reduces value`);
  } else if (bestOdds > 130) {
    oddsValueScore = 0.5;
    risks.push("Long odds - lower expected hit rate");
  }

  // === EDGE SCORE ===
  const edgeNum = parseFloat(edge) || 0;
  if (edgeNum >= 5) {
    edgeScore = 1.5;
    factors.push(`${edgeNum.toFixed(1)}% edge vs implied odds`);
  } else if (edgeNum >= 2) {
    edgeScore = 1.0;
    factors.push(`${edgeNum.toFixed(1)}% edge`);
  } else if (edgeNum >= 0) {
    edgeScore = 0.5;
  } else {
    riskPenalty += 0.5;
    risks.push("Negative edge vs market");
  }

  // === NBA CONTEXT SCORING ===
  // Position bonus - guards and forwards typically score more consistently
  if (position) {
    const pos = position.toUpperCase();
    if (pos === "PG" || pos === "SG" || pos === "G") {
      contextScore += 0.5;
      factors.push(`Guard (${pos}) - primary scoring option`);
    } else if (pos === "SF" || pos === "F") {
      contextScore += 0.3;
      factors.push(`Forward (${pos}) - versatile scorer`);
    } else if (pos === "PF" || pos === "C") {
      // Centers have more variance in scoring
      risks.push(`Big man (${pos}) - scoring can be matchup dependent`);
      riskPenalty += 0.2;
    }
  }

  // Home court advantage (NBA home teams average ~3 more PPG)
  if (isHome === true) {
    contextScore += 0.5;
    factors.push("Home game - slight scoring boost");
  } else if (isHome === false) {
    risks.push("Road game");
    riskPenalty += 0.2;
  }

  // === CALCULATE FINAL SCORE ===
  const rawScore = 5.0 + lineValueScore + oddsValueScore + edgeScore + contextScore - riskPenalty;
  const heaterScore = Math.min(10, Math.max(1, Math.round(rawScore * 10) / 10));

  const confidence = Math.min(10, Math.max(1, Math.round(
    5 + (factors.length * 0.8) - (risks.length * 0.5)
  )));

  // === GENERATE OUTPUT ===
  const lineLabel = `${line}+`;
  let writeup = `${playerName} ${lineLabel} points at ${bestOdds > 0 ? "+" : ""}${bestOdds}. `;
  if (matchup) {
    writeup += `${matchup}. `;
  }
  if (factors.length > 0) {
    writeup += factors[0] + ".";
  }

  const keyFactor = factors.length > 0 ? factors[0] : "Standard line";
  const riskReason = risks.length > 0 ? risks.join(". ") : "Normal variance";

  // === TIER LABEL ===
  // Block Top Pick/Strong if negative edge (strict +EV requirement)
  let tier;
  if (edgeNum <= 0) {
    // Negative edge = cannot be Top Pick or Strong regardless of heaterScore
    tier = heaterScore >= 7.0 ? "Value" : "Risky";
  } else if (heaterScore >= 9.0) {
    tier = "Top Pick";
  } else if (heaterScore >= 8.0) {
    tier = "Strong";
  } else if (heaterScore >= 7.0) {
    tier = "Value";
  } else {
    tier = "Risky";
  }

  return {
    heaterScore,
    confidence,
    tier, // Easy label for quick identification (blocked for negative edge)
    writeup,
    keyFactor,
    keyFactors: factors,
    riskReason,
    whatCouldGoWrong: riskReason,
    scoreBreakdown: {
      base: 5.0,
      lineValue: lineValueScore,
      oddsValue: oddsValueScore,
      edge: edgeScore,
      context: contextScore,
      riskPenalty: -riskPenalty,
    },
  };
}

function getOddsApiKey() {
  for (let i = 1; i <= 10; i++) {
    const key = process.env[`ODDS_API_KEY_${i}`];
    if (key) return key;
  }
  return process.env.ODDS_API_KEY || null;
}

// Fetch MLB props from Underdog Fantasy API with REAL context data
async function fetchMLBPropsFromUnderdog() {
  try {
    console.log("[Props] Fetching MLB props from Underdog Fantasy...");
    const res = await fetch("https://api.underdogfantasy.com/beta/v5/over_under_lines", {
      signal: AbortSignal.timeout(20000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) {
      console.warn(`[Props] Underdog API returned ${res.status}`);
      return [];
    }

    const data = await res.json();
    const lines = data.over_under_lines || [];
    console.log(`[Props] Underdog returned ${lines.length} total prop lines`);

    // Build lookup tables for REAL context data
    const gamesById = {};
    for (const game of data.games || []) {
      gamesById[game.id] = game;
    }

    const appearancesById = {}
    for (const app of data.appearances || []) {
      appearancesById[app.id] = app;
    }

    const mlbProps = [];

    for (const line of lines) {
      const options = line.options || [];
      if (options.length < 1) continue;

      const subheader = options[0].selection_subheader || "";
      const playerName = options[0].selection_header || "";

      // Get REAL game context via appearance linking
      const appearanceId = line.over_under?.appearance_stat?.appearance_id;
      const appearance = appearancesById[appearanceId];
      const game = appearance ? gamesById[appearance.match_id] : null;

      // Extract real matchup info
      const matchup = game?.abbreviated_title || null; // e.g., "NYY @ BOS"
      const fullMatchup = game?.full_team_names_title || null;
      const gameTime = game?.match_progress || null; // e.g., "Fri 07:00pm"

      // Filter for MLB Home Runs (exact match, not combos, must be MLB game)
      if (game?.sport_id === "MLB" && subheader.includes("Home Run") && !subheader.includes("+")) {
        const overOdds = options[0]?.american_price;

        mlbProps.push({
          id: `underdog_hr_${line.id || playerName}`,
          sport: "MLB",
          eventId: line.id,
          homeTeam: game?.abbreviated_title?.split(" @ ")[1] || "MLB",
          awayTeam: game?.abbreviated_title?.split(" @ ")[0] || "Away",
          commenceTime: new Date().toISOString(),
          playerName,
          propType: "Home Runs",
          marketKey: "batter_home_runs",
          line: parseFloat(line.stat_value) || 0.5,
          overUnder: "Over",
          odds: [{ bookmaker: "Underdog", price: parseInt(overOdds) || -110 }],
          // REAL context fields
          matchup,
          fullMatchup,
          gameTime,
        });
      }

      // Filter for MLB Hits (not combos, only 0.5 or 1.5 lines, must be MLB game)
      if (game?.sport_id === "MLB" && subheader.includes("Hits") && !subheader.includes("+")) {
        const hitLine = parseFloat(line.stat_value) || 0.5;

        if (hitLine === 0.5 || hitLine === 1.5) {
          const overOdds = options[0]?.american_price;

          mlbProps.push({
            id: `underdog_hit_${line.id || playerName}`,
            sport: "MLB",
            eventId: line.id,
            homeTeam: game?.abbreviated_title?.split(" @ ")[1] || "MLB",
            awayTeam: game?.abbreviated_title?.split(" @ ")[0] || "Away",
            commenceTime: new Date().toISOString(),
            playerName,
            propType: "Hits",
            marketKey: "batter_hits",
            line: hitLine,
            overUnder: "Over",
            odds: [{ bookmaker: "Underdog", price: parseInt(overOdds) || -110 }],
            // REAL context fields
            matchup,
            fullMatchup,
            gameTime,
          });
        }
      }
    }

    const hrCount = mlbProps.filter((p) => p.marketKey === "batter_home_runs").length;
    const hitCount = mlbProps.filter((p) => p.marketKey === "batter_hits").length;
    const withContext = mlbProps.filter((p) => p.matchup).length;
    console.log(`[Props] Parsed ${hrCount} HR, ${hitCount} Hit props (${withContext} with matchup context)`);

    // Enrich with MLB Stats API data (pitcher, lineup, handedness)
    const enrichedProps = await enrichMLBProps(mlbProps);
    return enrichedProps;
  } catch (err) {
    console.error("[Props] Failed to fetch from Underdog:", err.message);
    return [];
  }
}

// Fetch NBA props from Underdog Fantasy API (same source as MLB for consistency)
async function fetchNBAPropsFromUnderdog() {
  try {
    console.log("[Props] Fetching NBA props from Underdog Fantasy...");
    const res = await fetch("https://api.underdogfantasy.com/beta/v5/over_under_lines", {
      signal: AbortSignal.timeout(20000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) {
      console.warn(`[Props] Underdog API returned ${res.status}`);
      return [];
    }

    const data = await res.json();
    const lines = data.over_under_lines || [];

    // Build lookup tables for context data
    const gamesById = {};
    for (const game of data.games || []) {
      gamesById[game.id] = game;
    }

    const appearancesById = {};
    for (const app of data.appearances || []) {
      appearancesById[app.id] = app;
    }

    const playersById = {};
    for (const player of data.players || []) {
      playersById[player.id] = player;
    }

    const nbaProps = [];

    // Map Underdog stat names to our market keys
    const nbaStatMap = {
      "Points": { marketKey: "player_points", propType: "Points", idPrefix: "pts" },
      "Rebounds": { marketKey: "player_rebounds", propType: "Rebounds", idPrefix: "reb" },
      "Assists": { marketKey: "player_assists", propType: "Assists", idPrefix: "ast" },
      "3-Pointers Made": { marketKey: "player_threes", propType: "3-Pointers", idPrefix: "3pt" },
      "Blocks": { marketKey: "player_blocks", propType: "Blocks", idPrefix: "blk" },
      "Steals": { marketKey: "player_steals", propType: "Steals", idPrefix: "stl" },
    };

    for (const line of lines) {
      const options = line.options || [];
      if (options.length < 1) continue;

      const subheader = options[0].selection_subheader || "";
      const playerName = options[0].selection_header || "";

      // Get game context via appearance linking
      const appearanceId = line.over_under?.appearance_stat?.appearance_id;
      const appearance = appearancesById[appearanceId];
      const game = appearance ? gamesById[appearance.match_id] : null;

      // Must be NBA game and not a combo prop
      if (game?.sport_id !== "NBA" || subheader.includes("+")) continue;

      // Match stat type from subheader (e.g., "Higher 28.5 Points" -> "Points")
      let matchedStat = null;
      for (const statName of Object.keys(nbaStatMap)) {
        if (subheader.endsWith(` ${statName}`)) {
          matchedStat = nbaStatMap[statName];
          break;
        }
      }
      if (!matchedStat) continue;

      const overOdds = options[0]?.american_price;
      const statLine = parseFloat(line.stat_value) || 0;

      // Get player info for context
      const playerId = appearance?.player_id;
      const player = playerId ? playersById[playerId] : null;
      const position = player?.position || null;

      // Extract matchup info
      const matchup = game?.abbreviated_title || null;
      const gameTime = game?.match_progress || null;

      // Determine if home or away based on appearance
      const teamId = appearance?.team_id;
      const isHome = game?.home_team_id === teamId;

      nbaProps.push({
        id: `underdog_${matchedStat.idPrefix}_${line.id || playerName}`,
        sport: "NBA",
        eventId: line.id,
        homeTeam: matchup?.split(" @ ")[1] || "NBA",
        awayTeam: matchup?.split(" @ ")[0] || "Away",
        commenceTime: new Date().toISOString(),
        playerName,
        propType: matchedStat.propType,
        marketKey: matchedStat.marketKey,
        line: statLine,
        overUnder: "Over",
        odds: [{ bookmaker: "Underdog", price: parseInt(overOdds) || -110 }],
        // Context fields (NBA-specific)
        matchup,
        gameTime,
        position,
        isHome,
      });
    }

    const statCounts = {};
    for (const p of nbaProps) {
      statCounts[p.propType] = (statCounts[p.propType] || 0) + 1;
    }
    console.log(`[Props] Parsed ${nbaProps.length} NBA props from Underdog:`, statCounts);

    // Enrich with ESPN game context (matchup, time)
    const enrichedProps = await enrichNBAProps(nbaProps);
    return enrichedProps;
  } catch (err) {
    console.error("[Props] Failed to fetch NBA from Underdog:", err.message);
    return [];
  }
}

// Fetch NHL props from Underdog Fantasy API
async function fetchNHLPropsFromUnderdog() {
  try {
    console.log("[Props] Fetching NHL props from Underdog Fantasy...");
    const res = await fetch("https://api.underdogfantasy.com/beta/v5/over_under_lines", {
      signal: AbortSignal.timeout(20000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) {
      console.warn(`[Props] Underdog API returned ${res.status}`);
      return [];
    }

    const data = await res.json();
    const lines = data.over_under_lines || [];

    // Build lookup tables for context data
    const gamesById = {};
    for (const game of data.games || []) {
      gamesById[game.id] = game;
    }

    const appearancesById = {};
    for (const app of data.appearances || []) {
      appearancesById[app.id] = app;
    }

    const playersById = {};
    for (const player of data.players || []) {
      playersById[player.id] = player;
    }

    const nhlProps = [];

    // Map Underdog stat names to our market keys
    const nhlStatMap = {
      "Goals": { marketKey: "player_goals", propType: "Goals", idPrefix: "goals" },
      "Assists": { marketKey: "player_assists", propType: "Assists", idPrefix: "ast" },
      "Shots on Goal": { marketKey: "player_shots_on_goal", propType: "Shots on Goal", idPrefix: "sog" },
      "Shots on Target": { marketKey: "player_shots_on_goal", propType: "Shots on Goal", idPrefix: "sog" },
      "Blocked Shots": { marketKey: "player_blocked_shots", propType: "Blocked Shots", idPrefix: "blk" },
    };

    for (const line of lines) {
      const options = line.options || [];
      if (options.length < 1) continue;

      const subheader = options[0].selection_subheader || "";
      const playerName = options[0].selection_header || "";

      // Get game context via appearance linking
      const appearanceId = line.over_under?.appearance_stat?.appearance_id;
      const appearance = appearancesById[appearanceId];
      const game = appearance ? gamesById[appearance.match_id] : null;

      // Must be NHL game and not a combo prop
      if (game?.sport_id !== "NHL" || subheader.includes("+")) continue;

      // Match stat type from subheader
      let matchedStat = null;
      for (const statName of Object.keys(nhlStatMap)) {
        if (subheader.endsWith(` ${statName}`)) {
          matchedStat = nhlStatMap[statName];
          break;
        }
      }
      if (!matchedStat) continue;

      const overOdds = options[0]?.american_price;
      const statLine = parseFloat(line.stat_value) || 0.5;

      // Get player info for context
      const playerId = appearance?.player_id;
      const player = playerId ? playersById[playerId] : null;
      const position = player?.position || null;

      // Extract matchup info
      const matchup = game?.abbreviated_title || null;
      const gameTime = game?.match_progress || null;

      nhlProps.push({
        id: `underdog_${matchedStat.idPrefix}_${line.id || playerName}`,
        sport: "NHL",
        eventId: line.id,
        homeTeam: matchup?.split(" @ ")[1] || "NHL",
        awayTeam: matchup?.split(" @ ")[0] || "Away",
        commenceTime: new Date().toISOString(),
        playerName,
        propType: matchedStat.propType,
        marketKey: matchedStat.marketKey,
        line: statLine,
        overUnder: "Over",
        odds: [{ bookmaker: "Underdog", price: parseInt(overOdds) || -110 }],
        // Context fields
        matchup,
        gameTime,
        position,
      });
    }

    const statCounts = {};
    for (const p of nhlProps) {
      statCounts[p.propType] = (statCounts[p.propType] || 0) + 1;
    }
    console.log(`[Props] Parsed ${nhlProps.length} NHL props from Underdog:`, statCounts);
    return nhlProps;
  } catch (err) {
    console.error("[Props] Failed to fetch NHL from Underdog:", err.message);
    return [];
  }
}

// Fetch MLB props from PrizePicks API (stub - graceful failure expected)
// PrizePicks uses PerimeterX bot protection, so server-side requests will likely fail
async function fetchMLBPropsFromPrizePicks() {
  try {
    console.log("[Props] Attempting PrizePicks MLB fetch (may be blocked)...");
    const res = await fetch(
      "https://api.prizepicks.com/projections?league_id=2&per_page=250&single_stat=true&game_mode=pickem",
      {
        signal: AbortSignal.timeout(10000),
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json",
        },
      }
    );

    if (!res.ok) {
      console.log(`[Props] PrizePicks blocked (${res.status}) - using Underdog only`);
      return [];
    }

    const data = await res.json();
    const projections = data.data || [];
    const included = data.included || [];

    // Build lookup for players and games
    const playersById = {};
    const gamesById = {};
    for (const item of included) {
      if (item.type === "new_player") playersById[item.id] = item;
      if (item.type === "projection_game") gamesById[item.id] = item;
    }

    const mlbProps = [];
    for (const proj of projections) {
      const attrs = proj.attributes || {};
      const statType = attrs.stat_type || "";
      const line = parseFloat(attrs.line_score) || 0;

      // Only process hits and home runs
      if (!statType.includes("Hits") && !statType.includes("Home Run")) continue;

      const playerId = proj.relationships?.new_player?.data?.id;
      const player = playersById[playerId];
      const playerName = player?.attributes?.name || "Unknown";
      const team = player?.attributes?.team || "";

      const gameId = proj.relationships?.projection_game?.data?.id;
      const game = gamesById[gameId];
      const opponent = game?.attributes?.away_team === team
        ? game?.attributes?.home_team
        : game?.attributes?.away_team || "";

      const isHR = statType.includes("Home Run");
      mlbProps.push({
        id: `prizepicks_${proj.id}`,
        sport: "MLB",
        eventId: proj.id,
        homeTeam: game?.attributes?.home_team || "MLB",
        awayTeam: game?.attributes?.away_team || "Away",
        commenceTime: game?.attributes?.start_time || new Date().toISOString(),
        playerName,
        propType: isHR ? "Home Runs" : "Hits",
        marketKey: isHR ? "batter_home_runs" : "batter_hits",
        line,
        overUnder: "Over",
        odds: [{ bookmaker: "PrizePicks", price: -110 }], // PrizePicks doesn't show odds
        matchup: `${game?.attributes?.away_team || "AWY"} @ ${game?.attributes?.home_team || "HOM"}`,
        source: "PrizePicks",
      });
    }

    console.log(`[Props] PrizePicks returned ${mlbProps.length} MLB props`);
    return mlbProps;
  } catch (err) {
    console.log(`[Props] PrizePicks fetch failed: ${err.message} - using Underdog only`);
    return [];
  }
}

// Fetch NBA props from PrizePicks API (stub - graceful failure expected)
async function fetchNBAPropsFromPrizePicks() {
  try {
    console.log("[Props] Attempting PrizePicks NBA fetch (may be blocked)...");
    const res = await fetch(
      "https://api.prizepicks.com/projections?league_id=7&per_page=250&single_stat=true&game_mode=pickem",
      {
        signal: AbortSignal.timeout(10000),
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json",
        },
      }
    );

    if (!res.ok) {
      console.log(`[Props] PrizePicks NBA blocked (${res.status}) - using Underdog only`);
      return [];
    }

    const data = await res.json();
    const projections = data.data || [];
    const included = data.included || [];

    // Build lookup for players and games
    const playersById = {};
    const gamesById = {};
    for (const item of included) {
      if (item.type === "new_player") playersById[item.id] = item;
      if (item.type === "projection_game") gamesById[item.id] = item;
    }

    const nbaProps = [];
    for (const proj of projections) {
      const attrs = proj.attributes || {};
      const statType = attrs.stat_type || "";
      const line = parseFloat(attrs.line_score) || 0;

      // Only process points props
      if (!statType.includes("Points") || statType.includes("+")) continue;

      const playerId = proj.relationships?.new_player?.data?.id;
      const player = playersById[playerId];
      const playerName = player?.attributes?.name || "Unknown";
      const team = player?.attributes?.team || "";

      const gameId = proj.relationships?.projection_game?.data?.id;
      const game = gamesById[gameId];

      nbaProps.push({
        id: `prizepicks_nba_${proj.id}`,
        sport: "NBA",
        eventId: proj.id,
        homeTeam: game?.attributes?.home_team || "NBA",
        awayTeam: game?.attributes?.away_team || "Away",
        commenceTime: game?.attributes?.start_time || new Date().toISOString(),
        playerName,
        propType: "Points",
        marketKey: "player_points",
        line,
        overUnder: "Over",
        odds: [{ bookmaker: "PrizePicks", price: -110 }],
        matchup: `${game?.attributes?.away_team || "AWY"} @ ${game?.attributes?.home_team || "HOM"}`,
        source: "PrizePicks",
      });
    }

    console.log(`[Props] PrizePicks returned ${nbaProps.length} NBA props`);
    return nbaProps;
  } catch (err) {
    console.log(`[Props] PrizePicks NBA fetch failed: ${err.message} - using Underdog only`);
    return [];
  }
}

// Fetch ALL props for a sport in ONE call
async function fetchAllPropsForSport(sportKey, apiKey) {
  // Use Underdog + PrizePicks for MLB and NBA props (merge sources)
  if (sportKey === "mlb") {
    const [underdogProps, prizePicksProps] = await Promise.all([
      fetchMLBPropsFromUnderdog(),
      fetchMLBPropsFromPrizePicks(),
    ]);
    // Merge: Underdog is primary, PrizePicks supplements
    const merged = [...underdogProps];
    // Add PrizePicks props that don't duplicate Underdog (by player + line)
    const existingKeys = new Set(underdogProps.map(p => `${p.playerName}_${p.line}_${p.marketKey}`));
    for (const prop of prizePicksProps) {
      const key = `${prop.playerName}_${prop.line}_${prop.marketKey}`;
      if (!existingKeys.has(key)) {
        merged.push(prop);
      }
    }
    console.log(`[Props] Merged ${underdogProps.length} Underdog + ${prizePicksProps.length} PrizePicks = ${merged.length} total MLB props`);
    return merged;
  }
  if (sportKey === "nba") {
    const [underdogProps, prizePicksProps] = await Promise.all([
      fetchNBAPropsFromUnderdog(),
      fetchNBAPropsFromPrizePicks(),
    ]);
    const merged = [...underdogProps];
    const existingKeys = new Set(underdogProps.map(p => `${p.playerName}_${p.line}_${p.marketKey}`));
    for (const prop of prizePicksProps) {
      const key = `${prop.playerName}_${prop.line}_${prop.marketKey}`;
      if (!existingKeys.has(key)) {
        merged.push(prop);
      }
    }
    console.log(`[Props] Merged ${underdogProps.length} Underdog + ${prizePicksProps.length} PrizePicks = ${merged.length} total NBA props`);
    return merged;
  }
  if (sportKey === "nhl") {
    // Use Underdog for NHL props (goals)
    return await fetchNHLPropsFromUnderdog();
  }

  const config = SPORT_CONFIG[sportKey];
  if (!config) return [];

  // Collect all unique markets for this sport
  const allMarkets = [...new Set(config.categories.flatMap((c) => c.markets))];

  try {
    const url = `https://api.the-odds-api.com/v4/sports/${config.oddsKey}/odds?apiKey=${apiKey}&bookmakers=fanduel,draftkings&markets=${allMarkets.join(",")}&oddsFormat=american`;
    console.log(`[Props] Fetching ALL ${sportKey.toUpperCase()} props in one call...`);

    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.warn(`[Props] Odds API returned ${res.status} for ${sportKey}`);
      return [];
    }

    const events = await res.json();
    console.log(`[Props] Got ${events.length} ${sportKey.toUpperCase()} events`);

    const allProps = [];
    const now = new Date();

    for (const event of events) {
      const commenceTime = new Date(event.commence_time);
      // Skip games that have already started
      if (commenceTime <= now) continue;

      const homeTeam = event.home_team;
      const awayTeam = event.away_team;

      // Collect odds from multiple bookmakers
      const propsByPlayer = {};

      for (const bookmaker of event.bookmakers || []) {
        for (const market of bookmaker.markets || []) {
          const marketKey = market.key;

          for (const outcome of market.outcomes || []) {
            const playerName = outcome.description || outcome.name;
            if (!playerName || playerName === "Over" || playerName === "Under") continue;

            const propKey = `${event.id}_${marketKey}_${playerName}_${outcome.name}`;

            if (!propsByPlayer[propKey]) {
              // Format matchup string (e.g., "BOS @ LAL")
              const awayAbbrev = awayTeam?.split(" ").pop()?.substring(0, 3).toUpperCase() || "AWY";
              const homeAbbrev = homeTeam?.split(" ").pop()?.substring(0, 3).toUpperCase() || "HOM";
              const matchup = `${awayAbbrev} @ ${homeAbbrev}`;

              propsByPlayer[propKey] = {
                id: propKey,
                sport: sportKey.toUpperCase(),
                eventId: event.id,
                homeTeam,
                awayTeam,
                commenceTime: event.commence_time,
                playerName,
                propType: formatPropType(marketKey),
                marketKey,
                line: outcome.point || 0.5,
                overUnder: outcome.name?.toLowerCase().includes("under") ? "Under" : "Over",
                odds: [],
                matchup,
              };
            }

            // Add odds from this bookmaker
            propsByPlayer[propKey].odds.push({
              bookmaker: bookmaker.title,
              price: outcome.price,
            });
          }
        }
      }

      allProps.push(...Object.values(propsByPlayer));
    }

    console.log(`[Props] Parsed ${allProps.length} total props for ${sportKey.toUpperCase()}`);
    return allProps;
  } catch (err) {
    console.error(`[Props] Failed to fetch ${sportKey}:`, err.message);
    return [];
  }
}

function formatPropType(marketKey) {
  const mapping = {
    player_points: "Points",
    player_rebounds: "Rebounds",
    player_assists: "Assists",
    player_threes: "3-Pointers",
    batter_hits: "Hits",
    batter_total_bases: "Total Bases",
    batter_rbis: "RBIs",
    batter_home_runs: "Home Runs",
    pitcher_strikeouts: "Strikeouts",
    player_shots_on_goal: "Shots on Goal",
    player_goals: "Goals",
  };
  return mapping[marketKey] || marketKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getBestOdds(oddsArray) {
  if (!oddsArray || oddsArray.length === 0) return -110;
  // Find best (highest) odds
  return Math.max(...oddsArray.map((o) => o.price));
}

function organizeIntoCategories(allProps, sportKey) {
  const config = SPORT_CONFIG[sportKey];
  if (!config) return [];

  const categories = [];

  for (const category of config.categories) {
    // Filter props for this category
    let categoryProps = allProps.filter((prop) => {
      const marketMatch = category.markets.includes(prop.marketKey);
      const customFilter = category.filterFn ? category.filterFn(prop) : true;
      return marketMatch && customFilter;
    });

    // Add edge data and filter by minimum edge requirement
    categoryProps = addEdgeDataToProps(categoryProps);

    // Filter by minimum heater score for quality control (MLB and NBA)
    if (sportKey === "mlb" || sportKey === "nba") {
      const beforeCount = categoryProps.length;
      categoryProps = categoryProps.filter((p) => p.heaterScore >= MIN_HEATER_SCORE);
      if (beforeCount > 0 && categoryProps.length < beforeCount) {
        console.log(`[Props] Filtered ${beforeCount - categoryProps.length} weak ${category.name} (below ${MIN_HEATER_SCORE} score)`);
      }
    }

    // Sort by heaterScore (if available) or edge (highest first)
    categoryProps.sort((a, b) => {
      if (a.heaterScore && b.heaterScore) {
        return b.heaterScore - a.heaterScore;
      }
      return parseFloat(b.edge) - parseFloat(a.edge);
    });

    // Limit to max props for this category
    categoryProps = categoryProps.slice(0, category.maxProps);

    categories.push({
      id: category.id,
      name: category.name,
      sport: sportKey.toUpperCase(),
      props: categoryProps,
      error: categoryProps.length === 0 ? `No ${category.name.toLowerCase()} available today` : null,
    });
  }

  return categories;
}

// Add edge data to props and filter by minimum edge
function addEdgeDataToProps(props) {
  return props
    .map((prop) => {
      const bestOdds = getBestOdds(prop.odds);
      const impliedProb = calculateImpliedProbability(bestOdds);
      const modelProb = calculateModelProbability(prop.odds, prop.propType);
      const edge = parseFloat(calculateEdge(modelProb, impliedProb));

      // Single-source props (Underdog) can't have meaningful edge calculation
      const isSingleSource = prop.odds.length === 1;

      // Score props based on sport
      const isMLB = prop.sport === "MLB" || prop.marketKey?.includes("batter");
      const isNBA = prop.sport === "NBA" || prop.marketKey?.startsWith("player_");
      const isNHL = prop.sport === "NHL";
      let scoring = {};
      if (isMLB) {
        scoring = scoreMLBProp(prop, bestOdds, edge);
      } else if (isNBA || isNHL) {
        // Use NBA scoring for both NBA and NHL props (similar structure)
        scoring = scoreNBAProp(prop, bestOdds, edge);
      }

      return {
        ...prop,
        bestOdds,
        impliedProbability: (impliedProb * 100).toFixed(1),
        modelProbability: (modelProb * 100).toFixed(1),
        edge: edge.toFixed(1),
        hasEdge: isSingleSource || edge >= MIN_EDGE_PERCENT,
        ...scoring, // heaterScore, confidence, hitRateLast10, writeup, keyFactor, etc.
      };
    })
    .filter((prop) => prop.hasEdge);
}

async function getPropsForSport(sportKey, apiKey) {
  const config = SPORT_CONFIG[sportKey];
  if (!config) return [];

  const cache = propsCache[sportKey];
  const now = Date.now();

  // Check cache
  if (cache.data && now - cache.timestamp < config.cacheTTL) {
    console.log(`[Props] Using cached ${sportKey.toUpperCase()} props (${Math.round((now - cache.timestamp) / 60000)}min old)`);
    return cache.data;
  }

  // Fetch fresh props - ONE API call
  const allProps = await fetchAllPropsForSport(sportKey, apiKey);

  if (allProps.length === 0) {
    // Return categories with error messages when no data
    return config.categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      sport: sportKey.toUpperCase(),
      props: [],
      error: `DATA MISSING: No ${sportKey.toUpperCase()} ${cat.name.toLowerCase()} available - odds data not yet released`,
    }));
  }

  // Organize into categories with edge-based filtering
  const categories = organizeIntoCategories(allProps, sportKey);

  // Cache the results
  propsCache[sportKey] = { data: categories, timestamp: now };

  return categories;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sport = (searchParams.get("sport") || "mlb").toLowerCase();

  // Check auth
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) {
    return NextResponse.json({ error: "No email found", code: "NO_EMAIL" }, { status: 400 });
  }

  const isPaidUser = await hasActiveSubscription(email);
  const apiKey = getOddsApiKey();

  // Get props for requested sport(s)
  // MLB and NBA use Underdog (no API key needed), NHL needs Odds API
  const sportsToFetch = sport === "all" ? ["mlb", "nba", "nhl"] : [sport];
  const allCategories = [];

  for (const s of sportsToFetch) {
    if (!SPORT_CONFIG[s]) continue;
    // Skip NHL if no API key (it requires Odds API)
    if (s === "nhl" && !apiKey) {
      console.warn("[Props] Skipping NHL - no ODDS_API_KEY configured");
      continue;
    }
    const categories = await getPropsForSport(s, apiKey);
    allCategories.push(...categories);
  }

  // For free users, strip out edge analysis data (create copies to avoid mutating cache)
  if (!isPaidUser) {
    for (let i = 0; i < allCategories.length; i++) {
      const category = allCategories[i];
      allCategories[i] = {
        ...category,
        props: category.props.map((prop) => ({
          id: prop.id,
          sport: prop.sport,
          eventId: prop.eventId,
          homeTeam: prop.homeTeam,
          awayTeam: prop.awayTeam,
          commenceTime: prop.commenceTime,
          playerName: prop.playerName,
          propType: prop.propType,
          line: prop.line,
          overUnder: prop.overUnder,
          bestOdds: prop.bestOdds,
          // Strip: impliedProbability, modelProbability, edge, odds
        })),
      };
    }
  }

  const cache = propsCache[sport] || {};

  // Extract top 5 props across all categories (for paid users)
  // STRICT CRITERIA (same as Best Play):
  // - heaterScore >= 8.0
  // - edge > 0
  // - EV > 0
  // - confidence >= 7
  // - NOT injured out
  let top5 = [];
  if (isPaidUser) {
    // Flatten all props from all categories
    const allProps = allCategories.flatMap((cat) => cat.props || []);

    // Filter for quality props only (strict criteria, no negative EV)
    const qualityProps = allProps.filter((p) => {
      const score = p.heaterScore || 0;
      const edge = parseFloat(p.edge || 0);
      const ev = parseFloat(p.ev || 0);
      const conf = parseFloat(p.confidence || 0);
      const isOut = p.injuryStatus === "out";
      return score >= 8.0 && edge > 0 && ev > 0 && conf >= 7 && !isOut;
    });

    // Sort by heaterScore (desc), then edge (desc)
    const sorted = qualityProps.sort((a, b) => {
      // Primary: heaterScore (higher is better)
      const scoreDiff = (b.heaterScore || 0) - (a.heaterScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      // Secondary: edge (higher is better)
      return parseFloat(b.edge || 0) - parseFloat(a.edge || 0);
    });

    top5 = sorted.slice(0, 5);
    const outCount = allProps.filter((p) => p.injuryStatus === "out").length;
    console.log(`[Props] Top 5 (strict criteria): ${top5.length}/${allProps.length} qualify (heater>=8, edge>0, EV>0, conf>=7), ${outCount} OUT excluded`);
  }

  return NextResponse.json({
    top5,
    categories: allCategories,
    sport: sport.toUpperCase(),
    isPaidUser,
    edgeRequirement: `${MIN_EDGE_PERCENT}%`,
    cached: cache.data && Date.now() - cache.timestamp < (SPORT_CONFIG[sport]?.cacheTTL || 0),
    cacheAge: cache.timestamp ? Math.round((Date.now() - cache.timestamp) / 60000) : 0,
    totalProps: allCategories.reduce((sum, cat) => sum + (cat.props?.length || 0), 0),
  });
}
