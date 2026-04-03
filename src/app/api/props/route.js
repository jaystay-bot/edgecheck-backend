import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { hasActiveSubscription } from "../../../lib/subscription";

export const maxDuration = 60;

// Minimum edge percentage required to show a prop (0 = show all props, sort by edge)
const MIN_EDGE_PERCENT = 0;

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
        maxProps: 10, // Max 10 Hit props per requirements
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
        name: "Goal Scorer Props",
        markets: ["player_goals"],
        maxProps: 10, // Goal scorer props
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
        name: "Points Props",
        markets: ["player_points"],
        maxProps: 10, // Limited to 10 total per requirements
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

function getOddsApiKey() {
  for (let i = 1; i <= 10; i++) {
    const key = process.env[`ODDS_API_KEY_${i}`];
    if (key) return key;
  }
  return process.env.ODDS_API_KEY || null;
}

// Fetch MLB props from Underdog Fantasy API (free, no auth required)
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

    const mlbProps = [];

    for (const line of lines) {
      const options = line.options || [];
      if (options.length < 1) continue;

      const subheader = options[0].selection_subheader || "";
      const playerName = options[0].selection_header || "";

      // Filter for MLB Home Runs (exact match, not combos)
      if (subheader.includes("Home Run") && !subheader.includes("+")) {
        const overOdds = options[0]?.american_price;
        const underOdds = options[1]?.american_price;

        mlbProps.push({
          id: `underdog_hr_${line.id || playerName}`,
          sport: "MLB",
          eventId: line.id,
          homeTeam: "MLB",
          awayTeam: "Game",
          commenceTime: new Date().toISOString(),
          playerName,
          propType: "Home Runs",
          marketKey: "batter_home_runs",
          line: parseFloat(line.stat_value) || 0.5,
          overUnder: "Over",
          odds: [{ bookmaker: "Underdog", price: parseInt(overOdds) || -110 }],
        });
      }

      // Filter for MLB Hits (not combos like "Hits + Runs + RBIs")
      // Only allow realistic lines: 0.5 or 1.5 hits
      if (subheader.includes("Hits") && !subheader.includes("+")) {
        const hitLine = parseFloat(line.stat_value) || 0.5;

        // Only include realistic hit lines (0.5 or 1.5)
        if (hitLine === 0.5 || hitLine === 1.5) {
          const overOdds = options[0]?.american_price;

          mlbProps.push({
            id: `underdog_hit_${line.id || playerName}`,
            sport: "MLB",
            eventId: line.id,
            homeTeam: "MLB",
            awayTeam: "Game",
            commenceTime: new Date().toISOString(),
            playerName,
            propType: "Hits",
            marketKey: "batter_hits",
            line: hitLine,
            overUnder: "Over",
            odds: [{ bookmaker: "Underdog", price: parseInt(overOdds) || -110 }],
          });
        }
      }
    }

    const hrCount = mlbProps.filter((p) => p.marketKey === "batter_home_runs").length;
    const hitCount = mlbProps.filter((p) => p.marketKey === "batter_hits").length;
    console.log(`[Props] Parsed ${hrCount} HR props, ${hitCount} Hit props from Underdog`);

    return mlbProps;
  } catch (err) {
    console.error("[Props] Failed to fetch from Underdog:", err.message);
    return [];
  }
}

// Fetch ALL props for a sport in ONE call
async function fetchAllPropsForSport(sportKey, apiKey) {
  // Use Underdog for MLB props (more reliable data)
  if (sportKey === "mlb") {
    return await fetchMLBPropsFromUnderdog();
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

    // Add edge data and filter by minimum edge requirement
    categoryProps = addEdgeDataToProps(categoryProps);

    // Sort by edge (highest edge first)
    categoryProps.sort((a, b) => parseFloat(b.edge) - parseFloat(a.edge));

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

      return {
        ...prop,
        bestOdds,
        impliedProbability: (impliedProb * 100).toFixed(1),
        modelProbability: (modelProb * 100).toFixed(1),
        edge: edge.toFixed(1),
        hasEdge: isSingleSource || edge >= MIN_EDGE_PERCENT,
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

  if (!apiKey) {
    console.error("[Props] No ODDS_API_KEY configured");
    return NextResponse.json({ categories: [], error: "DATA MISSING: Odds API not configured" });
  }

  // Get props for requested sport(s)
  const sportsToFetch = sport === "all" ? ["mlb", "nba", "nhl"] : [sport];
  const allCategories = [];

  for (const s of sportsToFetch) {
    if (!SPORT_CONFIG[s]) continue;
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

  return NextResponse.json({
    categories: allCategories,
    sport: sport.toUpperCase(),
    isPaidUser,
    edgeRequirement: `${MIN_EDGE_PERCENT}%`,
    cached: cache.data && Date.now() - cache.timestamp < (SPORT_CONFIG[sport]?.cacheTTL || 0),
    cacheAge: cache.timestamp ? Math.round((Date.now() - cache.timestamp) / 60000) : 0,
  });
}
