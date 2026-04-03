import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import Groq from "groq-sdk";

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

// In-memory cache for heaters
const heatersCache = { data: null, timestamp: 0 };
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

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
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length > 0) return true;

    const trialingSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: "trialing",
      limit: 1,
    });

    return trialingSubs.data.length > 0;
  } catch (err) {
    console.error("[Heaters] Stripe check error:", err.message);
    return false;
  }
}

async function fetchGamesForSport(sportKey) {
  const apiKey = getOddsApiKey();
  if (!apiKey) return [];

  const oddsSport = SPORT_MAP[sportKey];
  if (!oddsSport) return [];

  try {
    const url = `https://api.the-odds-api.com/v4/sports/${oddsSport}/odds/?apiKey=${apiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((event) => ({ ...event, sportKey }));
  } catch (err) {
    console.warn(`[Heaters] Failed to fetch ${sportKey}:`, err.message);
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
          id: `${event.id}_spread_home`,
          sport,
          homeTeam,
          awayTeam,
          commenceTime,
          betType: "Spread",
          betValue: `${homeTeam} ${homeSpread.point > 0 ? "+" : ""}${homeSpread.point}`,
          odds: homeSpread.price,
          bookmaker: bookmaker.title,
        });
      }
      if (awaySpread) {
        bets.push({
          id: `${event.id}_spread_away`,
          sport,
          homeTeam,
          awayTeam,
          commenceTime,
          betType: "Spread",
          betValue: `${awayTeam} ${awaySpread.point > 0 ? "+" : ""}${awaySpread.point}`,
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
          id: `${event.id}_ml_home`,
          sport,
          homeTeam,
          awayTeam,
          commenceTime,
          betType: "Moneyline",
          betValue: `${homeTeam} ${homeML.price > 0 ? "+" : ""}${homeML.price}`,
          odds: homeML.price,
          bookmaker: bookmaker.title,
        });
      }
      if (awayML) {
        bets.push({
          id: `${event.id}_ml_away`,
          sport,
          homeTeam,
          awayTeam,
          commenceTime,
          betType: "Moneyline",
          betValue: `${awayTeam} ${awayML.price > 0 ? "+" : ""}${awayML.price}`,
          odds: awayML.price,
          bookmaker: bookmaker.title,
        });
      }
    }

    // Totals bets
    const totals = bookmaker.markets?.find((m) => m.key === "totals");
    if (totals) {
      const over = totals.outcomes?.find((o) => o.name === "Over");
      const under = totals.outcomes?.find((o) => o.name === "Under");

      if (over) {
        bets.push({
          id: `${event.id}_over`,
          sport,
          homeTeam,
          awayTeam,
          commenceTime,
          betType: "Total",
          betValue: `Over ${over.point}`,
          odds: over.price,
          bookmaker: bookmaker.title,
        });
      }
      if (under) {
        bets.push({
          id: `${event.id}_under`,
          sport,
          homeTeam,
          awayTeam,
          commenceTime,
          betType: "Total",
          betValue: `Under ${under.point}`,
          odds: under.price,
          bookmaker: bookmaker.title,
        });
      }
    }
  }

  return bets;
}

// Deterministic scoring based on raw odds data - no AI
function scoreBetFromOdds(bet) {
  const odds = bet.odds;
  if (odds == null) return null;

  // Base score starts at 5
  let score = 5.0;
  let reason = "";

  // Value scoring based on odds
  if (odds >= 100 && odds <= 150) {
    // Small underdog ML - good value zone
    score += 2.5;
    reason = "Value underdog in the +100 to +150 sweet spot";
  } else if (odds >= 151 && odds <= 250) {
    // Medium underdog
    score += 2.0;
    reason = "Plus-money value play with upside potential";
  } else if (odds >= -150 && odds <= -110) {
    // Standard favorite - consistent
    score += 1.5;
    reason = "Favorable juice on a standard betting line";
  } else if (odds >= -200 && odds < -150) {
    // Moderate favorite
    score += 1.2;
    reason = "Moderate favorite with reasonable pricing";
  } else if (odds > 250) {
    // Long shot
    score += 0.8;
    reason = "Long shot with high reward potential";
  } else if (odds < -200) {
    // Heavy favorite
    score += 0.5;
    reason = "Heavy favorite - limited value but safer";
  } else {
    reason = "Standard betting opportunity";
  }

  // Bet type adjustments
  if (bet.betType === "Spread") {
    score += 0.3;
    reason += " - spread bet";
  } else if (bet.betType === "Moneyline" && odds > 0) {
    score += 0.4;
    reason += " - ML underdog";
  } else if (bet.betType === "Total") {
    score += 0.2;
  }

  // Add small variance for diversity (±0.4)
  const variance = (Math.random() - 0.5) * 0.8;
  score = Math.round((score + variance) * 10) / 10;

  // Clamp score to 1-10 range
  score = Math.min(10, Math.max(1, score));

  return { score, reason };
}

async function generateHeaters() {
  console.log("[Heaters] Fetching games from all sports...");

  // Fetch games from all sports in parallel
  const sportResults = await Promise.all(
    Object.keys(SPORT_MAP).map((sport) => fetchGamesForSport(sport))
  );

  const allGames = sportResults.flat();
  console.log(`[Heaters] Found ${allGames.length} total games across ${Object.keys(SPORT_MAP).length} sports`);

  if (allGames.length === 0) return [];

  // Generate bets from games
  const allBets = generateBetsFromGames(allGames);
  console.log(`[Heaters] Generated ${allBets.length} potential bets`);

  // Score ALL bets using deterministic odds-based scoring (fast, no API calls)
  console.log(`[Heaters] Scoring ${allBets.length} bets from raw odds data...`);

  const scoredBets = allBets
    .map((bet) => {
      const result = scoreBetFromOdds(bet);
      if (result) {
        return { ...bet, heaterScore: result.score, reason: result.reason };
      }
      return null;
    })
    .filter(Boolean);

  // HEATERS = scores 7.0 to 7.9 (good but not elite)
  const heaters = scoredBets
    .filter((bet) => bet.heaterScore >= 7.0 && bet.heaterScore < 8.0)
    .sort((a, b) => b.heaterScore - a.heaterScore)
    .slice(0, 15);

  console.log(`[Heaters] Found ${heaters.length} heaters (score 7.0-7.9)`);

  if (heaters.length > 0) {
    return heaters;
  }

  // Fallback: if no 7.0-7.9 bets, return best bets in 6.5-7.9 range
  const fallbackHeaters = scoredBets
    .filter((bet) => bet.heaterScore >= 6.5 && bet.heaterScore < 8.0)
    .sort((a, b) => b.heaterScore - a.heaterScore)
    .slice(0, 10);

  if (fallbackHeaters.length > 0) {
    console.log(`[Heaters] Using fallback: ${fallbackHeaters.length} bets (score 6.5-7.9)`);
    return fallbackHeaters;
  }

  // Last resort: top 10 best scoring bets
  console.log("[Heaters] No qualifying heaters, returning top available bets");
  return scoredBets
    .sort((a, b) => b.heaterScore - a.heaterScore)
    .slice(0, 10);
}

export async function GET(request) {
  // Check auth
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  if (!email) {
    return NextResponse.json(
      { error: "No email found", code: "NO_EMAIL" },
      { status: 400 }
    );
  }

  // Check subscription
  const hasSubscription = await hasActiveSubscription(email);
  if (!hasSubscription) {
    return NextResponse.json(
      {
        error: "Subscription required",
        code: "SUBSCRIPTION_REQUIRED",
        message: "Upgrade to EdgeCheck Pro to unlock Today's Heaters",
      },
      { status: 402 }
    );
  }

  // Check cache
  const now = Date.now();
  if (heatersCache.data && now - heatersCache.timestamp < CACHE_TTL) {
    console.log("[Heaters] Returning cached data");
    return NextResponse.json({
      heaters: heatersCache.data,
      cached: true,
      cacheAge: Math.round((now - heatersCache.timestamp) / 1000 / 60),
    });
  }

  // Generate new heaters
  console.log("[Heaters] Generating fresh heaters...");
  const heaters = await generateHeaters();

  // Update cache
  heatersCache.data = heaters;
  heatersCache.timestamp = now;

  return NextResponse.json({
    heaters,
    cached: false,
    cacheAge: 0,
  });
}
