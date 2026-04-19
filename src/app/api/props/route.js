import { NextResponse } from "next/server";
import { hasActiveSubscription } from "../../../lib/subscription";
import { enrichMLBProps } from "../../../lib/mlbStats";
import { enrichNBAProps } from "../../../lib/nbaStats";
import { enrichNHLProps } from "../../../lib/nhlStats";

export const maxDuration = 60;

// Minimum edge percentage required to show a prop (0 = show all props, sort by edge)
const MIN_EDGE_PERCENT = 0;

// Minimum heater score to display a prop (filters weak plays)
const MIN_HEATER_SCORE = 5.0;

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
        maxProps: 20,
        reliability: "low",
        filterFn: () => true,
      },
      {
        id: "hits",
        name: "Hit Props",
        markets: ["batter_hits"],
        maxProps: 30,
        reliability: "high",
        filterFn: (prop) => prop.overUnder === "Over",
      },
      {
        id: "walks",
        name: "Walk Props",
        markets: ["batter_walks"],
        maxProps: 20,
        reliability: "medium",
        filterFn: (prop) => prop.overUnder === "Over",
      },
      {
        id: "pitcher_strikeouts",
        name: "Pitcher Strikeout Props",
        markets: ["pitcher_strikeouts"],
        maxProps: 15,
        reliability: "medium",
        filterFn: (prop) => prop.overUnder === "Over",
      },
    ],
  },
  nhl: {
    oddsKey: "icehockey_nhl",
    cacheTTL: 30 * 60 * 1000,
    // NHL uses game-level grouping, not category-level
    // Allowed prop types: goals, assists, shots, points (NO blocked shots)
    allowedMarkets: ["player_goals", "player_assists", "player_shots_on_goal", "player_points"],
    maxPropsPerGame: 15, // Show top 10-20 props per game
    minHitRate: 5, // Prioritize props with >= 5/10 hit rate
    categories: [
      {
        id: "goals",
        name: "Goals",
        markets: ["player_goals"],
        maxProps: 10,
        reliability: "low",
        filterFn: () => true,
      },
      {
        id: "assists",
        name: "Assists",
        markets: ["player_assists"],
        maxProps: 10,
        reliability: "high",
        filterFn: () => true,
      },
      {
        id: "shots",
        name: "Shots on Goal",
        markets: ["player_shots_on_goal"],
        maxProps: 10,
        reliability: "high",
        filterFn: () => true,
      },
      {
        id: "points",
        name: "Points",
        markets: ["player_points"],
        maxProps: 10,
        reliability: "medium",
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
        reliability: "medium",
        filterFn: () => true,
      },
      {
        id: "rebounds",
        name: "Rebounds",
        markets: ["player_rebounds"],
        maxProps: 10,
        reliability: "high",
        filterFn: () => true,
      },
      {
        id: "assists",
        name: "Assists",
        markets: ["player_assists"],
        maxProps: 10,
        reliability: "high",
        filterFn: () => true,
      },
      {
        id: "threes",
        name: "3-Pointers",
        markets: ["player_threes"],
        maxProps: 10,
        reliability: "low",
        filterFn: () => true,
      },
      {
        id: "blocks",
        name: "Blocks",
        markets: ["player_blocks"],
        maxProps: 8,
        reliability: "low",
        filterFn: () => true,
      },
      {
        id: "steals",
        name: "Steals",
        markets: ["player_steals"],
        maxProps: 8,
        reliability: "low",
        filterFn: () => true,
      },
    ],
  },
};

