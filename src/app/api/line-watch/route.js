import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import Groq from "groq-sdk";

export const maxDuration = 60;

const SPORT_CONFIG = {
  nba: {
    espnKey: "basketball",
    espnLeague: "nba",
    oddsKey: "basketball_nba",
  },
  mlb: {
    espnKey: "baseball",
    espnLeague: "mlb",
    oddsKey: "baseball_mlb",
  },
  nhl: {
    espnKey: "hockey",
    espnLeague: "nhl",
    oddsKey: "icehockey_nhl",
  },
};

// In-memory cache
const lineWatchCache = { data: null, timestamp: 0 };
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

async function fetchEspnGames(sport) {
  const config = SPORT_CONFIG[sport];
  if (!config) return [];

  try {
    // Get tomorrow's date in YYYYMMDD format
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0].replace(/-/g, "");

    const url = `https://site.api.espn.com/apis/site/v2/sports/${config.espnKey}/${config.espnLeague}/scoreboard?dates=${dateStr}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];

    const data = await res.json();
    const events = data.events || [];

    return events.map((event) => {
      const competitors = event.competitions?.[0]?.competitors || [];
      const home = competitors.find((c) => c.homeAway === "home");
      const away = competitors.find((c) => c.homeAway === "away");

      return {
        id: event.id,
        sport: sport.toUpperCase(),
        homeTeam: home?.team?.displayName || home?.team?.name || "TBD",
        awayTeam: away?.team?.displayName || away?.team?.name || "TBD",
        homeAbbrev: home?.team?.abbreviation || "",
        awayAbbrev: away?.team?.abbreviation || "",
        commenceTime: event.date,
        venue: event.competitions?.[0]?.venue?.fullName || "",
      };
    });
  } catch (err) {
    console.warn(`[LineWatch] ESPN fetch failed for ${sport}:`, err.message);
    return [];
  }
}

async function fetchOddsForSport(sport, apiKey) {
  const config = SPORT_CONFIG[sport];
  if (!config) return [];

  try {
    const url = `https://api.the-odds-api.com/v4/sports/${config.oddsKey}/odds?apiKey=${apiKey}&regions=us&markets=spreads,totals&oddsFormat=american`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn(`[LineWatch] Odds fetch failed for ${sport}:`, err.message);
    return [];
  }
}

function matchOddsToGame(game, oddsData) {
  // Find matching odds event by team names
  const homeNorm = game.homeTeam.toLowerCase();
  const awayNorm = game.awayTeam.toLowerCase();

  for (const event of oddsData) {
    const eventHome = event.home_team?.toLowerCase() || "";
    const eventAway = event.away_team?.toLowerCase() || "";

    // Fuzzy match - check if team names are contained
    if (
      (eventHome.includes(homeNorm) || homeNorm.includes(eventHome) ||
        eventHome.includes(game.homeAbbrev?.toLowerCase())) &&
      (eventAway.includes(awayNorm) || awayNorm.includes(eventAway) ||
        eventAway.includes(game.awayAbbrev?.toLowerCase()))
    ) {
      const bookmaker = event.bookmakers?.[0];
      if (!bookmaker) continue;

      const spreads = bookmaker.markets?.find((m) => m.key === "spreads");
      const totals = bookmaker.markets?.find((m) => m.key === "totals");

      const homeSpread = spreads?.outcomes?.find((o) => o.name === event.home_team);
      const awaySpread = spreads?.outcomes?.find((o) => o.name === event.away_team);
      const over = totals?.outcomes?.find((o) => o.name === "Over");

      return {
        homeSpread: homeSpread?.point || null,
        awaySpread: awaySpread?.point || null,
        total: over?.point || null,
        bookmaker: bookmaker.title,
      };
    }
  }

  return null;
}

async function predictLineWithGroq(groq, game, currentOdds) {
  const prompt = `You are an expert sports betting analyst specializing in line prediction. Predict where you think the TRUE line should be for this game.

Sport: ${game.sport}
Matchup: ${game.awayTeam} @ ${game.homeTeam}
Game Time: ${game.commenceTime}
Venue: ${game.venue || "TBD"}

Current Market Lines (from ${currentOdds?.bookmaker || "sportsbook"}):
- Home Spread: ${currentOdds?.homeSpread || "N/A"}
- Total: ${currentOdds?.total || "N/A"}

Based on your knowledge of team performance, injuries, trends, and matchup factors, predict what the TRUE spread and total should be.

Respond with ONLY a JSON object (no markdown):
{
  "predictedHomeSpread": -3.5,
  "predictedTotal": 218.5,
  "spreadConfidence": 7,
  "totalConfidence": 8,
  "spreadAnalysis": "2-3 sentence analysis of why you predict this spread",
  "totalAnalysis": "2-3 sentence analysis of why you predict this total",
  "keyFactors": ["factor1", "factor2", "factor3"]
}

predictedHomeSpread: negative if home favored, positive if underdog
predictedTotal: your predicted over/under total
confidence: 1-10 scale of prediction confidence
analysis: brief explanation of prediction rationale
keyFactors: 3 most important factors in your prediction`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const text = completion.choices?.[0]?.message?.content?.trim();
    if (!text) return null;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      predictedHomeSpread: parseFloat(parsed.predictedHomeSpread) || 0,
      predictedTotal: parseFloat(parsed.predictedTotal) || 0,
      spreadConfidence: Math.min(10, Math.max(1, parseInt(parsed.spreadConfidence, 10) || 5)),
      totalConfidence: Math.min(10, Math.max(1, parseInt(parsed.totalConfidence, 10) || 5)),
      spreadAnalysis: parsed.spreadAnalysis || "",
      totalAnalysis: parsed.totalAnalysis || "",
      keyFactors: parsed.keyFactors || [],
    };
  } catch (err) {
    console.warn("[LineWatch] Groq prediction failed:", err.message);
    return null;
  }
}

