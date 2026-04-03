import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { hasActiveSubscription } from "../../../lib/subscription";
import { enrichMLBProps } from "../../../lib/mlbStats";
import { enrichNBAProps } from "../../../lib/nbaStats";

export const maxDuration = 60;

const SPORT_MAP = {
  nba: "basketball_nba",
  nfl: "americanfootball_nfl",
  mlb: "baseball_mlb",
  nhl: "icehockey_nhl",
  ncaaf: "americanfootball_ncaaf",
  ncaab: "basketball_ncaab",
  mls: "soccer_usa_mls",
};

// In-memory cache
const bestPlayCache = { data: null, timestamp: 0 };
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

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
    console.log("[BestPlay] Fetching MLB props from Underdog Fantasy...");
    const res = await fetch("https://api.underdogfantasy.com/beta/v5/over_under_lines", {
      signal: AbortSignal.timeout(20000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) {
      console.warn(`[BestPlay] Underdog API returned ${res.status}`);
      return [];
    }

    const data = await res.json();
    const lines = data.over_under_lines || [];
    console.log(`[BestPlay] Underdog returned ${lines.length} total prop lines`);

    // Build lookup tables for REAL context data
    const gamesById = {};
    for (const game of data.games || []) {
      gamesById[game.id] = game;
    }

    const appearancesById = {};
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
      const matchup = game?.abbreviated_title || null;
      const gameTime = game?.match_progress || null;

      // Filter for MLB Home Runs (exact match, not combos)
      if (subheader.includes("Home Run") && !subheader.includes("+")) {
        const overOdds = options[0]?.american_price;

        mlbProps.push({
          type: "prop",
          sportKey: "mlb",
          eventId: line.id,
          homeTeam: game?.abbreviated_title?.split(" @ ")[1] || "MLB",
          awayTeam: game?.abbreviated_title?.split(" @ ")[0] || "Away",
          commenceTime: new Date().toISOString(),
          playerName,
          propType: "batter_home_runs",
          line: parseFloat(line.stat_value) || 0.5,
          overUnder: "Over",
          odds: parseInt(overOdds) || -110,
          bookmaker: "Underdog",
          matchup,
          gameTime,
        });
      }

      // Filter for MLB Hits (not combos, only 0.5 or 1.5 lines)
      if (subheader.includes("Hits") && !subheader.includes("+")) {
        const hitLine = parseFloat(line.stat_value) || 0.5;

        if (hitLine === 0.5 || hitLine === 1.5) {
          const overOdds = options[0]?.american_price;

          mlbProps.push({
            type: "prop",
            sportKey: "mlb",
            eventId: line.id,
            homeTeam: game?.abbreviated_title?.split(" @ ")[1] || "MLB",
            awayTeam: game?.abbreviated_title?.split(" @ ")[0] || "Away",
            commenceTime: new Date().toISOString(),
            playerName,
            propType: "batter_hits",
            line: hitLine,
            overUnder: "Over",
            odds: parseInt(overOdds) || -110,
            bookmaker: "Underdog",
            matchup,
            gameTime,
          });
        }
      }
    }

    const withContext = mlbProps.filter((p) => p.matchup).length;
    console.log(`[BestPlay] Parsed ${mlbProps.length} MLB props (${withContext} with matchup)`);

    // Enrich with MLB Stats API data (pitcher, lineup, handedness)
    const enrichedProps = await enrichMLBProps(mlbProps.slice(0, 20));
    return enrichedProps;
  } catch (err) {
    console.error("[BestPlay] Failed to fetch from Underdog:", err.message);
    return [];
  }
}

async function fetchGamesForSport(sportKey, apiKey) {
  const oddsSport = SPORT_MAP[sportKey];
  if (!oddsSport) return [];

  try {
    const url = `https://api.the-odds-api.com/v4/sports/${oddsSport}/odds?apiKey=${apiKey}&bookmakers=fanduel,draftkings&markets=h2h,spreads,totals&oddsFormat=american`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = await res.json();

    const now = new Date();
    return data
      .filter((event) => new Date(event.commence_time) > now)
      .map((event) => ({ ...event, sportKey }));
  } catch (err) {
    console.warn(`[BestPlay] Failed to fetch ${sportKey}:`, err.message);
    return [];
  }
}

