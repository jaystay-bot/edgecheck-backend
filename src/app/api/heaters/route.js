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

async function scoreBetWithGroq(groq, bet) {
  const prompt = `You are an expert sports betting analyst. Score this bet from 1-10 where 10 is the best edge.

Sport: ${bet.sport}
Game: ${bet.awayTeam} @ ${bet.homeTeam}
Game Time: ${bet.commenceTime}
Bet: ${bet.betType} - ${bet.betValue}
Odds: ${bet.odds > 0 ? "+" : ""}${bet.odds}

Respond with ONLY a JSON object in this exact format (no markdown, no explanation):
{"score": 7, "reason": "Brief 10-15 word reason why this bet has value or not"}`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 100,
      messages: [{ role: "user", content: prompt }],
    });

    const text = completion.choices?.[0]?.message?.content?.trim();
    if (!text) return null;

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      score: parseInt(parsed.score, 10) || 0,
      reason: parsed.reason || "",
    };
  } catch (err) {
    console.warn("[Heaters] Groq scoring failed:", err.message);
    return null;
  }
}

async function generateHeaters() {
  const groq = getGroq();
  if (!groq) {
    console.error("[Heaters] GROQ_API_KEY not configured");
    return [];
  }

  console.log("[Heaters] Fetching games from all sports...");

  // Fetch games from all sports in parallel
  const [nbaGames, mlbGames, nhlGames] = await Promise.all([
    fetchGamesForSport("nba"),
    fetchGamesForSport("mlb"),
    fetchGamesForSport("nhl"),
  ]);

  const allGames = [...nbaGames, ...mlbGames, ...nhlGames];
  console.log(`[Heaters] Found ${allGames.length} total games`);

  if (allGames.length === 0) return [];

  // Generate bets from games
  const allBets = generateBetsFromGames(allGames);
  console.log(`[Heaters] Generated ${allBets.length} potential bets`);

  // Limit to avoid API rate limits - take a sample of bets
  // Prioritize variety: spread across sports and bet types
  const sampleSize = Math.min(30, allBets.length);
  const sampledBets = allBets
    .sort(() => Math.random() - 0.5)
    .slice(0, sampleSize);

  console.log(`[Heaters] Scoring ${sampledBets.length} bets with Groq...`);

  // Score bets in parallel batches of 5 to avoid rate limits
  const scoredBets = [];
  const batchSize = 5;

  for (let i = 0; i < sampledBets.length; i += batchSize) {
    const batch = sampledBets.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (bet) => {
        const result = await scoreBetWithGroq(groq, bet);
        if (result && result.score >= 5) {
          return { ...bet, heaterScore: result.score, reason: result.reason };
        }
        return null;
      })
    );
    scoredBets.push(...results.filter(Boolean));

    // Small delay between batches
    if (i + batchSize < sampledBets.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  console.log(`[Heaters] Found ${scoredBets.length} heaters (score >= 5)`);

  // Sort by score descending, limit to 15
  const heaters = scoredBets
    .sort((a, b) => b.heaterScore - a.heaterScore)
    .slice(0, 15);

  return heaters;
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
