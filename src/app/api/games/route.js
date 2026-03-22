import { NextResponse } from "next/server";

const SPORT_CONFIG = {
  nfl: { sport: "football", league: "nfl", name: "NFL" },
  nba: { sport: "basketball", league: "nba", name: "NBA" },
  mlb: { sport: "baseball", league: "mlb", name: "MLB" },
  nhl: { sport: "hockey", league: "nhl", name: "NHL" },
  ncaaf: {
    sport: "football",
    league: "college-football",
    name: "NCAAF",
  },
  ncaab: {
    sport: "basketball",
    league: "mens-college-basketball",
    name: "NCAAB",
  },
  mls: { sport: "soccer", league: "usa.1", name: "MLS" },
};

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function parseOdds(competition) {
  const odds = competition.odds?.[0];
  if (!odds) return null;

  return {
    spread: {
      home: odds.homeTeamOdds?.spread ?? odds.spread ?? null,
      away: odds.awayTeamOdds?.spread ?? (odds.spread ? -odds.spread : null),
      homeOdds: odds.homeTeamOdds?.spreadOdds ?? null,
      awayOdds: odds.awayTeamOdds?.spreadOdds ?? null,
    },
    moneyline: {
      home: odds.homeTeamOdds?.moneyLine ?? null,
      away: odds.awayTeamOdds?.moneyLine ?? null,
    },
    overUnder: odds.overUnder ?? null,
    overOdds: odds.overOdds ?? null,
    underOdds: odds.underOdds ?? null,
    provider: odds.provider?.name ?? "ESPN",
  };
}

function parseGame(event, sportKey) {
  const competition = event.competitions?.[0];
  if (!competition) return null;

  const homeTeamData = competition.competitors?.find((c) => c.homeAway === "home");
  const awayTeamData = competition.competitors?.find((c) => c.homeAway === "away");

  if (!homeTeamData || !awayTeamData) return null;

  const homeTeam = homeTeamData.team;
  const awayTeam = awayTeamData.team;

  return {
    id: event.id,
    sport: sportKey,
    status: event.status?.type?.description ?? "Scheduled",
    statusDetail: event.status?.type?.detail ?? "",
    shortDetail: event.status?.type?.shortDetail ?? "",
    state: event.status?.type?.state ?? "pre",
    startTime: event.date,
    venue: competition.venue?.fullName ?? "",
    broadcast: competition.broadcasts?.[0]?.names?.[0] ?? "",
    homeTeam: {
      id: homeTeam.id,
      name: homeTeam.displayName ?? homeTeam.name,
      abbreviation: homeTeam.abbreviation,
      logo: homeTeam.logo,
      score: homeTeamData.score ?? "0",
      record: homeTeamData.records?.[0]?.summary ?? "",
    },
    awayTeam: {
      id: awayTeam.id,
      name: awayTeam.displayName ?? awayTeam.name,
      abbreviation: awayTeam.abbreviation,
      logo: awayTeam.logo,
      score: awayTeamData.score ?? "0",
      record: awayTeamData.records?.[0]?.summary ?? "",
    },
    odds: parseOdds(competition),
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sportKey = (searchParams.get("sport") ?? "nba").toLowerCase();
  const dateParam = searchParams.get("date");

  const config = SPORT_CONFIG[sportKey];
  if (!config) {
    return NextResponse.json(
      { error: `Unknown sport: ${sportKey}. Valid: ${Object.keys(SPORT_CONFIG).join(", ")}` },
      { status: 400 }
    );
  }

  const today = dateParam ?? formatDate(new Date());
  const url = `https://site.api.espn.com/apis/site/v2/sports/${config.sport}/${config.league}/scoreboard?dates=${today}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "EdgeCheck/1.0" },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      throw new Error(`ESPN API returned ${res.status}`);
    }

    const data = await res.json();
    const events = data.events ?? [];
    const games = events.map((e) => parseGame(e, sportKey)).filter(Boolean);

    return NextResponse.json({
      sport: sportKey,
      sportName: config.name,
      date: today,
      count: games.length,
      games,
    });
  } catch (err) {
    console.error("ESPN API error:", err.message);
    return NextResponse.json(
      { error: "Failed to fetch games from ESPN", detail: err.message },
      { status: 502 }
    );
  }
}
