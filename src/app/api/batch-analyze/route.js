import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import {
  setAnalysis,
  setLastBatchTimestamp,
  getCacheStats,
} from "../../../lib/analysis-cache";

export const maxDuration = 300; // 5 minutes for batch processing

const SPORT_CONFIG = {
  nba: { espn: "basketball/nba", label: "NBA" },
  nfl: { espn: "football/nfl", label: "NFL" },
  mlb: { espn: "baseball/mlb", label: "MLB" },
  nhl: { espn: "hockey/nhl", label: "NHL" },
  ncaaf: { espn: "football/college-football", label: "NCAAF" },
  ncaab: { espn: "basketball/mens-college-basketball", label: "NCAAB" },
};

function getGroq() {
  if (!process.env.GROQ_API_KEY) return null;
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

function formatDateParam(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

async function fetchESPNGames(sportKey, sportConfig) {
  const today = formatDateParam(new Date());
  const baseUrl = "https://site.api.espn.com/apis/site/v2/sports";

  try {
    const res = await fetch(`${baseUrl}/${sportConfig.espn}/scoreboard?dates=${today}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];

    const data = await res.json();
    const events = data.events || [];

    return events.map((event) => {
      const competition = event.competitions?.[0];
      if (!competition) return null;

      const homeTeamData = competition.competitors?.find((c) => c.homeAway === "home");
      const awayTeamData = competition.competitors?.find((c) => c.homeAway === "away");
      if (!homeTeamData || !awayTeamData) return null;

      const odds = competition.odds?.[0];

      return {
        id: event.id,
        sport: sportKey,
        sportLabel: sportConfig.label,
        homeTeam: {
          name: homeTeamData.team?.displayName || homeTeamData.team?.name,
          abbreviation: homeTeamData.team?.abbreviation,
          record: homeTeamData.records?.[0]?.summary || "",
        },
        awayTeam: {
          name: awayTeamData.team?.displayName || awayTeamData.team?.name,
          abbreviation: awayTeamData.team?.abbreviation,
          record: awayTeamData.records?.[0]?.summary || "",
        },
        startTime: event.date,
        venue: competition.venue?.fullName || "",
        status: event.status?.type?.state || "pre",
        odds: odds ? {
          spread: { home: odds.homeTeamOdds?.spread, away: odds.awayTeamOdds?.spread },
          moneyline: { home: odds.homeTeamOdds?.moneyLine, away: odds.awayTeamOdds?.moneyLine },
          overUnder: odds.overUnder,
          provider: odds.provider?.name || "ESPN",
        } : null,
      };
    }).filter(Boolean);
  } catch (err) {
    console.warn(`[BatchAnalyze] ESPN fetch failed for ${sportKey}:`, err.message);
    return [];
  }
}

function buildBatchPrompt(games) {
  const gameDescriptions = games.map((game, idx) => {
    const odds = game.odds;
    let oddsStr = "No odds available";
    if (odds) {
      const parts = [];
      if (odds.spread?.home != null) parts.push(`Spread: ${odds.spread.home > 0 ? '+' : ''}${odds.spread.home}`);
      if (odds.moneyline?.home != null) parts.push(`ML: ${odds.moneyline.home > 0 ? '+' : ''}${odds.moneyline.home}/${odds.moneyline.away > 0 ? '+' : ''}${odds.moneyline.away}`);
      if (odds.overUnder != null) parts.push(`O/U: ${odds.overUnder}`);
      if (parts.length > 0) oddsStr = parts.join(", ");
    }

    return `GAME ${idx + 1} [ID: ${game.id}]:
${game.awayTeam.name} ${game.awayTeam.record ? `(${game.awayTeam.record})` : ""} @ ${game.homeTeam.name} ${game.homeTeam.record ? `(${game.homeTeam.record})` : ""}
Sport: ${game.sportLabel}
Time: ${game.startTime}
Venue: ${game.venue || "TBD"}
Odds: ${oddsStr}`;
  }).join("\n\n");

  return `You are an expert sports betting analyst. Analyze ALL of the following games and provide betting analysis for each.

${gameDescriptions}

For EACH game, provide analysis in this EXACT JSON format. Return a JSON array with one object per game:

[
  {
    "gameId": "the game ID from above",
    "spread_home": {
      "edgeRating": 1-10,
      "confidence": "Low/Medium/High",
      "recommendation": "Strong Bet/Lean/Avoid/Fade",
      "keyFactors": ["factor1", "factor2", "factor3"],
      "analysis": "2-3 sentence analysis",
      "riskFactors": ["risk1", "risk2"]
    },
    "spread_away": { same format },
    "ml_home": { same format },
    "ml_away": { same format },
    "over": { same format },
    "under": { same format }
  }
]

IMPORTANT:
- Return ONLY valid JSON, no markdown
- Include ALL ${games.length} games
- Each game needs all 6 bet types analyzed
- Be specific about edges and value in each analysis`;
}

function parseAnalysis(text) {
  return {
    edgeRating: text.edgeRating || 5,
    confidence: text.confidence || "Medium",
    recommendation: text.recommendation || "Lean",
    keyFactors: text.keyFactors || [],
    analysis: text.analysis || "",
    riskFactors: text.riskFactors || [],
    fullText: text.analysis || "",
  };
}

async function analyzeGamesBatch(groq, games) {
  if (games.length === 0) return [];

  // Process in batches of 6 games to stay within token limits
  const BATCH_SIZE = 6;
  const results = [];

  for (let i = 0; i < games.length; i += BATCH_SIZE) {
    const batch = games.slice(i, i + BATCH_SIZE);
    console.log(`[BatchAnalyze] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(games.length / BATCH_SIZE)} (${batch.length} games)`);

    const prompt = buildBatchPrompt(batch);

    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });

      const responseText = completion.choices?.[0]?.message?.content?.trim();
      if (!responseText) {
        console.warn("[BatchAnalyze] Empty response from Groq");
        continue;
      }

      // Parse JSON response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.warn("[BatchAnalyze] Could not find JSON array in response");
        continue;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      for (const gameAnalysis of parsed) {
        const game = batch.find((g) => g.id === gameAnalysis.gameId);
        if (!game) continue;

        const betAnalyses = {
          spread_home: parseAnalysis(gameAnalysis.spread_home || {}),
          spread_away: parseAnalysis(gameAnalysis.spread_away || {}),
          ml_home: parseAnalysis(gameAnalysis.ml_home || {}),
          ml_away: parseAnalysis(gameAnalysis.ml_away || {}),
          over: parseAnalysis(gameAnalysis.over || {}),
          under: parseAnalysis(gameAnalysis.under || {}),
        };

        // Store in cache
        setAnalysis(game.id, game, betAnalyses);
        results.push({ gameId: game.id, success: true });
      }
    } catch (err) {
      console.error("[BatchAnalyze] Batch failed:", err.message);
      // Continue with next batch
    }

    // Small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < games.length) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return results;
}

export async function POST(request) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const groq = getGroq();
  if (!groq) {
    return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 });
  }

  console.log("[BatchAnalyze] Starting batch analysis...");
  const startTime = Date.now();

  // Fetch games from all major sports
  const allGames = [];
  for (const [sportKey, config] of Object.entries(SPORT_CONFIG)) {
    const games = await fetchESPNGames(sportKey, config);
    // Only include pre-game (not started) games
    const preGames = games.filter((g) => g.status === "pre");
    allGames.push(...preGames);
    console.log(`[BatchAnalyze] ${config.label}: ${preGames.length} upcoming games`);
  }

  console.log(`[BatchAnalyze] Total games to analyze: ${allGames.length}`);

  if (allGames.length === 0) {
    return NextResponse.json({
      success: true,
      message: "No games to analyze",
      stats: getCacheStats(),
    });
  }

  // Run batch analysis
  const results = await analyzeGamesBatch(groq, allGames);

  // Update batch timestamp
  setLastBatchTimestamp(Date.now());

  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log(`[BatchAnalyze] Completed in ${duration}s. Analyzed ${results.length}/${allGames.length} games.`);

  return NextResponse.json({
    success: true,
    analyzed: results.length,
    total: allGames.length,
    duration: `${duration}s`,
    stats: getCacheStats(),
  });
}

// GET endpoint to check cache status
export async function GET() {
  return NextResponse.json({
    stats: getCacheStats(),
  });
}
