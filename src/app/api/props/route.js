import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import Groq from "groq-sdk";

export const maxDuration = 60;

const SPORT_CONFIG = {
  nba: {
    oddsKey: "basketball_nba",
    maxProps: 15,
    cacheTTL: 15 * 60 * 1000, // 15 minutes
    markets: ["player_points", "player_rebounds", "player_assists", "player_threes"],
  },
  mlb: {
    oddsKey: "baseball_mlb",
    maxProps: 30,
    cacheTTL: 20 * 60 * 1000, // 20 minutes for high volume
    markets: ["batter_hits", "batter_total_bases", "batter_rbis", "pitcher_strikeouts"],
    minHitRate: 6, // MLB: only show 6/10+ hit rate
  },
  nhl: {
    oddsKey: "icehockey_nhl",
    maxProps: 15,
    cacheTTL: 15 * 60 * 1000,
    markets: ["player_points", "player_shots_on_goal", "player_goals"],
  },
};

// In-memory cache per sport
const propsCache = {
  nba: { data: null, timestamp: 0 },
  mlb: { data: null, timestamp: 0 },
  nhl: { data: null, timestamp: 0 },
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

async function fetchEvents(sportKey, apiKey) {
  try {
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/events?apiKey=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn(`[Props] Failed to fetch events for ${sportKey}:`, err.message);
    return [];
  }
}

async function fetchEventProps(sportKey, eventId, markets, apiKey) {
  try {
    const marketsParam = markets.join(",");
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/events/${eventId}/odds?apiKey=${apiKey}&regions=us&markets=${marketsParam}&oddsFormat=american`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`[Props] Failed to fetch props for event ${eventId}:`, err.message);
    return null;
  }
}

function parsePropsFromEvent(eventData, sport) {
  const props = [];
  if (!eventData || !eventData.bookmakers) return props;

  const bookmaker = eventData.bookmakers[0];
  if (!bookmaker) return props;

  const homeTeam = eventData.home_team;
  const awayTeam = eventData.away_team;
  const commenceTime = eventData.commence_time;
  const eventId = eventData.id;

  for (const market of bookmaker.markets || []) {
    const marketKey = market.key;
    const propType = formatPropType(marketKey);

    for (const outcome of market.outcomes || []) {
      const playerName = outcome.description || outcome.name;
      if (!playerName || playerName === "Over" || playerName === "Under") continue;

      // Determine team from player context (simplified - in real app would use roster data)
      const team = outcome.name?.includes(homeTeam) ? homeTeam : awayTeam;

      props.push({
        id: `${eventId}_${marketKey}_${playerName.replace(/\s/g, "_")}`,
        sport: sport.toUpperCase(),
        eventId,
        homeTeam,
        awayTeam,
        commenceTime,
        playerName,
        team: team || "TBD",
        propType,
        line: outcome.point || 0,
        odds: outcome.price || -110,
        overUnder: outcome.name?.toLowerCase().includes("under") ? "Under" : "Over",
        bookmaker: bookmaker.title,
      });
    }
  }

  // Dedupe by player+propType (keep first/best)
  const seen = new Set();
  return props.filter((p) => {
    const key = `${p.playerName}_${p.propType}_${p.overUnder}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatPropType(marketKey) {
  const mapping = {
    player_points: "Points",
    player_rebounds: "Rebounds",
    player_assists: "Assists",
    player_threes: "3-Pointers",
    player_blocks: "Blocks",
    player_steals: "Steals",
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

async function scorePropWithGroq(groq, prop, sport) {
  const sportContext = {
    NBA: "basketball player stats and trends",
    MLB: "baseball player performance and matchups",
    NHL: "hockey player stats and game context",
  };

  const prompt = `You are an expert sports betting analyst specializing in player props. Analyze this prop bet and provide detailed analysis.

Sport: ${prop.sport}
Game: ${prop.awayTeam} @ ${prop.homeTeam}
Game Time: ${prop.commenceTime}
Player: ${prop.playerName}
Team: ${prop.team}
Prop: ${prop.overUnder} ${prop.line} ${prop.propType}
Odds: ${prop.odds > 0 ? "+" : ""}${prop.odds}

Based on your knowledge of ${sportContext[prop.sport] || "sports"}:

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "heaterScore": 7,
  "confidence": 8,
  "hitRateLast10": 7,
  "seasonHitRate": 58,
  "last10Avg": 24.5,
  "writeup": "3-4 sentence analysis of why this prop has value or not. Include relevant trends, matchup factors, and situational edges.",
  "risk": "2 sentence explanation of what could go wrong with this bet."
}

heaterScore: 1-10 edge rating (10 = strongest edge)
confidence: 1-10 confidence level
hitRateLast10: estimated hits in last 10 games (0-10)
seasonHitRate: estimated season hit rate percentage (0-100)
last10Avg: estimated average for this stat over last 10 games
writeup: detailed 3-4 sentence analysis
risk: what could go wrong in 2 sentences`;

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
      heaterScore: Math.min(10, Math.max(1, parseInt(parsed.heaterScore, 10) || 5)),
      confidence: Math.min(10, Math.max(1, parseInt(parsed.confidence, 10) || 5)),
      hitRateLast10: Math.min(10, Math.max(0, parseInt(parsed.hitRateLast10, 10) || 5)),
      seasonHitRate: Math.min(100, Math.max(0, parseInt(parsed.seasonHitRate, 10) || 50)),
      last10Avg: parseFloat(parsed.last10Avg) || prop.line,
      writeup: parsed.writeup || "",
      risk: parsed.risk || "",
    };
  } catch (err) {
    console.warn("[Props] Groq scoring failed:", err.message);
    return null;
  }
}

async function fetchPropsForSport(sport, apiKey, groq, isPaidUser) {
  const config = SPORT_CONFIG[sport];
  if (!config) return [];

  console.log(`[Props] Fetching ${sport.toUpperCase()} events...`);
  const events = await fetchEvents(config.oddsKey, apiKey);
  if (!events.length) {
    console.log(`[Props] No ${sport.toUpperCase()} events found`);
    return [];
  }

  console.log(`[Props] Found ${events.length} ${sport.toUpperCase()} events, fetching props...`);

  // Limit events to avoid API rate limits
  const maxEvents = Math.min(events.length, sport === "mlb" ? 8 : 5);
  const selectedEvents = events.slice(0, maxEvents);

  let allProps = [];

  for (const event of selectedEvents) {
    const eventProps = await fetchEventProps(config.oddsKey, event.id, config.markets, apiKey);
    if (eventProps) {
      const parsed = parsePropsFromEvent(eventProps, sport);
      allProps.push(...parsed);
    }
    // Small delay between requests
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`[Props] Parsed ${allProps.length} raw props for ${sport.toUpperCase()}`);

  if (!allProps.length) return [];

  // Score props with Groq (limit to avoid rate limits)
  const propsToScore = allProps.slice(0, Math.min(allProps.length, config.maxProps * 2));
  const scoredProps = [];

  const batchSize = 3;
  for (let i = 0; i < propsToScore.length; i += batchSize) {
    const batch = propsToScore.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (prop) => {
        if (!isPaidUser) {
          // Free users get basic data only
          return { ...prop, heaterScore: null, confidence: null, writeup: null, risk: null };
        }
        const score = await scorePropWithGroq(groq, prop, sport);
        if (score) {
          return { ...prop, ...score };
        }
        return null;
      })
    );
    scoredProps.push(...results.filter(Boolean));

    if (i + batchSize < propsToScore.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // Apply sport-specific filtering
  let filteredProps = scoredProps;

  if (sport === "mlb" && isPaidUser) {
    // MLB: Filter to 6/10+ hit rate, only 7+ heater scores
    filteredProps = scoredProps.filter(
      (p) => p.hitRateLast10 >= config.minHitRate && p.heaterScore >= 7
    );
    // Sort by hit rate high to low
    filteredProps.sort((a, b) => b.hitRateLast10 - a.hitRateLast10);
  } else if (isPaidUser) {
    // Other sports: sort by heater score
    filteredProps = scoredProps.filter((p) => p.heaterScore >= 7);
    filteredProps.sort((a, b) => b.heaterScore - a.heaterScore);
  }

  // Apply max limit
  return filteredProps.slice(0, config.maxProps);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sport = (searchParams.get("sport") || "all").toLowerCase();
  const filter = searchParams.get("filter") || "all"; // all, heaters

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
    return NextResponse.json({ props: [], error: "Odds API not configured" });
  }

  if (!groq && isPaidUser) {
    console.error("[Props] GROQ_API_KEY not configured");
  }

  const sportsToFetch = sport === "all" ? ["nba", "mlb", "nhl"] : [sport];
  const allProps = [];

  for (const s of sportsToFetch) {
    const config = SPORT_CONFIG[s];
    if (!config) continue;

    const cache = propsCache[s];
    const now = Date.now();

    // Check cache
    if (cache.data && now - cache.timestamp < config.cacheTTL) {
      console.log(`[Props] Using cached ${s.toUpperCase()} props`);
      allProps.push(...cache.data);
      continue;
    }

    // Fetch fresh props
    console.log(`[Props] Fetching fresh ${s.toUpperCase()} props...`);
    const props = await fetchPropsForSport(s, apiKey, groq, isPaidUser);

    // Update cache
    propsCache[s] = { data: props, timestamp: now };
    allProps.push(...props);
  }

  // Apply heaters filter if requested
  let result = allProps;
  if (filter === "heaters" && isPaidUser) {
    result = allProps.filter((p) => p.heaterScore >= 8);
  }

  // Sort all by heater score (paid) or by sport/time (free)
  if (isPaidUser) {
    result.sort((a, b) => (b.heaterScore || 0) - (a.heaterScore || 0));
  }

  return NextResponse.json({
    props: result,
    total: result.length,
    isPaidUser,
    cached: sportsToFetch.every((s) => {
      const cache = propsCache[s];
      return cache.data && Date.now() - cache.timestamp < SPORT_CONFIG[s]?.cacheTTL;
    }),
  });
}
