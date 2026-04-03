import { NextResponse } from "next/server";

const SPORT_MAP = {
  nba: "basketball_nba",
  nfl: "americanfootball_nfl",
  mlb: "baseball_mlb",
  nhl: "icehockey_nhl",
  ncaaf: "americanfootball_ncaaf",
  ncaab: "basketball_ncaab",
  mls: "soccer_usa_mls",
};

// In-memory cache: { [sportKey]: { data, timestamp } }
const cache = {};
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export const dynamic = "force-dynamic";

function findMarket(bookmakers, marketKey) {
  for (const bm of bookmakers || []) {
    const market = bm.markets?.find((m) => m.key === marketKey);
    if (market) return { market, bookmaker: bm.title };
  }
  return { market: null, bookmaker: null };
}

function parseGames(data) {
  return data.map((event) => {
    const bookmakers = event.bookmakers || [];

    // Search all bookmakers for each market type
    const { market: h2h } = findMarket(bookmakers, "h2h");
    const homeML = h2h?.outcomes?.find((o) => o.name === event.home_team);
    const awayML = h2h?.outcomes?.find((o) => o.name === event.away_team);

    const { market: spreads } = findMarket(bookmakers, "spreads");
    const homeSpread = spreads?.outcomes?.find((o) => o.name === event.home_team);
    const awaySpread = spreads?.outcomes?.find((o) => o.name === event.away_team);

    const { market: totals } = findMarket(bookmakers, "totals");
    const over = totals?.outcomes?.find((o) => o.name === "Over");
    const under = totals?.outcomes?.find((o) => o.name === "Under");

    return {
      homeTeam: event.home_team,
      awayTeam: event.away_team,
      commenceTime: event.commence_time,
      moneyline: {
        home: homeML?.price ?? null,
        away: awayML?.price ?? null,
      },
      spread: {
        home: homeSpread?.point ?? null,
        away: awaySpread?.point ?? null,
        homeOdds: homeSpread?.price ?? null,
        awayOdds: awaySpread?.price ?? null,
      },
      total: {
        overUnder: over?.point ?? under?.point ?? null,
        overOdds: over?.price ?? null,
        underOdds: under?.price ?? null,
      },
      bookmaker: bookmakers[0]?.title ?? null,
    };
  });
}

function emptyResponse() {
  return NextResponse.json(
    { games: [] },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
  );
}

function getApiKeys() {
  const keys = [];
  // Support numbered keys: ODDS_API_KEY_1, ODDS_API_KEY_2, ...
  for (let i = 1; i <= 10; i++) {
    const key = process.env[`ODDS_API_KEY_${i}`];
    if (key) keys.push(key);
  }
  // Fallback to single ODDS_API_KEY
  if (!keys.length && process.env.ODDS_API_KEY) {
    keys.push(process.env.ODDS_API_KEY);
  }
  return keys;
}

export async function GET(request) {
  const apiKeys = getApiKeys();
  if (!apiKeys.length) {
    console.warn("[EdgeCheck] No ODDS_API_KEY configured");
    return emptyResponse();
  }

  const { searchParams } = new URL(request.url);
  const sportKey = (searchParams.get("sport") ?? "nba").toLowerCase();
  const oddsSport = SPORT_MAP[sportKey];

  if (!oddsSport) {
    return NextResponse.json(
      { error: `Unknown sport: ${sportKey}` },
      { status: 400 }
    );
  }

  // Check cache
  const cached = cache[sportKey];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(
      { games: cached.data },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } }
    );
  }

  // Try each API key, rotating on 401/429
  for (let i = 0; i < apiKeys.length; i++) {
    try {
      const url = `https://api.the-odds-api.com/v4/sports/${oddsSport}/odds/?apiKey=${apiKeys[i]}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

      if (res.status === 401 || res.status === 429) {
        console.warn(`[EdgeCheck] Key ${i + 1} returned ${res.status}, trying next`);
        continue;
      }

      if (!res.ok) {
        console.error(`[EdgeCheck] Odds API error ${res.status}`);
        break; // Non-auth error, don't try other keys
      }

      const data = await res.json();
      const games = parseGames(data);

      cache[sportKey] = { data: games, timestamp: Date.now() };

      return NextResponse.json(
        { games },
        { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } }
      );
    } catch (err) {
      console.error(`[EdgeCheck] Key ${i + 1} fetch error:`, err.message);
      continue;
    }
  }

  // All keys exhausted — serve stale cache or empty
  if (cached) {
    return NextResponse.json(
      { games: cached.data },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
    );
  }
  return emptyResponse();
}
