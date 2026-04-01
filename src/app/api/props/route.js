import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import Groq from "groq-sdk";

export const maxDuration = 60;

// Sport and category configuration
const SPORT_CONFIG = {
  mlb: {
    oddsKey: "baseball_mlb",
    cacheTTL: 4 * 60 * 60 * 1000, // 4 hours
    categories: [
      {
        id: "hits",
        name: "To Record 1+ Hit",
        markets: ["batter_hits"],
        maxProps: 10,
        filterFn: (prop) => prop.line <= 0.5 || prop.overUnder === "Over",
      },
      {
        id: "home_runs",
        name: "Home Run Props",
        markets: ["batter_home_runs"],
        maxProps: 10,
        filterFn: () => true,
      },
      {
        id: "strikeouts",
        name: "Pitcher Strikeouts",
        markets: ["pitcher_strikeouts"],
        maxProps: 5,
        filterFn: () => true,
      },
    ],
  },
  nba: {
    oddsKey: "basketball_nba",
    cacheTTL: 4 * 60 * 60 * 1000,
    categories: [
      {
        id: "points",
        name: "Top Points Props",
        markets: ["player_points"],
        maxProps: 10,
        filterFn: () => true,
      },
      {
        id: "assists",
        name: "Top Assists Props",
        markets: ["player_assists"],
        maxProps: 10,
        filterFn: () => true,
      },
      {
        id: "rebounds",
        name: "Top Rebounds Props",
        markets: ["player_rebounds"],
        maxProps: 10,
        filterFn: () => true,
      },
    ],
  },
  nhl: {
    oddsKey: "icehockey_nhl",
    cacheTTL: 4 * 60 * 60 * 1000,
    categories: [
      {
        id: "goals",
        name: "Top Goals Props",
        markets: ["player_goals"],
        maxProps: 10,
        filterFn: () => true,
      },
      {
        id: "shots",
        name: "Shots on Goal Props",
        markets: ["player_shots_on_goal"],
        maxProps: 10,
        filterFn: () => true,
      },
    ],
  },
};

// Cache per sport - stores all props for the day
const propsCache = {
  mlb: { data: null, timestamp: 0, scored: false },
  nba: { data: null, timestamp: 0, scored: false },
  nhl: { data: null, timestamp: 0, scored: false },
};

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

// Fetch ALL props for a sport in ONE call
async function fetchAllPropsForSport(sportKey, apiKey) {
  const config = SPORT_CONFIG[sportKey];
  if (!config) return [];

  // Collect all unique markets for this sport
  const allMarkets = [...new Set(config.categories.flatMap((c) => c.markets))];

  try {
    const url = `https://api.the-odds-api.com/v4/sports/${config.oddsKey}/odds?apiKey=${apiKey}&regions=us&markets=${allMarkets.join(",")}&oddsFormat=american`;
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

    // Sort by best odds value (closest to even money, prefer positive)
    categoryProps.sort((a, b) => {
      const aOdds = getBestOdds(a.odds);
      const bOdds = getBestOdds(b.odds);
      // Prefer positive odds, then closest to -100
      if (aOdds > 0 && bOdds <= 0) return -1;
      if (bOdds > 0 && aOdds <= 0) return 1;
      if (aOdds > 0 && bOdds > 0) return bOdds - aOdds; // Higher positive better
      return bOdds - aOdds; // Less negative better
    });

    // Limit to max props
    categoryProps = categoryProps.slice(0, category.maxProps);

    // Add best odds to each prop
    categoryProps = categoryProps.map((prop) => ({
      ...prop,
      bestOdds: getBestOdds(prop.odds),
    }));

    categories.push({
      id: category.id,
      name: category.name,
      sport: sportKey.toUpperCase(),
      props: categoryProps,
    });
  }

  return categories;
}