// Fetch NBA props from Underdog Fantasy API (consistent with Smart Props)
async function fetchNBAPropsFromUnderdog() {
  try {
    console.log("[BestPlay] Fetching NBA props from Underdog Fantasy...");
    const res = await fetch("https://api.underdogfantasy.com/beta/v5/over_under_lines", {
      signal: AbortSignal.timeout(20000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) {
      console.warn(`[BestPlay] Underdog API returned ${res.status}`);
      return [];
    }

    const data = await res.json();
    const lines = data.over_under_lines || [];

    // Build lookup tables
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

    for (const line of lines) {
      const options = line.options || [];
      if (options.length < 1) continue;

      const subheader = options[0].selection_subheader || "";
      const playerName = options[0].selection_header || "";

      const appearanceId = line.over_under?.appearance_stat?.appearance_id;
      const appearance = appearancesById[appearanceId];
      const game = appearance ? gamesById[appearance.match_id] : null;

      // Filter for NBA Points only (ends with " Points", not combos like "Points + Rebounds")
      // Format is "Higher 28.5 Points"
      if (subheader.endsWith(" Points") && !subheader.includes("+")) {
        const overOdds = options[0]?.american_price;
        const pointsLine = parseFloat(line.stat_value) || 0;

        const playerId = appearance?.player_id;
        const player = playerId ? playersById[playerId] : null;
        const position = player?.position || null;

        const matchup = game?.abbreviated_title || null;
        const gameTime = game?.match_progress || null;
        const teamId = appearance?.team_id;
        const isHome = game?.home_team_id === teamId;

        nbaProps.push({
          type: "prop",
          sportKey: "nba",
          eventId: line.id,
          homeTeam: matchup?.split(" @ ")[1] || "NBA",
          awayTeam: matchup?.split(" @ ")[0] || "Away",
          commenceTime: new Date().toISOString(),
          playerName,
          propType: "player_points",
          line: pointsLine,
          overUnder: "Over",
          odds: parseInt(overOdds) || -110,
          bookmaker: "Underdog",
          matchup,
          gameTime,
          position,
          isHome,
        });
      }
    }

    console.log(`[BestPlay] Parsed ${nbaProps.length} NBA points props from Underdog`);
    const enrichedProps = await enrichNBAProps(nbaProps);
    return enrichedProps.slice(0, 20);
  } catch (err) {
    console.error("[BestPlay] Failed to fetch NBA from Underdog:", err.message);
    return [];
  }
}

async function fetchPropsForSport(sportKey, apiKey) {
  // Use Underdog Fantasy for MLB and NBA props (consistent data source)
  if (sportKey === "mlb") {
    return await fetchMLBPropsFromUnderdog();
  }
  if (sportKey === "nba") {
    return await fetchNBAPropsFromUnderdog();
  }

  const oddsSport = SPORT_MAP[sportKey];
  if (!oddsSport) return [];

  const markets = {
    nhl: "player_goals,player_shots_on_goal",
  };

  try {
    const url = `https://api.the-odds-api.com/v4/sports/${oddsSport}/odds?apiKey=${apiKey}&bookmakers=fanduel,draftkings&markets=${markets[sportKey]}&oddsFormat=american`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = await res.json();

    const now = new Date();
    const props = [];

    for (const event of data) {
      if (new Date(event.commence_time) <= now) continue;

      const bookmaker = event.bookmakers?.[0];
      if (!bookmaker) continue;

      for (const market of bookmaker.markets || []) {
        for (const outcome of market.outcomes || []) {
          const playerName = outcome.description || outcome.name;
          if (!playerName || playerName === "Over" || playerName === "Under") continue;

          props.push({
            type: "prop",
            sportKey,
            eventId: event.id,
            homeTeam: event.home_team,
            awayTeam: event.away_team,
            commenceTime: event.commence_time,
            playerName,
            propType: market.key,
            line: outcome.point || 0.5,
            overUnder: outcome.name?.toLowerCase().includes("under") ? "Under" : "Over",
            odds: outcome.price,
            bookmaker: bookmaker.title,
          });
        }
      }
    }

    return props.slice(0, 20);
  } catch (err) {
    console.warn(`[BestPlay] Failed to fetch props for ${sportKey}:`, err.message);
    return [];
  }
}

function generateBetsFromGames(allGames) {
  const bets = [];

  for (const event of allGames) {
    const bookmaker = event.bookmakers?.[0];
    if (!bookmaker) continue;

    const homeTeam = event.home_team;
    const awayTeam = event.away_team;
    const commenceTime = event.commence_time;
    const sport = event.sportKey?.toUpperCase() || "SPORTS";

    // Spread bets
    const spreads = bookmaker.markets?.find((m) => m.key === "spreads");
    if (spreads) {
      const homeSpread = spreads.outcomes?.find((o) => o.name === homeTeam);
      const awaySpread = spreads.outcomes?.find((o) => o.name === awayTeam);

      if (homeSpread) {
        bets.push({
          type: "game",
          id: `${event.id}_spread_home`,
          sport,
          homeTeam,
          awayTeam,
          commenceTime,
          betType: "Spread",
          teamOrPlayer: homeTeam,
          betValue: `${homeTeam} ${homeSpread.point > 0 ? "+" : ""}${homeSpread.point}`,
          line: homeSpread.point,
          odds: homeSpread.price,
          bookmaker: bookmaker.title,
        });
      }
      if (awaySpread) {
        bets.push({
          type: "game",
          id: `${event.id}_spread_away`,
          sport,
          homeTeam,
          awayTeam,
          commenceTime,
          betType: "Spread",
          teamOrPlayer: awayTeam,
          betValue: `${awayTeam} ${awaySpread.point > 0 ? "+" : ""}${awaySpread.point}`,
          line: awaySpread.point,
          odds: awaySpread.price,
          bookmaker: bookmaker.title,
        });
      }
    }

    // Moneyline bets
    const h2h = bookmaker.markets?.find((m) => m.key === "h2h");
    if (h2h) {
      const homeML = h2h.outcomes?.find((o) => o.name === homeTeam);
      const awayML = h2h.outcomes?.find((o) => o.name === awayTeam);

      if (homeML) {
        bets.push({
          type: "game",
          id: `${event.id}_ml_home`,
          sport,
          homeTeam,
          awayTeam,
          commenceTime,
          betType: "Moneyline",
          teamOrPlayer: homeTeam,
          betValue: homeTeam,
          odds: homeML.price,
          bookmaker: bookmaker.title,
        });
      }
      if (awayML) {
        bets.push({
          type: "game",
          id: `${event.id}_ml_away`,
          sport,
          homeTeam,
          awayTeam,
          commenceTime,
          betType: "Moneyline",
          teamOrPlayer: awayTeam,
          betValue: awayTeam,
          odds: awayML.price,
          bookmaker: bookmaker.title,
        });
      }
    }

    // Totals
    const totals = bookmaker.markets?.find((m) => m.key === "totals");
    if (totals) {
      const over = totals.outcomes?.find((o) => o.name === "Over");
      const under = totals.outcomes?.find((o) => o.name === "Under");

      if (over) {
        bets.push({
          type: "game",
          id: `${event.id}_over`,
          sport,
          homeTeam,
          awayTeam,
          commenceTime,
          betType: "Total",
          teamOrPlayer: `${awayTeam} @ ${homeTeam}`,
          betValue: `Over ${over.point}`,
          line: over.point,
          odds: over.price,
          bookmaker: bookmaker.title,
        });
      }
      if (under) {
        bets.push({
          type: "game",
          id: `${event.id}_under`,
          sport,
          homeTeam,
          awayTeam,
          commenceTime,
          betType: "Total",
          teamOrPlayer: `${awayTeam} @ ${homeTeam}`,
          betValue: `Under ${under.point}`,
          line: under.point,
          odds: under.price,
          bookmaker: bookmaker.title,
        });
      }
    }
  }

  return bets;
}

function convertPropsToCandidate(props) {
  return props.map((prop) => ({
    type: "prop",
    id: `${prop.eventId}_${prop.propType}_${prop.playerName}`,
    sport: prop.sportKey.toUpperCase(),
    homeTeam: prop.homeTeam,
    awayTeam: prop.awayTeam,
    commenceTime: prop.commenceTime,
    betType: formatPropType(prop.propType),
    teamOrPlayer: prop.playerName,
    betValue: `${prop.overUnder} ${prop.line} ${formatPropType(prop.propType)}`,
    line: prop.line,
    odds: prop.odds,
    bookmaker: prop.bookmaker,
    propType: prop.propType,
    // Shared context
    matchup: prop.matchup,
    gameTime: prop.gameTime,
    // NBA context from Underdog
    position: prop.position,
    isHome: prop.isHome,
    // MLB context from MLB Stats API
    opposingPitcher: prop.opposingPitcher,
    pitcherHand: prop.pitcherHand,
    lineupSpot: prop.lineupSpot,
    batSide: prop.batSide,
    handednessMatchup: prop.handednessMatchup,
    // Recent performance stats (MLB)
    hitsLast5: prop.hitsLast5,
    hitsLast10: prop.hitsLast10,
    avgLast5: prop.avgLast5,
    avgLast10: prop.avgLast10,
    batterTrend: prop.batterTrend,
    isBatterHot: prop.isBatterHot,
    isBatterCold: prop.isBatterCold,
    // Pitcher quality stats (MLB)
    pitcherERA: prop.pitcherERA,
    pitcherWHIP: prop.pitcherWHIP,
    pitcherK9: prop.pitcherK9,
    pitcherQuality: prop.pitcherQuality,
    isPitcherElite: prop.isPitcherElite,
    isPitcherStruggling: prop.isPitcherStruggling,
  }));
}

function formatPropType(marketKey) {
  const mapping = {
    player_points: "Points",
    player_rebounds: "Rebounds",
    player_assists: "Assists",
    batter_hits: "Hits",
    batter_home_runs: "Home Runs",
    pitcher_strikeouts: "Strikeouts",
    player_shots_on_goal: "Shots on Goal",
    player_goals: "Goals",
  };
  return mapping[marketKey] || marketKey;
}

// REAL data-driven scoring - NO simulated data
// Inputs: line difficulty, odds value, bet type analysis, MLB context
function scoreBetFromOdds(bet) {
  const odds = bet.odds;
  if (odds == null) return null;

  // Calculate implied probability from odds
  const impliedProb = odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);

  // MLB context (from MLB Stats API enrichment)
  const lineupSpot = bet.lineupSpot;
  const handednessMatchup = bet.handednessMatchup;
  const opposingPitcher = bet.opposingPitcher;
  const pitcherHand = bet.pitcherHand;
  const batSide = bet.batSide;

  // Recent performance stats
  const avgLast5 = bet.avgLast5 ? parseFloat(bet.avgLast5) : null;
  const hitsLast5 = bet.hitsLast5;
  const batterTrend = bet.batterTrend;
  const isBatterHot = bet.isBatterHot;
  const isBatterCold = bet.isBatterCold;

  // Pitcher quality stats
  const pitcherERA = bet.pitcherERA;
  const pitcherQuality = bet.pitcherQuality;
  const isPitcherElite = bet.isPitcherElite;
  const isPitcherStruggling = bet.isPitcherStruggling;

  // Score components (all real, measurable factors)
  let lineValueScore = 0;
  let oddsValueScore = 0;
  let betTypeScore = 0;
  let contextScore = 0;
  let riskPenalty = 0;

  const factors = [];
  const risks = [];

  // Identify bet type
  const isMLBProp = bet.type === "prop" && (bet.sport === "MLB" || bet.sportKey === "mlb");
  const isNBAProp = bet.type === "prop" && (bet.sport === "NBA" || bet.sportKey === "nba");
  const propType = bet.propType || bet.betType || "";
  const line = bet.line || 0;

  // === NBA POINTS PROP SCORING ===
  if (isNBAProp) {
    const isPoints = propType.includes("Points") || propType === "player_points";
    const position = bet.position;
    const isHome = bet.isHome;

    if (isPoints) {
      // Line value scoring for NBA points (role-based thresholds)
      if (line <= 15.5) {
        lineValueScore = 2.0;
        factors.push(`Low line (${line}) - role player threshold`);
      } else if (line <= 22.5) {
        lineValueScore = 1.5;
        factors.push(`Starter line (${line})`);
      } else if (line <= 29.5) {
        lineValueScore = 1.0;
        factors.push(`Star scorer line (${line})`);
      } else {
        lineValueScore = 0.5;
        risks.push(`Elite line (${line}) - needs 30+ point game`);
        riskPenalty = 0.5;
      }

      // Position context scoring
      if (position) {
        const pos = position.toUpperCase();
        if (pos === "PG" || pos === "SG" || pos === "G") {
          contextScore += 0.5;
          factors.push(`Guard (${pos}) - primary scoring option`);
        } else if (pos === "SF" || pos === "F") {
          contextScore += 0.3;
          factors.push(`Forward (${pos}) - versatile scorer`);
        } else if (pos === "PF" || pos === "C") {
          risks.push(`Big man (${pos}) - scoring can be matchup dependent`);
          riskPenalty += 0.2;
        }
      }

      // Home court advantage
      if (isHome === true) {
        contextScore += 0.5;
        factors.push("Home game - slight scoring boost");
      } else if (isHome === false) {
        risks.push("Road game");
        riskPenalty += 0.2;
      }
    }
  }

  // === MLB PROP SCORING ===
  if (isMLBProp) {
    const isHits = propType.includes("Hits") || propType === "batter_hits";
    const isHR = propType.includes("Home Run") || propType === "batter_home_runs";

    if (isHits) {
      if (line === 0.5) {
        lineValueScore = 2.5;
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
      lineValueScore = 1.0;
      factors.push("Home run prop");
      risks.push("HRs are low-frequency (~3% per AB)");
      riskPenalty = 1.0;
    }

    // MLB context scoring (from MLB Stats API)
    if (lineupSpot) {
      if (lineupSpot <= 3) {
        contextScore += 1.0;
        factors.push(`Batting ${lineupSpot}${lineupSpot === 1 ? "st" : lineupSpot === 2 ? "nd" : "rd"} - top of order`);
      } else if (lineupSpot <= 5) {
        contextScore += 0.5;
        factors.push(`Batting ${lineupSpot}th - middle of order`);
      } else if (lineupSpot >= 8) {
        riskPenalty += 0.3;
        risks.push(`Batting ${lineupSpot}th - fewer ABs`);
      }
    }

    if (batSide && pitcherHand) {
      const hasAdvantage =
        (batSide === "L" && pitcherHand === "R") ||
        (batSide === "R" && pitcherHand === "L") ||
        batSide === "S";

      if (hasAdvantage) {
        contextScore += 0.5;
        factors.push(handednessMatchup || "Platoon advantage");
      } else {
        riskPenalty += 0.3;
        risks.push(handednessMatchup || "Same-side matchup");
      }
    }

    // Recent performance scoring
    if (avgLast5 !== null) {
      if (isBatterHot) {
        contextScore += 1.0;
        factors.push(`Hot bat - .${(avgLast5 * 1000).toFixed(0)} last 5`);
      } else if (isBatterCold) {
        riskPenalty += 0.5;
        risks.push(`Cold bat - .${(avgLast5 * 1000).toFixed(0)} last 5`);
      } else if (avgLast5 >= 0.250) {
        contextScore += 0.3;
        factors.push(`Solid recent - .${(avgLast5 * 1000).toFixed(0)} last 5`);
      }

      if (batterTrend === "heating up") {
        contextScore += 0.3;
        factors.push("Trending up");
      } else if (batterTrend === "cooling off") {
        riskPenalty += 0.2;
        risks.push("Trending down");
      }
    }

    // Pitcher quality scoring
    if (pitcherQuality && pitcherQuality !== "unknown") {
      if (isPitcherStruggling) {
        contextScore += 0.8;
        factors.push(`vs ${pitcherQuality} pitcher (${pitcherERA?.toFixed(2)} ERA)`);
      } else if (isPitcherElite) {
        riskPenalty += 0.6;
        risks.push(`vs ${pitcherQuality} pitcher (${pitcherERA?.toFixed(2)} ERA)`);
      }
    }

    // Add opposing pitcher to factors if available (and no quality info)
    if (opposingPitcher && !pitcherQuality) {
      factors.push(`vs ${opposingPitcher}${pitcherHand ? ` (${pitcherHand}HP)` : ""}`);
    }
  }

  // === ODDS VALUE SCORING ===
  if (odds >= -115 && odds <= -100) {
    oddsValueScore = 2.0;
    factors.push(`Strong odds (${odds > 0 ? "+" : ""}${odds})`);
  } else if (odds > 0 && odds <= 130) {
    oddsValueScore = 1.5;
    factors.push(`Plus-money (${odds > 0 ? "+" : ""}${odds})`);
  } else if (odds >= 131 && odds <= 200) {
    oddsValueScore = 1.0;
    factors.push("Value underdog");
    risks.push("Lower implied probability");
  } else if (odds >= -150 && odds < -115) {
    oddsValueScore = 1.0;
    factors.push("Standard juice");
  } else if (odds < -150) {
    oddsValueScore = 0;
    riskPenalty += 0.5;
    risks.push("Heavy juice reduces value");
  } else if (odds > 200) {
    oddsValueScore = 0.5;
    risks.push("Long shot odds");
    riskPenalty += 0.5;
  }

  // === BET TYPE SCORING (non-MLB) ===
  if (!isMLBProp) {
    if (bet.betType === "Spread") {
      const spreadLine = Math.abs(line);
      if (bet.sport === "NFL" || bet.sport === "NCAAF") {
        if ([3, 7, 6, 10].includes(spreadLine)) {
          betTypeScore = 1.5;
          factors.push(`Key number (${spreadLine})`);
        }
      }
      if (spreadLine <= 3.5) {
        betTypeScore += 0.5;
        factors.push("Tight spread");
      }
    } else if (bet.betType === "Moneyline") {
      if (odds > 0 && odds <= 200) {
        betTypeScore = 1.0;
        factors.push("Underdog ML value");
      }
    } else if (bet.betType === "Total") {
      if (line % 0.5 === 0 && line % 1 !== 0) {
        betTypeScore = 0.5;
        factors.push("Half-point hook");
      }
    }
  }

  // === CALCULATE FINAL SCORE ===
  const rawScore = 5.0 + lineValueScore + oddsValueScore + betTypeScore + contextScore - riskPenalty;
  const heaterScore = Math.min(10, Math.max(1, Math.round(rawScore * 10) / 10));

  // Confidence based on factor alignment
  const confidence = Math.min(10, Math.max(1, Math.round(
    5 + (factors.length * 0.8) - (risks.length * 0.4)
  )));

  // Generate writeup
  const writeup = `${bet.teamOrPlayer} at ${odds > 0 ? "+" : ""}${odds}. ` +
    `Implied: ${Math.round(impliedProb * 100)}%. ` +
    (factors.length > 0 ? factors[0] + "." : "");

  return {
    heaterScore,
    confidence,
    writeup,
    keyFactors: factors.length > 0 ? factors : ["Standard value"],
    whatCouldGoWrong: risks.length > 0 ? risks.join(". ") : "Normal variance",
    riskReason: risks.length > 0 ? risks[0] : null,
  };
}

// Calculate implied probability and EV from American odds
function calculateEV(odds, estimatedWinProb) {
  const impliedProb = odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);
  const edge = estimatedWinProb - impliedProb;
  const ev = edge * 100; // EV as percentage
  return {
    impliedProb: Math.round(impliedProb * 100),
    estimatedWinProb: Math.round(estimatedWinProb * 100),
    edge: Math.round(edge * 1000) / 10, // e.g., 5.2%
    ev: Math.round(ev * 10) / 10, // e.g., +5.2%
  };
}

async function findBestPlays(apiKey) {
  console.log("[BestPlay] Scanning all sports for Top Plays of the Day...");

  // Fetch games in batches to avoid rate limiting (max 3 concurrent)
  const sports = Object.keys(SPORT_MAP);
  const allGames = [];
  const batchSize = 3;

  for (let i = 0; i < sports.length; i += batchSize) {
    const batch = sports.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((sport) => fetchGamesForSport(sport, apiKey)));
    allGames.push(...results.flat());
    if (i + batchSize < sports.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  console.log(`[BestPlay] Found ${allGames.length} total games across ${sports.length} sports`);

  // Fetch props from supported sports (serialized to avoid rate limiting)
  const propsSports = ["nba", "mlb", "nhl"];
  const allProps = [];
  for (const sport of propsSports) {
    const props = await fetchPropsForSport(sport, apiKey);
    allProps.push(...props);
    await new Promise((r) => setTimeout(r, 100));
  }
  console.log(`[BestPlay] Found ${allProps.length} total props`);

  // Generate all bet candidates
  const gameBets = generateBetsFromGames(allGames);
  const propBets = convertPropsToCandidate(allProps);
  const allCandidates = [...gameBets, ...propBets];

  console.log(`[BestPlay] ${allCandidates.length} total candidates to evaluate`);

  if (allCandidates.length === 0) {
    return { found: false, plays: [], reason: "No games or props available today" };
  }

  // Score ALL candidates using deterministic odds-based scoring (fast, no API calls)
  console.log(`[BestPlay] Scoring ${allCandidates.length} candidates from raw odds data...`);

  const scoredCandidates = allCandidates
    .map((candidate) => {
      const score = scoreBetFromOdds(candidate);
      if (score) {
        // Calculate EV based on confidence
        const estimatedWinProb = Math.min(0.75, Math.max(0.45, score.confidence / 10 + 0.1));
        const evData = calculateEV(candidate.odds, estimatedWinProb);
        return { ...candidate, ...score, ...evData };
      }
      return null;
    })
    .filter(Boolean);

  // Sort by score (highest first) and take top plays
  const sortedPlays = scoredCandidates
    .sort((a, b) => b.heaterScore - a.heaterScore || b.confidence - a.confidence);

  // Prefer 8+ score plays, but always return best available
  const elitePlays = sortedPlays.filter((c) => c.heaterScore >= 8.0).slice(0, 3);

  if (elitePlays.length > 0) {
    console.log(`[BestPlay] Found ${elitePlays.length} elite plays (8+ score)`);
    return { found: true, plays: elitePlays };
  }

  // Return top play (best available) - always show something
  if (sortedPlays.length > 0) {
    const topPlay = sortedPlays[0];
    console.log(`[BestPlay] Returning best available play (score: ${topPlay.heaterScore})`);
    return { found: true, plays: [topPlay], note: "Best value play available today" };
  }

  // Final fallback: return first raw candidate with default score
  if (allCandidates.length > 0) {
    const fallback = allCandidates[0];
    const defaultScore = {
      heaterScore: 6.0,
      confidence: 5,
      atsLast5: "N/A",
      atsLast10: "N/A",
      atsSeason: "N/A",
      homeAwayAts: "N/A",
      writeup: `${fallback.teamOrPlayer} - today's featured play.`,
      keyFactors: ["Game available for betting"],
      whatCouldGoWrong: "Normal betting variance applies.",
    };
    const fallbackPlay = { ...fallback, ...defaultScore };
    console.log(`[BestPlay] Using fallback candidate: ${fallback.teamOrPlayer}`);
    return { found: true, plays: [fallbackPlay] };
  }

  console.log(`[BestPlay] No candidates available`);
  return { found: false, plays: [], reason: "No games available today" };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "true";

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

  // Check cache (unless force refresh)
  const now = Date.now();
  if (!forceRefresh && bestPlayCache.data && now - bestPlayCache.timestamp < CACHE_TTL) {
    console.log("[BestPlay] Returning cached data");

    // For free users, hide the details
    if (!isPaidUser && bestPlayCache.data.found) {
      return NextResponse.json({
        found: true,
        locked: true,
        playCount: bestPlayCache.data.plays?.length || 0,
        sports: [...new Set(bestPlayCache.data.plays?.map((p) => p.sport) || [])],
        cached: true,
        cacheAge: Math.round((now - bestPlayCache.timestamp) / 60000),
      });
    }

    return NextResponse.json({
      ...bestPlayCache.data,
      play: bestPlayCache.data.plays?.[0] || null,
      isPaidUser,
      cached: true,
      cacheAge: Math.round((now - bestPlayCache.timestamp) / 60000),
    });
  }

  const apiKey = getOddsApiKey();

  if (!apiKey) {
    console.error("[BestPlay] No ODDS_API_KEY configured");
    return NextResponse.json({ found: false, error: "Odds API not configured" });
  }

  // Find best plays (1-3 elite picks) using deterministic odds scoring
  console.log("[BestPlay] Generating fresh Best Plays...");
  const result = await findBestPlays(apiKey);

  // Update cache
  bestPlayCache.data = result;
  bestPlayCache.timestamp = now;

  // For free users, hide the details
  if (!isPaidUser && result.found) {
    return NextResponse.json({
      found: true,
      locked: true,
      playCount: result.plays?.length || 0,
      sports: [...new Set(result.plays?.map((p) => p.sport) || [])],
      cached: false,
      cacheAge: 0,
    });
  }

  return NextResponse.json({
    ...result,
    play: result.plays?.[0] || null,
    isPaidUser,
    cached: false,
    cacheAge: 0,
  });
}
