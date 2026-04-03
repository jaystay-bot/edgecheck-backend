import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";

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

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

function getOddsApiKey() {
  for (let i = 1; i <= 10; i++) {
    const key = process.env[`ODDS_API_KEY_${i}`];
    if (key) return key;
  }
  return process.env.ODDS_API_KEY || null;
}

async function hasActiveSubscription(email) {
  const stripe = getStripe();
  if (!stripe) return false;

  try {
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length === 0) return false;

    const customerId = customers.data[0].id;
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    if (subs.data.length > 0) return true;

    const trialSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: "trialing",
      limit: 1,
    });
    return trialSubs.data.length > 0;
  } catch {
    return false;
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

async function fetchPropsForSport(sportKey, apiKey) {
  const oddsSport = SPORT_MAP[sportKey];
  if (!oddsSport) return [];

  const markets = {
    nba: "player_points,player_assists,player_rebounds",
    mlb: "batter_hits,batter_home_runs,pitcher_strikeouts",
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

    return props.slice(0, 20); // Limit props per sport
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

// Deterministic scoring based on raw odds data - no AI
function scoreBetFromOdds(bet) {
  const odds = bet.odds;
  if (odds == null) return null;

  // Calculate implied probability
  const impliedProb = odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);

  // Base score starts at 5
  let score = 5.0;
  let confidence = 5;
  const factors = [];
  const risks = [];

  // Value scoring based on odds
  if (odds >= 100 && odds <= 150) {
    // Small underdog ML - good value zone
    score += 2.5;
    confidence += 2;
    factors.push("Value underdog odds (+100 to +150)");
  } else if (odds >= 151 && odds <= 250) {
    // Medium underdog - higher variance
    score += 2.0;
    confidence += 1;
    factors.push("Plus-money value (+150 to +250)");
    risks.push("Higher variance play");
  } else if (odds >= -150 && odds <= -110) {
    // Standard favorite - consistent
    score += 1.5;
    confidence += 2;
    factors.push("Favorable juice on standard line");
  } else if (odds >= -200 && odds < -150) {
    // Moderate favorite
    score += 1.0;
    confidence += 1;
    factors.push("Moderate favorite pricing");
  } else if (odds > 250) {
    // Long shot - lower base but can hit
    score += 1.0;
    risks.push("Long shot - lower hit rate");
  } else if (odds < -200) {
    // Heavy favorite - low value
    score += 0.5;
    risks.push("Heavy chalk - limited upside");
  }

  // Bet type scoring
  if (bet.betType === "Spread") {
    const line = Math.abs(bet.line || 0);
    // Key numbers in football
    if (bet.sport === "NFL" || bet.sport === "NCAAF") {
      if (line === 3 || line === 7 || line === 6 || line === 10) {
        score += 1.0;
        factors.push(`Key number spread (${line})`);
      }
    }
    // Small spreads = closer games = more predictable
    if (line <= 3.5) {
      score += 0.5;
      factors.push("Tight spread - competitive matchup");
    }
  } else if (bet.betType === "Moneyline") {
    // Underdogs on ML have value
    if (odds > 0) {
      score += 0.5;
      factors.push("Moneyline underdog value");
    }
  } else if (bet.betType === "Total") {
    // Totals at round numbers
    const total = bet.line || 0;
    if (total % 0.5 === 0 && total % 1 !== 0) {
      score += 0.5;
      factors.push("Half-point total hook");
    }
  }

  // Add small variance for diversity (±0.3)
  const variance = (Math.random() - 0.5) * 0.6;
  score = Math.round((score + variance) * 10) / 10;

  // Clamp score to 1-10 range
  score = Math.min(10, Math.max(1, score));
  confidence = Math.min(10, Math.max(1, confidence));

  // Generate writeup based on factors
  const writeup = factors.length > 0
    ? `${bet.teamOrPlayer} presents value at ${odds > 0 ? "+" : ""}${odds}. ${factors.join(". ")}. Implied probability: ${Math.round(impliedProb * 100)}%.`
    : `Standard betting opportunity on ${bet.teamOrPlayer} at ${odds > 0 ? "+" : ""}${odds}.`;

  return {
    heaterScore: score,
    confidence,
    atsLast5: "N/A",
    atsLast10: "N/A",
    atsSeason: "N/A",
    homeAwayAts: "N/A",
    writeup,
    keyFactors: factors.length > 0 ? factors : ["Standard line value"],
    whatCouldGoWrong: risks.length > 0 ? risks.join(". ") : "Normal betting variance applies.",
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

  // Filter to only elite plays (8+ score) and sort by score
  const elitePlays = scoredCandidates
    .filter((c) => c.heaterScore >= 8.0)
    .sort((a, b) => b.heaterScore - a.heaterScore || b.confidence - a.confidence)
    .slice(0, 3); // Top 3 elite plays

  if (elitePlays.length > 0) {
    console.log(`[BestPlay] Found ${elitePlays.length} elite plays (8+ score)`);
    return { found: true, plays: elitePlays };
  }

  // If no 8+ plays, return top 3 highest scoring as backup
  const topPlays = scoredCandidates
    .sort((a, b) => b.heaterScore - a.heaterScore || b.confidence - a.confidence)
    .slice(0, 3);

  if (topPlays.length > 0) {
    console.log(`[BestPlay] No 8+ plays, returning top ${topPlays.length} (scores: ${topPlays.map(p => p.heaterScore).join(", ")})`);
    return { found: true, plays: topPlays, note: "Best value plays available today" };
  }

  console.log(`[BestPlay] No candidates could be scored`);
  return { found: false, plays: [], reason: "Unable to analyze games today" };
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
