import { NextResponse } from "next/server";

// Server-side fallback proxy for ESPN API
// Primary fetching happens client-side (browser) to avoid datacenter IP blocks
// This route exists as a CORS fallback if direct browser fetch fails

const SPORT_CONFIG = {
  nfl: { sport: "football", league: "nfl", name: "NFL" },
  nba: { sport: "basketball", league: "nba", name: "NBA" },
  mlb: { sport: "baseball", league: "mlb", name: "MLB" },
  nhl: { sport: "hockey", league: "nhl", name: "NHL" },
  ncaaf: { sport: "football", league: "college-football", name: "NCAAF" },
  ncaab: { sport: "basketball", league: "mens-college-basketball", name: "NCAAB" },
  mls: { sport: "soccer", league: "usa.1", name: "MLS" },
};

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sportKey = (searchParams.get("sport") ?? "nba").toLowerCase();

  const config = SPORT_CONFIG[sportKey];
  if (!config) {
    return NextResponse.json(
      { error: `Unknown sport: ${sportKey}. Valid: ${Object.keys(SPORT_CONFIG).join(", ")}` },
      { status: 400 }
    );
  }

  const today = formatDate(new Date());
  const urls = [
    `https://site.api.espn.com/apis/site/v2/sports/${config.sport}/${config.league}/scoreboard?dates=${today}`,
    `https://site.api.espn.com/apis/site/v2/sports/${config.sport}/${config.league}/scoreboard`,
  ];

  for (const url of urls) {
    try {
      console.log(`[EdgeCheck] Fetching: ${url}`);
      const res = await fetch(url, {
        headers: {
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        console.warn(`[EdgeCheck] ESPN returned ${res.status} for ${url}`);
        continue;
      }

      const data = await res.json();
      console.log(`[EdgeCheck] Got ${data.events?.length ?? 0} events from ${url}`);

      // Pass through the raw ESPN response so client can parse it
      return NextResponse.json(data, {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      });
    } catch (err) {
      console.error(`[EdgeCheck] Fetch error for ${url}:`, err.message);
    }
  }

  // All ESPN fetches failed — return empty but valid response
  console.error(`[EdgeCheck] All ESPN endpoints failed for ${sportKey}`);
  return NextResponse.json(
    { events: [], leagues: [{ name: config.name }] },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30",
      },
    }
  );
}
