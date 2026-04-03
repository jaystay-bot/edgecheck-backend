import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import Groq from "groq-sdk";

export const maxDuration = 60;

const SPORT_MAP = {
  nba: "basketball_nba",
  mlb: "baseball_mlb",
  nhl: "icehockey_nhl",
};

// In-memory cache
const bestPlayCache = { data: null, timestamp: 0 };
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

function getGroq() {
  if (!process.env.GROQ_API_KEY) return null;
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
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
    const url = `https://api.the-odds-api.com/v4/sports/${oddsSport}/odds?apiKey=${apiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`;
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
    const url = `https://api.the-odds-api.com/v4/sports/${oddsSport}/odds?apiKey=${apiKey}&regions=us&markets=${markets[sportKey]}&oddsFormat=american`;
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

async function scoreBetWithGroq(groq, bet) {
  const isGameBet = bet.type === "game";

  const prompt = `You are an expert sports betting analyst finding the BEST PLAY OF THE DAY. Score this bet from 1-10 where 10 is the absolute strongest edge.

Sport: ${bet.sport}
Game: ${bet.awayTeam} @ ${bet.homeTeam}
Game Time: ${bet.commenceTime}
Bet Type: ${bet.betType}
Selection: ${bet.teamOrPlayer}
Line: ${bet.betValue}
Odds: ${bet.odds > 0 ? "+" : ""}${bet.odds}

This is for finding THE SINGLE BEST BET of the entire day. Be extremely selective - only score 8+ if this is a truly exceptional edge.

${isGameBet ? `For this game bet, consider:
- Team's recent ATS performance
- Home/Away splits
- Head-to-head history
- Key injuries/rest
- Situational spots` : `For this prop bet, consider:
- Player's recent performance trend
- Matchup quality
- Usage rate / opportunities
- Historical hit rate on this line`}

Respond with ONLY a JSON object (no markdown):
{
  "heaterScore": 8,
  "confidence": 9,
  "atsLast5": "4-1",
  "atsLast10": "7-3",
  "atsSeason": "42-28",
  "homeAwayAts": "12-5 Home",
  "writeup": "4-5 sentence detailed analysis explaining why this is or isn't a strong play. Include specific trends and matchup factors.",
  "keyFactors": ["Factor 1", "Factor 2", "Factor 3"],
  "whatCouldGoWrong": "2 sentence explanation of the main risks."
}

heaterScore: 1-10 (6+ for good edge, 8+ for elite)
confidence: 1-10
atsLast5: recent ATS record (W-L format)
atsLast10: last 10 ATS record
atsSeason: full season ATS
homeAwayAts: home or away ATS split
writeup: 4-5 sentence analysis
keyFactors: 3 key reasons
whatCouldGoWrong: main risks`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = completion.choices?.[0]?.message?.content?.trim();
    if (!text) return null;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      heaterScore: Math.min(10, Math.max(1, parseInt(parsed.heaterScore, 10) || 5)),
      confidence: Math.min(10, Math.max(1, parseInt(parsed.confidence, 10) || 5)),
      atsLast5: parsed.atsLast5 || "N/A",
      atsLast10: parsed.atsLast10 || "N/A",
      atsSeason: parsed.atsSeason || "N/A",
      homeAwayAts: parsed.homeAwayAts || "N/A",
      writeup: parsed.writeup || "",
      keyFactors: parsed.keyFactors || [],
      whatCouldGoWrong: parsed.whatCouldGoWrong || "",
    };
  } catch (err) {
    console.warn(`[BestPlay] Groq scoring failed:`, err.message);
    return null;
  }
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