function calculateValueGap(predicted, actual) {
  if (predicted === null || actual === null) return { gap: 0, hasValue: false };
  const gap = Math.abs(predicted - actual);
  return {
    gap: Math.round(gap * 10) / 10,
    hasValue: gap >= 2,
    direction: predicted > actual ? "OVER" : "UNDER",
  };
}

async function generateLineWatch(groq, apiKey) {
  console.log("[LineWatch] Fetching games from ESPN...");

  // Fetch tomorrow's games from ESPN for all sports
  const [nbaGames, mlbGames, nhlGames] = await Promise.all([
    fetchEspnGames("nba"),
    fetchEspnGames("mlb"),
    fetchEspnGames("nhl"),
  ]);

  const allGames = [...nbaGames, ...mlbGames, ...nhlGames];
  console.log(`[LineWatch] Found ${allGames.length} games for tomorrow`);

  if (allGames.length === 0) return [];

  // Fetch current odds from Odds API
  console.log("[LineWatch] Fetching current odds...");
  const [nbaOdds, mlbOdds, nhlOdds] = await Promise.all([
    fetchOddsForSport("nba", apiKey),
    fetchOddsForSport("mlb", apiKey),
    fetchOddsForSport("nhl", apiKey),
  ]);

  const oddsMap = {
    NBA: nbaOdds,
    MLB: mlbOdds,
    NHL: nhlOdds,
  };

  // Limit games to analyze (avoid rate limits)
  const maxGames = Math.min(allGames.length, 12);
  const selectedGames = allGames.slice(0, maxGames);

  console.log(`[LineWatch] Analyzing ${selectedGames.length} games with Groq...`);

  const results = [];
  const batchSize = 3;

  for (let i = 0; i < selectedGames.length; i += batchSize) {
    const batch = selectedGames.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (game) => {
        const currentOdds = matchOddsToGame(game, oddsMap[game.sport] || []);
        const prediction = await predictLineWithGroq(groq, game, currentOdds);

        if (!prediction) return null;

        const spreadGap = calculateValueGap(
          prediction.predictedHomeSpread,
          currentOdds?.homeSpread
        );
        const totalGap = calculateValueGap(
          prediction.predictedTotal,
          currentOdds?.total
        );

        return {
          ...game,
          currentOdds,
          prediction,
          spreadGap,
          totalGap,
          hasValueAlert: spreadGap.hasValue || totalGap.hasValue,
        };
      })
    );

    results.push(...batchResults.filter(Boolean));

    if (i + batchSize < selectedGames.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // Sort: value alerts first, then by confidence
  results.sort((a, b) => {
    if (a.hasValueAlert && !b.hasValueAlert) return -1;
    if (!a.hasValueAlert && b.hasValueAlert) return 1;
    const aConf = (a.prediction?.spreadConfidence || 0) + (a.prediction?.totalConfidence || 0);
    const bConf = (b.prediction?.spreadConfidence || 0) + (b.prediction?.totalConfidence || 0);
    return bConf - aConf;
  });

  return results;
}

export async function GET() {
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

  // Check subscription
  const hasSubscription = await hasActiveSubscription(email);
  if (!hasSubscription) {
    return NextResponse.json(
      {
        error: "Subscription required",
        code: "SUBSCRIPTION_REQUIRED",
        message: "Upgrade to EdgeCheck Pro to unlock Line Watch",
      },
      { status: 402 }
    );
  }

  const apiKey = getOddsApiKey();
  const groq = getGroq();

  if (!apiKey) {
    console.error("[LineWatch] No ODDS_API_KEY configured");
    return NextResponse.json({ games: [], error: "Odds API not configured" });
  }

  if (!groq) {
    console.error("[LineWatch] GROQ_API_KEY not configured");
    return NextResponse.json({ games: [], error: "Groq not configured" });
  }

  // Check cache
  const now = Date.now();
  if (lineWatchCache.data && now - lineWatchCache.timestamp < CACHE_TTL) {
    console.log("[LineWatch] Returning cached data");
    return NextResponse.json({
      games: lineWatchCache.data,
      cached: true,
      cacheAge: Math.round((now - lineWatchCache.timestamp) / 1000 / 60),
    });
  }

  // Generate fresh predictions
  console.log("[LineWatch] Generating fresh predictions...");
  const games = await generateLineWatch(groq, apiKey);

  // Update cache
  lineWatchCache.data = games;
  lineWatchCache.timestamp = now;

  return NextResponse.json({
    games,
    cached: false,
    cacheAge: 0,
    total: games.length,
    valueAlerts: games.filter((g) => g.hasValueAlert).length,
  });
}