// Cache per sport - stores all props for the day
// NHL_CACHE_VERSION: increment when NHL data structure changes (e.g., line normalization)
const NHL_CACHE_VERSION = 2;
const propsCache = {
  mlb: { data: null, timestamp: 0 },
  nba: { data: null, timestamp: 0 },
  nhl: { data: null, timestamp: 0, version: 0 },
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

// Calculate single-prop EV (expected profit per $1 wagered) from model probability and best American odds
function calculateSinglePropEV(modelProb, bestOdds) {
  const decimalOdds = bestOdds > 0 ? 1 + bestOdds / 100 : 1 + 100 / Math.abs(bestOdds);
  const ev = (modelProb * decimalOdds) - 1;
  return (ev * 100).toFixed(1);
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
    const isWalks = propType.includes("Walks") || propType === "batter_walks";
    const isK = propType.includes("Strikeout") || propType === "pitcher_strikeouts";

    const results = last10Games.map((g) => {
      let statValue;
      if (isHR) statValue = g.homeRuns;
      else if (isWalks) statValue = g.walks;
      else if (isK) statValue = g.strikeouts;
      else statValue = g.hits;
      return (statValue || 0) >= line ? "H" : "M"; // Hit or Miss
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
  const isWalks = propType.includes("Walks") || propType === "batter_walks";
  const isK = propType.includes("Strikeout") || propType === "pitcher_strikeouts";

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
  } else if (isWalks) {
    if (line === 0.5) {
      lineValueScore = 2.0;
      factors.push("0.5 line - any walk counts");
    } else if (line === 1.5) {
      lineValueScore = 1.0;
      factors.push("1.5 line - needs 2+ walks");
      risks.push("Multiple walks less common");
    } else if (line >= 2.5) {
      lineValueScore = 0.5;
      risks.push("High walk line - difficult to cover");
    }
  } else if (isK) {
    if (line <= 4.5) {
      lineValueScore = 2.5;
      factors.push(`${line} Ks - low threshold for starters`);
    } else if (line <= 5.5) {
      lineValueScore = 2.0;
      factors.push(`${line} Ks - moderate threshold`);
    } else if (line <= 6.5) {
      lineValueScore = 1.5;
      factors.push(`${line} Ks - standard starter line`);
    } else if (line <= 7.5) {
      lineValueScore = 1.0;
      factors.push(`${line} Ks - above average required`);
    } else {
      lineValueScore = 0.5;
      risks.push("High K line - requires dominant outing");
    }
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
  const isSingleSource = (prop.odds || []).length === 1;
  if (edgeNum >= 5) {
    edgeScore = 1.5;
    factors.push(`${edgeNum.toFixed(1)}% edge vs implied odds`);
  } else if (edgeNum >= 2) {
    edgeScore = 1.0;
    factors.push(`${edgeNum.toFixed(1)}% edge`);
  } else if (edgeNum >= 0) {
    edgeScore = 0.5;
  } else if (!isSingleSource) {
    // Only penalize negative edge for multi-source props (meaningful comparison)
    riskPenalty += 0.5;
    risks.push("Negative edge vs market");
  }
  // Single-source props: no edge penalty (edge calc not meaningful with one bookmaker)

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
  const propLabel = isK ? "Ks" : isWalks ? "BB" : isHits ? "hits" : "home runs";
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
  // Block Top Pick/Strong/Value if negative edge (strict +EV requirement)
  let tier;
  if (edgeNum <= 0) {
    // Negative edge = always Risky (Value requires positive edge)
    tier = "Risky";
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

  // Calculate hit/miss rate from last10Games (same structure as MLB)
  // Supports both NBA (points, rebounds, assists) and NHL (goals, assists, shots)
  const last10Games = prop.last10Games || [];
  let last10HitRate = null;
  let last10Results = null;
  if (last10Games.length > 0) {
    // NBA prop types
    const isPoints = propType.includes("Points") || propType === "player_points";
    const isRebounds = propType.includes("Rebounds") || propType === "player_rebounds";
    const isAssists = propType.includes("Assists") || propType === "player_assists";
    const isBlocks = propType.includes("Blocks") || propType === "player_blocks";
    const isSteals = propType.includes("Steals") || propType === "player_steals";
    const isThrees = propType.includes("3-Pointer") || propType === "player_threes";
    // NHL prop types
    const isGoals = propType.includes("Goals") || propType === "player_goals";
    const isShots = propType.includes("Shots") || propType === "player_shots_on_goal";

    const results = last10Games.map((g) => {
      let statValue = 0;
      // NBA stats
      if (isPoints) statValue = g.points || 0;
      else if (isRebounds) statValue = g.rebounds || 0;
      else if (isBlocks) statValue = g.blocks || 0;
      else if (isSteals) statValue = g.steals || 0;
      else if (isThrees) statValue = g.threes || 0;
      // NHL stats (goals, assists also used for NHL)
      else if (isGoals) statValue = g.goals || 0;
      else if (isShots) statValue = g.shots || 0;
      // Assists works for both NBA and NHL
      else if (isAssists) statValue = g.assists || 0;
      // Default fallback
      else statValue = g.points || g.goals || 0;
      return statValue >= line ? "H" : "M";
    });

    const hitCount = results.filter((r) => r === "H").length;
    const totalGames = results.length;
    last10HitRate = `${hitCount}/${totalGames}`;
    last10Results = results.join("");
  }

  // Score components
  let lineValueScore = 0;
  let oddsValueScore = 0;
  let edgeScore = 0;
  let contextScore = 0;
  let riskPenalty = 0;

  const factors = [];
  const risks = [];

  // === LINE VALUE SCORE (NBA/NHL-specific thresholds) ===
  const isPoints = propType.includes("Points") || propType === "player_points";
  const isBlocks = propType.includes("Blocks") || propType === "player_blocks";
  const isSteals = propType.includes("Steals") || propType === "player_steals";
  const isRebounds = propType.includes("Rebounds") || propType === "player_rebounds";
  const isAssistsType = propType.includes("Assists") || propType === "player_assists";
  const isGoals = propType.includes("Goals") || propType === "player_goals";
  const isShots = propType.includes("Shots") || propType === "player_shots_on_goal";

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
  } else if (isBlocks) {
    // Blocks scoring - lower lines are easier
    if (line <= 1.5) {
      lineValueScore = 2.0;
      factors.push(`Attainable blocks line (${line})`);
    } else if (line <= 2.5) {
      lineValueScore = 1.5;
      factors.push(`Moderate blocks line (${line})`);
    } else {
      lineValueScore = 1.0;
      risks.push(`High blocks line (${line}) - needs elite shot blocker`);
      riskPenalty = 0.3;
    }
  } else if (isSteals) {
    // Steals scoring - lower lines are easier
    if (line <= 1.5) {
      lineValueScore = 2.0;
      factors.push(`Attainable steals line (${line})`);
    } else if (line <= 2.5) {
      lineValueScore = 1.5;
      factors.push(`Moderate steals line (${line})`);
    } else {
      lineValueScore = 1.0;
      risks.push(`High steals line (${line}) - needs elite defender`);
      riskPenalty = 0.3;
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
  // Use correct stat label based on prop type
  let propLabel = "points";
  if (isGoals) propLabel = "goals";
  else if (isAssistsType) propLabel = "assists";
  else if (isShots) propLabel = "shots on goal";
  else if (isRebounds) propLabel = "rebounds";
  else if (isBlocks) propLabel = "blocks";
  else if (isSteals) propLabel = "steals";
  let writeup = `${playerName} ${lineLabel} ${propLabel} at ${bestOdds > 0 ? "+" : ""}${bestOdds}. `;
  if (matchup) {
    writeup += `${matchup}. `;
  }
  if (factors.length > 0) {
    writeup += factors[0] + ".";
  }

  const keyFactor = factors.length > 0 ? factors[0] : "Standard line";
  const riskReason = risks.length > 0 ? risks.join(". ") : "Normal variance";

  // === TIER LABEL ===
  // Block Top Pick/Strong/Value if negative edge (strict +EV requirement)
  let tier;
  if (edgeNum <= 0) {
    // Negative edge = always Risky (Value requires positive edge)
    tier = "Risky";
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
    // Hit rate context (matches MLB structure)
    last10HitRate, // e.g., "7/10"
    last10Results, // e.g., "HHMHHMHHHM"
    hitRateLast10, // numeric for UI (e.g., 7)
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
          commenceTime: game?.scheduled_at || new Date().toISOString(),
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
            commenceTime: game?.scheduled_at || new Date().toISOString(),
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

      // Filter for MLB Batter Walks (not combos, not "Walks Allowed", must be MLB game)
      if (game?.sport_id === "MLB" && subheader.includes("Walks") && !subheader.includes("Allowed") && !subheader.includes("+")) {
        const walkLine = parseFloat(line.stat_value) || 0.5;
        const overOdds = options[0]?.american_price;

        mlbProps.push({
          id: `underdog_bb_${line.id || playerName}`,
          sport: "MLB",
          eventId: line.id,
          homeTeam: game?.abbreviated_title?.split(" @ ")[1] || "MLB",
          awayTeam: game?.abbreviated_title?.split(" @ ")[0] || "Away",
          commenceTime: game?.scheduled_at || new Date().toISOString(),
          playerName,
          propType: "Walks",
          marketKey: "batter_walks",
          line: walkLine,
          overUnder: "Over",
          odds: [{ bookmaker: "Underdog", price: parseInt(overOdds) || -110 }],
          matchup,
          fullMatchup,
          gameTime,
        });
      }

      // Filter for MLB Pitcher Strikeouts (not combos, not 1st inning, not batter Ks, must be MLB game)
      if (game?.sport_id === "MLB" && (subheader.includes("Pitcher Strikeouts") || subheader.includes("Pitching Strikeouts") || (subheader.includes("Strikeouts") && !subheader.includes("Batter") && !subheader.includes("1st Inn"))) && !subheader.includes("+")) {
        const kLine = parseFloat(line.stat_value) || 4.5;
        const overOdds = options[0]?.american_price;

        mlbProps.push({
          id: `underdog_k_${line.id || playerName}`,
          sport: "MLB",
          eventId: line.id,
          homeTeam: game?.abbreviated_title?.split(" @ ")[1] || "MLB",
          awayTeam: game?.abbreviated_title?.split(" @ ")[0] || "Away",
          commenceTime: game?.scheduled_at || new Date().toISOString(),
          playerName,
          propType: "Pitcher Strikeouts",
          marketKey: "pitcher_strikeouts",
          line: kLine,
          overUnder: "Over",
          odds: [{ bookmaker: "Underdog", price: parseInt(overOdds) || -110 }],
          matchup,
          fullMatchup,
          gameTime,
        });
      }
    }

    const hrCount = mlbProps.filter((p) => p.marketKey === "batter_home_runs").length;
    const hitCount = mlbProps.filter((p) => p.marketKey === "batter_hits").length;
    const bbCount = mlbProps.filter((p) => p.marketKey === "batter_walks").length;
    const kCount = mlbProps.filter((p) => p.marketKey === "pitcher_strikeouts").length;
    const withContext = mlbProps.filter((p) => p.matchup).length;
    console.log(`[Props] Parsed ${hrCount} HR, ${hitCount} Hit, ${bbCount} Walk, ${kCount} K props (${withContext} with matchup context)`);

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

      // Validate team belongs to this game to reject mismatched source records
      if (teamId && teamId !== game?.home_team_id && teamId !== game?.away_team_id) continue;

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
        hasValidatedGame: true, // Explicit marker: passed game/team validation
      });
    }

    const statCounts = {};
    for (const p of nbaProps) {
      statCounts[p.propType] = (statCounts[p.propType] || 0) + 1;
    }
    console.log(`[Props] Parsed ${nbaProps.length} NBA props from Underdog:`, statCounts);

    // Return raw props - enrichment happens after merge in fetchAllPropsForSport
    return nbaProps;
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
    // NOTE: Blocked Shots excluded per user requirements (only shots/goals/assists/points)
    // NOTE: "Shots on Target" excluded - use "Shots on Goal" as canonical to avoid duplicates
    const nhlStatMap = {
      "Goals": { marketKey: "player_goals", propType: "Goals", idPrefix: "goals" },
      "Assists": { marketKey: "player_assists", propType: "Assists", idPrefix: "ast" },
      "Points": { marketKey: "player_points", propType: "Points", idPrefix: "pts" },
      "Shots on Goal": { marketKey: "player_shots_on_goal", propType: "Shots on Goal", idPrefix: "sog" },
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
      const rawLine = parseFloat(line.stat_value) || 0.5;
      const statLine = Math.round(rawLine * 2) / 2; // Normalize to nearest 0.5

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

    // Return raw props - enrichment happens after final selection in getPropsForSport
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

      // Only process hits, home runs, walks, and pitcher strikeouts
      if (!statType.includes("Hits") && !statType.includes("Home Run") && !statType.includes("Walks") && !statType.includes("Strikeouts")) continue;

      const playerId = proj.relationships?.new_player?.data?.id;
      const player = playersById[playerId];
      const playerName = player?.attributes?.name || "Unknown";
      const team = player?.attributes?.team || "";

      const gameId = proj.relationships?.projection_game?.data?.id;
      const game = gamesById[gameId];

      // Skip props without resolved game context to avoid placeholder matchup/time
      if (!game) continue;

      const opponent = game?.attributes?.away_team === team
        ? game?.attributes?.home_team
        : game?.attributes?.away_team || "";

      const isHR = statType.includes("Home Run");
      const isWalks = statType.includes("Walks");
      const isK = statType.includes("Strikeouts");

      let propType, marketKey;
      if (isHR) { propType = "Home Runs"; marketKey = "batter_home_runs"; }
      else if (isWalks) { propType = "Walks"; marketKey = "batter_walks"; }
      else if (isK) { propType = "Pitcher Strikeouts"; marketKey = "pitcher_strikeouts"; }
      else { propType = "Hits"; marketKey = "batter_hits"; }

      mlbProps.push({
        id: `prizepicks_${proj.id}`,
        sport: "MLB",
        eventId: proj.id,
        homeTeam: game?.attributes?.home_team || "MLB",
        awayTeam: game?.attributes?.away_team || "Away",
        commenceTime: game?.attributes?.start_time || new Date().toISOString(),
        playerName,
        propType,
        marketKey,
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

      // Only process exact Points props (not 3-Point, Fantasy Points, etc.)
      if (statType !== "Points") continue;

      const playerId = proj.relationships?.new_player?.data?.id;
      const player = playersById[playerId];
      const playerName = player?.attributes?.name || "Unknown";
      const team = player?.attributes?.team || "";

      const gameId = proj.relationships?.projection_game?.data?.id;
      const game = gamesById[gameId];

      // Skip props without resolved game context to avoid stale/mismatched records
      if (!game) continue;

      // Validate player team matches one side of the game to reject stale/mismatched records
      const homeTeam = game.attributes?.home_team || "";
      const awayTeam = game.attributes?.away_team || "";
      if (team && team !== homeTeam && team !== awayTeam) continue;

      nbaProps.push({
        id: `prizepicks_nba_${proj.id}`,
        sport: "NBA",
        eventId: proj.id,
        homeTeam: game.attributes?.home_team || "NBA",
        awayTeam: game.attributes?.away_team || "Away",
        commenceTime: game.attributes?.start_time || new Date().toISOString(),
        playerName,
        propType: "Points",
        marketKey: "player_points",
        line,
        overUnder: "Over",
        odds: [{ bookmaker: "PrizePicks", price: -110 }],
        matchup: `${game.attributes?.away_team} @ ${game.attributes?.home_team}`,
        source: "PrizePicks",
        hasValidatedGame: true, // Explicit marker: passed game/team validation
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
    const [underdogPropsRaw, prizePicksPropsRaw] = await Promise.all([
      fetchMLBPropsFromUnderdog(),
      fetchMLBPropsFromPrizePicks(),
    ]);
    // Sport lock: filter out any props that don't match the requested sport (normalize to lowercase)
    const underdogProps = underdogPropsRaw.filter(p => {
      if (p.sport && p.sport.toLowerCase() !== sportKey.toLowerCase()) {
        console.log(`[FETCH][SPORT_LOCK] Rejected: prop.sport=${p.sport}, expected=${sportKey}, player=${p.playerName}`);
        return false;
      }
      return true;
    });
    const prizePicksProps = prizePicksPropsRaw.filter(p => {
      if (p.sport && p.sport.toLowerCase() !== sportKey.toLowerCase()) {
        console.log(`[FETCH][SPORT_LOCK] Rejected: prop.sport=${p.sport}, expected=${sportKey}, player=${p.playerName}`);
        return false;
      }
      return true;
    });
    console.log(`[FETCH][SPORT_LOCK] MLB: kept ${underdogProps.length}/${underdogPropsRaw.length} Underdog, ${prizePicksProps.length}/${prizePicksPropsRaw.length} PrizePicks`);
    // Merge: Underdog is primary, PrizePicks supplements
    const merged = [...underdogProps];
    // Add PrizePicks props that don't duplicate Underdog (by player + line)
    const existingKeys = new Set(underdogProps.map(p => `${p.playerName}_${p.line}_${p.marketKey}`));
    for (const prop of prizePicksProps) {
      const key = `${prop.playerName}_${prop.line}_${prop.marketKey}`;
      if (!existingKeys.has(key)) {
        merged.push(prop);
        existingKeys.add(key); // Prevent duplicates within PrizePicks
      }
    }
    console.log(`[Props] Merged ${underdogProps.length} Underdog + ${prizePicksProps.length} PrizePicks = ${merged.length} total MLB props`);
    // Enrich full merged set to ensure PrizePicks props get L10, matchup, gameTime
    return await enrichMLBProps(merged);
  }
  if (sportKey === "nba") {
    const [underdogPropsRaw, prizePicksPropsRaw] = await Promise.all([
      fetchNBAPropsFromUnderdog(),
      fetchNBAPropsFromPrizePicks(),
    ]);
    // Sport lock: filter out any props that don't match the requested sport (normalize to lowercase)
    const underdogProps = underdogPropsRaw.filter(p => {
      if (p.sport && p.sport.toLowerCase() !== sportKey.toLowerCase()) {
        console.log(`[FETCH][SPORT_LOCK] Rejected: prop.sport=${p.sport}, expected=${sportKey}, player=${p.playerName}`);
        return false;
      }
      return true;
    });
    const prizePicksProps = prizePicksPropsRaw.filter(p => {
      if (p.sport && p.sport.toLowerCase() !== sportKey.toLowerCase()) {
        console.log(`[FETCH][SPORT_LOCK] Rejected: prop.sport=${p.sport}, expected=${sportKey}, player=${p.playerName}`);
        return false;
      }
      return true;
    });
    console.log(`[FETCH][SPORT_LOCK] NBA: kept ${underdogProps.length}/${underdogPropsRaw.length} Underdog, ${prizePicksProps.length}/${prizePicksPropsRaw.length} PrizePicks`);
    const merged = [...underdogProps];
    // Include matchup in dedupe key to prevent stale/mismatched game records from surviving
    const existingKeys = new Set(underdogProps.map(p => `${p.playerName}_${p.line}_${p.marketKey}_${p.matchup || ''}`));
    for (const prop of prizePicksProps) {
      const key = `${prop.playerName}_${prop.line}_${prop.marketKey}_${prop.matchup || ''}`;
      if (!existingKeys.has(key)) {
        merged.push(prop);
        existingKeys.add(key); // Prevent duplicates within PrizePicks
      }
    }
    console.log(`[Props] Merged ${underdogProps.length} Underdog + ${prizePicksProps.length} PrizePicks = ${merged.length} total NBA props`);
    // Enrich full merged set so L10/performance data is available before EV + scoring run
    return await enrichNBAProps(merged);
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
    batter_walks: "BB",
    pitcher_strikeouts: "Ks",
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
  if (!config) return { categories: [], watchlistCategories: [] };

  const categories = [];
  const watchlistCategories = [];

  for (const category of config.categories) {
    // Filter props for this category
    let categoryProps = allProps.filter((prop) => {
      const marketMatch = category.markets.includes(prop.marketKey);
      const customFilter = category.filterFn ? category.filterFn(prop) : true;
      return marketMatch && customFilter;
    });

    // NBA-only: exclude props without validated current-day game identity
    if (sportKey === "nba") {
      const beforeValidation = categoryProps.length;
      categoryProps = categoryProps.filter((p) => p.hasValidatedGame === true);
      if (beforeValidation > categoryProps.length) {
        console.log(`[Props] NBA: Excluded ${beforeValidation - categoryProps.length} unvalidated ${category.name} props`);
      }
    }

    // MLB props: require L10 enrichment data before scoring (hits, walks, pitcher Ks)
    if (sportKey === "mlb" && (category.id === "hits" || category.id === "walks" || category.id === "pitcher_strikeouts")) {
      const beforeL10 = categoryProps.length;
      categoryProps = categoryProps.filter((p) => p.last10Games && p.last10Games.length > 0);
      if (beforeL10 > categoryProps.length) {
        console.log(`[Props] MLB: Excluded ${beforeL10 - categoryProps.length} ${category.name} props missing L10 data`);
      }
    }

    // Add edge data (ev computed on every prop for display + sorting, not used as visibility gate)
    categoryProps = addEdgeDataToProps(categoryProps);

    // Filter by minimum heater score for quality control (MLB and NBA)
    if (sportKey === "mlb" || sportKey === "nba") {
      categoryProps = categoryProps.filter((p) => p.heaterScore >= MIN_HEATER_SCORE);
    }

    // Sort by EV (desc), then heaterScore (desc), then hitRateLast10 (desc)
    categoryProps.sort((a, b) => {
      const evDiff = parseFloat(b.ev || 0) - parseFloat(a.ev || 0);
      if (evDiff !== 0) return evDiff;
      const scoreDiff = (b.heaterScore || 0) - (a.heaterScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (b.hitRateLast10 || 0) - (a.hitRateLast10 || 0);
    });

    categoryProps = categoryProps.slice(0, category.maxProps);

    categories.push({
      id: category.id,
      name: category.name,
      sport: sportKey.toUpperCase(),
      reliability: category.reliability || null,
      props: categoryProps,
      error: categoryProps.length === 0 ? `No ${category.name.toLowerCase()} available today` : null,
    });
  }

  return { categories, watchlistCategories };
}

// NHL market -> reliability mapping (see docs/prop-type-reference.md)
const NHL_MARKET_RELIABILITY = {
  player_shots_on_goal: "high",
  player_assists: "high",
  player_points: "medium",
  player_goals: "low",
};
const RELIABILITY_RANK = { high: 3, medium: 2, low: 1 };

// Organize NHL props by game with top 10-20 per game, ranked by hit rate then score
function organizeNHLByGame(allProps) {
  const config = SPORT_CONFIG.nhl;
  const allowedMarkets = config.allowedMarkets || [];
  const maxPerGame = config.maxPropsPerGame || 15;

  // Filter to allowed markets only (no blocked shots)
  let filteredProps = allProps.filter((prop) => allowedMarkets.includes(prop.marketKey));

  // Add edge data (ev computed on every prop for display + sorting, not used as visibility gate)
  filteredProps = addEdgeDataToProps(filteredProps);

  // Sort all NHL props globally by EV desc, then heaterScore, then hitRate
  filteredProps.sort((a, b) => {
    const evDiff = parseFloat(b.ev || 0) - parseFloat(a.ev || 0);
    if (evDiff !== 0) return evDiff;
    const scoreDiff = (b.heaterScore || 0) - (a.heaterScore || 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (b.hitRateLast10 || 0) - (a.hitRateLast10 || 0);
  });

  const gameCategories = [{
    id: "nhl_all",
    name: "NHL Props",
    sport: "NHL",
    isGameGroup: false,
    reliability: "medium",
    props: filteredProps.slice(0, 50),
    error: filteredProps.length === 0 ? "No NHL props available today" : null,
  }];

  console.log(`[Props] NHL: ${filteredProps.length} props, showing ${gameCategories[0].props.length} in flat list`);
  return { gameCategories, watchlistGameCategories: [] };
}

// Add edge data to props and filter by minimum edge
function addEdgeDataToProps(props) {
  return props
    .map((prop) => {
      const bestOdds = getBestOdds(prop.odds);
      const impliedProb = calculateImpliedProbability(bestOdds);
      const modelProb = calculateModelProbability(prop.odds, prop.propType);
      const edge = parseFloat(calculateEdge(modelProb, impliedProb));
      // EV is intentionally NOT derived here from modelProb * decimalOdds - 1.
      // modelProb is market-derived (avgImplied/1.04), which collapses EV to a
      // near-constant negative value (~-3.8%) across all props. Any stat-based
      // EV must come from the sport scoring functions below via ...scoring.

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
        edge: edge.toFixed(1),
        // Guarantee ev is always defined before downstream filter (ev > 0) and sort run.
        // Default to the already-computed edge (no new model logic); any stat-based
        // ev emitted by sport scoring below overrides via the ...scoring spread.
        ev: edge.toFixed(1),
        hasEdge: isSingleSource || edge >= MIN_EDGE_PERCENT,
        ...scoring, // heaterScore, confidence, hitRateLast10, writeup, keyFactor, and any stat-based ev
      };
    })
    .filter((prop) => prop.hasEdge);
}

async function getPropsForSport(sportKey, apiKey) {
  const config = SPORT_CONFIG[sportKey];
  if (!config) return { categories: [], watchlistCategories: [] };

  const cache = propsCache[sportKey];
  const now = Date.now();

  // Invalidate stale NHL cache from before normalization fix
  if (sportKey === "nhl" && cache.version !== NHL_CACHE_VERSION) {
    console.log(`[Props] NHL cache version mismatch (${cache.version} vs ${NHL_CACHE_VERSION}), invalidating`);
    propsCache.nhl = { data: null, timestamp: 0, version: NHL_CACHE_VERSION };
  }

  // Check cache
  if (cache.data && now - cache.timestamp < config.cacheTTL) {
    console.log(`[Props] Using cached ${sportKey.toUpperCase()} props (${Math.round((now - cache.timestamp) / 60000)}min old)`);
    return cache.data;
  }

  // Fetch fresh props - ONE API call
  const allProps = await fetchAllPropsForSport(sportKey, apiKey);

  if (allProps.length === 0) {
    // Return categories with error messages when no data
    const emptyCategories = config.categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      sport: sportKey.toUpperCase(),
      props: [],
      error: `DATA MISSING: No ${sportKey.toUpperCase()} ${cat.name.toLowerCase()} available - odds data not yet released`,
    }));
    return { categories: emptyCategories, watchlistCategories: [] };
  }

  // NHL uses game-level grouping; other sports use category-level
  let categories;
  let watchlistCategories;
  if (sportKey === "nhl") {
    // Dedupe NHL props by player + stat type + line + game before organizing
    const nhlDedupeMap = new Map();
    for (const prop of allProps) {
      const key = `${prop.playerName}_${prop.marketKey}_${prop.line}_${prop.matchup || prop.homeTeam}`;
      if (!nhlDedupeMap.has(key)) {
        nhlDedupeMap.set(key, prop);
      }
    }
    const dedupedProps = Array.from(nhlDedupeMap.values());
    console.log(`[Props] NHL: Deduped ${allProps.length} -> ${dedupedProps.length} props`);
    const nhlResult = organizeNHLByGame(dedupedProps);
    categories = nhlResult.gameCategories;
    watchlistCategories = nhlResult.watchlistGameCategories;

    // Enrich NHL props AFTER final selection so only displayed props are enriched
    const allNHLCats = [...categories, ...watchlistCategories];
    const allDisplayedNHLProps = allNHLCats.flatMap(c => c.props);
    const enrichedNHLProps = await enrichNHLProps(allDisplayedNHLProps);
    const enrichedNHLMap = new Map(enrichedNHLProps.map(p => [`${p.playerName}_${p.marketKey}_${p.line}`, p]));
    for (const cat of allNHLCats) {
      cat.props = cat.props.map(p => {
        const enriched = enrichedNHLMap.get(`${p.playerName}_${p.marketKey}_${p.line}`);
        if (!enriched || !enriched.last10Games?.length) return p;
        // Derive L10 display fields from enriched game data
        const last10Games = enriched.last10Games;
        const line = p.line || 0;
        const propType = p.propType || "";
        const isGoals = propType.includes("Goals");
        const isAssists = propType.includes("Assists");
        const isPoints = propType.includes("Points");
        const isShots = propType.includes("Shots");
        const results = last10Games.map(g => {
          let val = 0;
          if (isGoals) val = g.goals || 0;
          else if (isAssists) val = g.assists || 0;
          else if (isPoints) val = g.points || 0;
          else if (isShots) val = g.shots || 0;
          else val = g.goals || 0;
          return val >= line ? "H" : "M";
        });
        const hitCount = results.filter(r => r === "H").length;
        return {
          ...p,
          ...enriched,
          last10HitRate: `${hitCount}/${last10Games.length}`,
          last10Results: results.join(""),
          hitRateLast10: hitCount,
        };
      });
      // Re-sort by hit rate after enrichment
      cat.props.sort((a, b) => {
        const aHits = a.hitRateLast10 || 0;
        const bHits = b.hitRateLast10 || 0;
        if (aHits !== bHits) return bHits - aHits;
        return (b.heaterScore || 0) - (a.heaterScore || 0);
      });
    }
  } else {
    const result = organizeIntoCategories(allProps, sportKey);
    categories = result.categories;
    watchlistCategories = result.watchlistCategories;
  }

  // NBA L10 is enriched at fetch time so EV + scoring use performance data.
  // Post-selection pass: re-run enrichment on the final displayed set to guarantee
  // last10HitRate / last10Results are attached on every returned card (covers cases
  // where the fetch-time enrichment's cap didn't reach a final-selected prop).
  if (sportKey === "nba") {
    const allNBACats = [...categories, ...watchlistCategories];
    const allDisplayedNBAProps = allNBACats.flatMap(c => c.props);
    const enrichedNBAProps = await enrichNBAProps(allDisplayedNBAProps);
    const enrichedNBAMap = new Map(enrichedNBAProps.map(p => [`${p.playerName}_${p.line}_${p.marketKey}_${p.matchup || ''}`, p]));
    for (const cat of allNBACats) {
      cat.props = cat.props.map(p => {
        if (p.last10Games && p.last10Games.length > 0 && p.last10HitRate && p.last10Results) {
          return p;
        }
        const enriched = enrichedNBAMap.get(`${p.playerName}_${p.line}_${p.marketKey}_${p.matchup || ''}`);
        if (!enriched || !enriched.last10Games?.length) {
          // Guarantee L10 keys exist on every returned NBA card even when enrichment misses
          return {
            ...p,
            last10HitRate: p.last10HitRate ?? null,
            last10Results: p.last10Results ?? null,
            hitRateLast10: p.hitRateLast10 ?? null,
          };
        }
        const last10Games = enriched.last10Games;
        const line = p.line || 0;
        const propType = p.propType || "";
        const isPoints = propType.includes("Points");
        const isRebounds = propType.includes("Rebounds");
        const isAssists = propType.includes("Assists");
        const isBlocks = propType.includes("Blocks");
        const isSteals = propType.includes("Steals");
        const isThrees = propType.includes("3-Pointer") || propType.includes("Three");
        const results = last10Games.map(g => {
          let val = 0;
          if (isPoints) val = g.points || 0;
          else if (isRebounds) val = g.rebounds || 0;
          else if (isAssists) val = g.assists || 0;
          else if (isBlocks) val = g.blocks || 0;
          else if (isSteals) val = g.steals || 0;
          else if (isThrees) val = g.threes || 0;
          else val = g.points || 0;
          return val >= line ? "H" : "M";
        });
        const hitCount = results.filter(r => r === "H").length;
        return {
          ...p,
          ...enriched,
          last10HitRate: `${hitCount}/${last10Games.length}`,
          last10Results: results.join(""),
          hitRateLast10: hitCount,
        };
      });
    }
  }

  // Cache the results (include version for NHL to support cache invalidation)
  const result = { categories, watchlistCategories };
  propsCache[sportKey] = sportKey === "nhl"
    ? { data: result, timestamp: now, version: NHL_CACHE_VERSION }
    : { data: result, timestamp: now };

  return result;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sport = (searchParams.get("sport") || "mlb").toLowerCase();

  let isPaidUser = true; // Default to paid for local dev without auth

  // Check auth only if Clerk is configured
  if (process.env.CLERK_SECRET_KEY) {
    const { auth, currentUser } = require("@clerk/nextjs/server");
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!email) {
      return NextResponse.json({ error: "No email found", code: "NO_EMAIL" }, { status: 400 });
    }

    isPaidUser = await hasActiveSubscription(email);
  }
  const apiKey = getOddsApiKey();

  // Get props for requested sport(s)
  // MLB, NBA, and NHL all use Underdog/PrizePicks (no API key needed)
  const sportsToFetch = sport === "all" ? ["mlb", "nba", "nhl"] : [sport];
  const allCategories = [];
  const allWatchlistCategories = [];

  for (const s of sportsToFetch) {
    if (!SPORT_CONFIG[s]) continue;
    const result = await getPropsForSport(s, apiKey);
    allCategories.push(...result.categories);
    allWatchlistCategories.push(...result.watchlistCategories);
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

    // Filter for quality props (EV > 0 required, plus score/confidence gates)
    const qualityProps = allProps.filter((p) => {
      const score = p.heaterScore || 0;
      const conf = parseFloat(p.confidence || 0);
      const ev = parseFloat(p.ev || 0);
      const isOut = p.injuryStatus === "out";
      return ev > 0 && score >= 6.0 && conf >= 5 && !isOut;
    });

    // Sort by EV (desc), then heaterScore (desc), then hitRateLast10 (desc)
    const sorted = qualityProps.sort((a, b) => {
      const evDiff = parseFloat(b.ev || 0) - parseFloat(a.ev || 0);
      if (evDiff !== 0) return evDiff;
      const scoreDiff = (b.heaterScore || 0) - (a.heaterScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (b.hitRateLast10 || 0) - (a.hitRateLast10 || 0);
    });

    top5 = sorted.slice(0, 5);
    const outCount = allProps.filter((p) => p.injuryStatus === "out").length;
    console.log(`[Props] Top 5: ${top5.length}/${allProps.length} qualify (heater>=6, conf>=5), ${outCount} OUT excluded`);
  }

  return NextResponse.json({
    top5,
    categories: allCategories,
    watchlistCategories: isPaidUser ? allWatchlistCategories : [],
    sport: sport.toUpperCase(),
    isPaidUser,
    edgeRequirement: `${MIN_EDGE_PERCENT}%`,
    cached: cache.data && Date.now() - cache.timestamp < (SPORT_CONFIG[sport]?.cacheTTL || 0),
    cacheAge: cache.timestamp ? Math.round((Date.now() - cache.timestamp) / 60000) : 0,
    totalProps: allCategories.reduce((sum, cat) => sum + (cat.props?.length || 0), 0),
  });
}