async function findBestPlays(groq, apiKey) {
  console.log("[BestPlay] Scanning all sports for Top Plays of the Day...");

  // Fetch games from all sports
  const [nbaGames, mlbGames, nhlGames] = await Promise.all([
    fetchGamesForSport("nba", apiKey),
    fetchGamesForSport("mlb", apiKey),
    fetchGamesForSport("nhl", apiKey),
  ]);

  const allGames = [...nbaGames, ...mlbGames, ...nhlGames];
  console.log(`[BestPlay] Found ${allGames.length} total games`);

  // Fetch props from all sports
  const [nbaProps, mlbProps, nhlProps] = await Promise.all([
    fetchPropsForSport("nba", apiKey),
    fetchPropsForSport("mlb", apiKey),
    fetchPropsForSport("nhl", apiKey),
  ]);

  const allProps = [...nbaProps, ...mlbProps, ...nhlProps];
  console.log(`[BestPlay] Found ${allProps.length} total props`);

  // Generate all bet candidates
  const gameBets = generateBetsFromGames(allGames);
  const propBets = convertPropsToCandidate(allProps);
  const allCandidates = [...gameBets, ...propBets];

  console.log(`[BestPlay] ${allCandidates.length} total candidates to evaluate`);

  if (allCandidates.length === 0) {
    return { found: false, plays: [], reason: "No games or props available today" };
  }

  // Sample more candidates to find elite plays (8+ score)
  const sampleSize = Math.min(40, allCandidates.length);
  const sampledCandidates = allCandidates
    .sort(() => Math.random() - 0.5)
    .slice(0, sampleSize);

  console.log(`[BestPlay] Scoring ${sampledCandidates.length} candidates with Groq...`);

  // Score all candidates and collect results
  const scoredCandidates = [];
  const batchSize = 5;

  for (let i = 0; i < sampledCandidates.length; i += batchSize) {
    const batch = sampledCandidates.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (candidate) => {
        const score = await scoreBetWithGroq(groq, candidate);
        if (score) {
          // Calculate EV based on confidence (confidence/10 = estimated win probability)
          const estimatedWinProb = Math.min(0.75, Math.max(0.45, score.confidence / 10 + 0.1));
          const evData = calculateEV(candidate.odds, estimatedWinProb);
          return { ...candidate, ...score, ...evData };
        }
        return null;
      })
    );

    scoredCandidates.push(...results.filter(Boolean));

    // Small delay between batches
    if (i + batchSize < sampledCandidates.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // Filter to only elite plays (8+ score) and sort by score
  const elitePlays = scoredCandidates
    .filter((c) => c.heaterScore >= 8)
    .sort((a, b) => b.heaterScore - a.heaterScore || b.confidence - a.confidence)
    .slice(0, 3); // Top 3 elite plays

  if (elitePlays.length > 0) {
    console.log(`[BestPlay] Found ${elitePlays.length} elite plays (8+ score)`);
    return { found: true, plays: elitePlays };
  }

  // If no 8+ plays, return top 3 with 6+ as backup
  const goodPlays = scoredCandidates
    .filter((c) => c.heaterScore >= 6)
    .sort((a, b) => b.heaterScore - a.heaterScore || b.confidence - a.confidence)
    .slice(0, 3);

  if (goodPlays.length > 0) {
    console.log(`[BestPlay] No elite plays found, returning ${goodPlays.length} good plays (6+)`);
    return { found: true, plays: goodPlays, note: "No 8+ plays today - showing best available" };
  }

  // Last resort: return single best regardless of score
  if (scoredCandidates.length > 0) {
    const best = scoredCandidates.sort((a, b) => b.heaterScore - a.heaterScore)[0];
    console.log(`[BestPlay] Returning best available: ${best.teamOrPlayer} - Score ${best.heaterScore}/10`);
    return { found: true, plays: [best], note: "Limited high-value plays today" };
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
      isPaidUser,
      cached: true,
      cacheAge: Math.round((now - bestPlayCache.timestamp) / 60000),
    });
  }

  const apiKey = getOddsApiKey();
  const groq = getGroq();

  if (!apiKey) {
    console.error("[BestPlay] No ODDS_API_KEY configured");
    return NextResponse.json({ found: false, error: "Odds API not configured" });
  }

  if (!groq) {
    console.error("[BestPlay] GROQ_API_KEY not configured");
    return NextResponse.json({ found: false, error: "Groq not configured" });
  }

  // Find best plays (1-3 elite picks)
  console.log("[BestPlay] Generating fresh Best Plays...");
  const result = await findBestPlays(groq, apiKey);

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
    isPaidUser,
    cached: false,
    cacheAge: 0,
  });
}