async function scorePropWithGroq(groq, prop, categoryId, sportKey) {
  const sportContext = {
    mlb: {
      hits: "batting average, hit streaks, pitcher matchup quality",
      home_runs: "power numbers, ballpark factors, pitcher HR tendency",
      strikeouts: "pitcher K rate, opponent strikeout tendency, recent form",
    },
    nba: {
      points: "scoring average, matchup, pace of play",
      assists: "playmaking role, pace, opponent assist defense",
      rebounds: "rebounding rate, matchup size, pace",
    },
    nhl: {
      goals: "shooting percentage, ice time, opponent goalie",
      shots: "shots per game, power play time, matchup",
    },
  };

  const context = sportContext[sportKey]?.[categoryId] || "player performance trends";

  const prompt = `You are an expert sports betting analyst. Analyze this ${sportKey.toUpperCase()} prop bet.

Player: ${prop.playerName}
Game: ${prop.awayTeam} @ ${prop.homeTeam}
Game Time: ${prop.commenceTime}
Prop: ${prop.overUnder} ${prop.line} ${prop.propType}
Best Odds: ${prop.bestOdds > 0 ? "+" : ""}${prop.bestOdds}

Focus on: ${context}

Respond with ONLY a JSON object (no markdown):
{
  "heaterScore": 7,
  "confidence": 8,
  "hitRateLast10": 7,
  "relevantStat": "0.312 BA",
  "writeup": "3-4 sentence analysis explaining the edge or lack thereof.",
  "keyFactor": "One key reason this prop has value"
}

heaterScore: 1-10 edge rating (10=best)
confidence: 1-10 confidence
hitRateLast10: estimated hits in last 10 (0-10)
relevantStat: the most relevant stat for this prop type
writeup: detailed 3-4 sentence analysis
keyFactor: single most important factor`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 300,
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
      hitRateLast10: Math.min(10, Math.max(0, parseInt(parsed.hitRateLast10, 10) || 5)),
      relevantStat: parsed.relevantStat || "",
      writeup: parsed.writeup || "",
      keyFactor: parsed.keyFactor || "",
    };
  } catch (err) {
    console.warn(`[Props] Groq scoring failed for ${prop.playerName}:`, err.message);
    return null;
  }
}

async function scoreAllCategories(categories, sportKey, groq) {
  console.log(`[Props] Scoring ${sportKey.toUpperCase()} props with Groq...`);

  for (const category of categories) {
    const scoredProps = [];

    // Score in small batches to avoid rate limits
    const batchSize = 3;
    for (let i = 0; i < category.props.length; i += batchSize) {
      const batch = category.props.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (prop) => {
          const score = await scorePropWithGroq(groq, prop, category.id, sportKey);
          if (score) {
            return { ...prop, ...score };
          }
          return prop;
        })
      );
      scoredProps.push(...results);

      // Small delay between batches
      if (i + batchSize < category.props.length) {
        await new Promise((r) => setTimeout(r, 150));
      }
    }

    // Sort by heater score
    scoredProps.sort((a, b) => (b.heaterScore || 0) - (a.heaterScore || 0));
    category.props = scoredProps;
  }

  return categories;
}

async function getPropsForSport(sportKey, apiKey, groq, isPaidUser) {
  const config = SPORT_CONFIG[sportKey];
  if (!config) return [];

  const cache = propsCache[sportKey];
  const now = Date.now();

  // Check cache
  if (cache.data && now - cache.timestamp < config.cacheTTL) {
    console.log(`[Props] Using cached ${sportKey.toUpperCase()} props (${Math.round((now - cache.timestamp) / 60000)}min old)`);

    // Return cached data, but trigger background scoring if not done
    if (!cache.scored && isPaidUser && groq) {
      // Don't await - score in background
      scoreAllCategories(cache.data, sportKey, groq).then((scored) => {
        propsCache[sportKey] = { data: scored, timestamp: cache.timestamp, scored: true };
      });
    }

    return cache.data;
  }

  // Fetch fresh props - ONE API call
  const allProps = await fetchAllPropsForSport(sportKey, apiKey);

  if (allProps.length === 0) {
    return [];
  }

  // Organize into categories
  let categories = organizeIntoCategories(allProps, sportKey);

  // Cache immediately (unscored)
  propsCache[sportKey] = { data: categories, timestamp: now, scored: false };

  // Score with Groq if paid user (in background for faster initial load)
  if (isPaidUser && groq) {
    // Start scoring in background
    scoreAllCategories(categories, sportKey, groq).then((scored) => {
      propsCache[sportKey] = { data: scored, timestamp: now, scored: true };
    });
  }

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
  const groq = getGroq();

  if (!apiKey) {
    console.error("[Props] No ODDS_API_KEY configured");
    return NextResponse.json({ categories: [], error: "Odds API not configured" });
  }

  // Get props for requested sport(s)
  const sportsToFetch = sport === "all" ? ["mlb", "nba", "nhl"] : [sport];
  const allCategories = [];

  for (const s of sportsToFetch) {
    if (!SPORT_CONFIG[s]) continue;
    const categories = await getPropsForSport(s, apiKey, groq, isPaidUser);
    allCategories.push(...categories);
  }

  // For free users, strip out analysis data
  if (!isPaidUser) {
    for (const category of allCategories) {
      category.props = category.props.map((prop) => ({
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
        // Strip: heaterScore, confidence, hitRateLast10, relevantStat, writeup, keyFactor, odds
      }));
    }
  }

  const cache = propsCache[sport] || {};

  return NextResponse.json({
    categories: allCategories,
    sport: sport.toUpperCase(),
    isPaidUser,
    cached: cache.data && Date.now() - cache.timestamp < (SPORT_CONFIG[sport]?.cacheTTL || 0),
    cacheAge: cache.timestamp ? Math.round((Date.now() - cache.timestamp) / 60000) : 0,
    scored: cache.scored || false,
  });
}
