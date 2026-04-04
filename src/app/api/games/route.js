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

// Sports that should fetch pickcenter odds from ESPN summary endpoint
const SPORTS_WITH_ODDS = ["nba", "nhl"];

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

// Fetch pickcenter odds from ESPN summary endpoint for a single event
async function fetchEventOdds(sport, league, eventId) {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/summary?event=${eventId}`;
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const pickcenter = data.pickcenter?.[0]; // Primary provider (usually DraftKings)

    if (!pickcenter) return null;

    // Normalize pickcenter odds to standard format
    return {
      provider: pickcenter.provider?.name || "ESPN",
      spread: {
        line: pickcenter.spread ?? null,
        homeOdds: pickcenter.homeTeamOdds?.spreadOdds ?? -110,
        awayOdds: pickcenter.awayTeamOdds?.spreadOdds ?? -110,
      },
      moneyline: {
        home: pickcenter.homeTeamOdds?.moneyLine ?? null,
        away: pickcenter.awayTeamOdds?.moneyLine ?? null,
      },
      total: {
        line: pickcenter.overUnder ?? null,
        overOdds: pickcenter.overOdds ?? -110,
        underOdds: pickcenter.underOdds ?? -110,
      },
    };
  } catch (err) {
    console.warn(`[Games] Failed to fetch odds for event ${eventId}:`, err.message);
    return null;
  }
}

// Enrich events with pickcenter odds (parallel fetch, max 10 concurrent)
async function enrichEventsWithOdds(events, sport, league) {
  if (!events || events.length === 0) return events;

  console.log(`[Games] Fetching odds for ${events.length} ${league.toUpperCase()} events...`);

  // Fetch odds for all events in parallel (limit to first 10 to avoid rate limits)
  const eventsToEnrich = events.slice(0, 10);
  const oddsPromises = eventsToEnrich.map((event) =>
    fetchEventOdds(sport, league, event.id)
  );

  const oddsResults = await Promise.all(oddsPromises);

  // Attach odds to each event
  let enrichedCount = 0;
  for (let i = 0; i < eventsToEnrich.length; i++) {
    if (oddsResults[i]) {
      eventsToEnrich[i].odds = oddsResults[i];
      enrichedCount++;
    }
  }

  console.log(`[Games] Enriched ${enrichedCount}/${eventsToEnrich.length} events with odds`);
  return events;
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
      console.log(`[Games] Fetching: ${url}`);
      const res = await fetch(url, {
        headers: {
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        console.warn(`[Games] ESPN returned ${res.status} for ${url}`);
        continue;
      }

      const data = await res.json();
      console.log(`[Games] Got ${data.events?.length ?? 0} events from ${url}`);

      // For NBA and NHL, enrich events with pickcenter odds
      if (SPORTS_WITH_ODDS.includes(sportKey) && data.events?.length > 0) {
        data.events = await enrichEventsWithOdds(
          data.events,
          config.sport,
          config.league
        );
      }

      return NextResponse.json(data, {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      });
    } catch (err) {
      console.error(`[Games] Fetch error for ${url}:`, err.message);
    }
  }

  // All ESPN fetches failed — return empty but valid response
  console.error(`[Games] All ESPN endpoints failed for ${sportKey}`);
  return NextResponse.json(
    { events: [], leagues: [{ name: config.name }] },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30",
      },
    }
  );
}
