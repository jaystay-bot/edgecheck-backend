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

export const dynamic = "force-dynamic";

export async function GET(request) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ODDS_API_KEY not configured" },
      { status: 500 }
    );
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

  try {
    const url = `https://api.the-odds-api.com/v4/sports/${oddsSport}/odds/?apiKey=${apiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[EdgeCheck] Odds API error ${res.status}:`, text);
      return NextResponse.json(
        { error: "Odds API request failed", detail: text },
        { status: res.status }
      );
    }

    const data = await res.json();

    const games = data.map((event) => {
      const bookmaker = event.bookmakers?.[0];

      // Moneyline (h2h)
      const h2h = bookmaker?.markets?.find((m) => m.key === "h2h");
      const homeML = h2h?.outcomes?.find((o) => o.name === event.home_team);
      const awayML = h2h?.outcomes?.find((o) => o.name === event.away_team);

      // Spread (spreads / run line for MLB)
      const spreads = bookmaker?.markets?.find((m) => m.key === "spreads");
      const homeSpread = spreads?.outcomes?.find((o) => o.name === event.home_team);
      const awaySpread = spreads?.outcomes?.find((o) => o.name === event.away_team);

      // Totals (over/under)
      const totals = bookmaker?.markets?.find((m) => m.key === "totals");
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
        bookmaker: bookmaker?.title ?? null,
      };
    });

    return NextResponse.json(
      { games },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
        },
      }
    );
  } catch (err) {
    console.error("[EdgeCheck] Odds API fetch error:", err.message);
    return NextResponse.json(
      { error: "Failed to fetch odds", detail: err.message },
      { status: 502 }
    );
  }
}
