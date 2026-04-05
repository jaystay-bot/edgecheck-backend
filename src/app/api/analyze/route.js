import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import {
  getAnalysis,
  setAnalysis,
  getLastBatchTimestamp,
  canUserRefresh,
  getNextRefreshTime,
} from "../../../lib/analysis-cache";
import { hasActiveSubscription } from "../../../lib/subscription";

export const maxDuration = 60;

function getGroq() {
  if (!process.env.GROQ_API_KEY) return null;
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

// Per-user rate limit for on-demand analysis (when cache is empty)
const userRateMap = new Map();
const USER_RATE_LIMIT = 5 * 60 * 1000; // 5 minutes between on-demand analyses

function canUserAnalyze(userId) {
  const last = userRateMap.get(userId);
  if (!last) return true;
  return Date.now() - last >= USER_RATE_LIMIT;
}

function recordUserAnalysis(userId) {
  userRateMap.set(userId, Date.now());
}

// Clean up old entries
setInterval(() => {
  const now = Date.now();
  for (const [userId, timestamp] of userRateMap) {
    if (now - timestamp > USER_RATE_LIMIT * 2) {
      userRateMap.delete(userId);
    }
  }
}, USER_RATE_LIMIT);

function formatTimeAgo(timestamp) {
  if (!timestamp) return "recently";
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "1 hour ago";
  return `${hours} hours ago`;
}

function buildPrompt(game, betType, betValue) {
  const homeTeam = game.homeTeam?.name ?? "Home Team";
  const awayTeam = game.awayTeam?.name ?? "Away Team";
  const homeRecord = game.homeTeam?.record ? ` (${game.homeTeam.record})` : "";
  const awayRecord = game.awayTeam?.record ? ` (${game.awayTeam.record})` : "";
  const odds = game.odds;

  let oddsContext = "";
  if (odds) {
    oddsContext = `
Current odds:
- Spread: ${odds.spread?.home ?? "N/A"} (home) / ${odds.spread?.away ?? "N/A"} (away)
- Moneyline: ${odds.moneyline?.home ?? "N/A"} (home) / ${odds.moneyline?.away ?? "N/A"} (away)
- Over/Under: ${odds.overUnder ?? "N/A"}
- Provider: ${odds.provider ?? "Unknown"}`;
  }

  return `You are an expert sports betting analyst. Analyze the following bet.

Game: ${awayTeam}${awayRecord} @ ${homeTeam}${homeRecord}
Sport: ${game.sport?.toUpperCase() ?? "Unknown"}
Game Time: ${game.startTime ?? "TBD"}
Venue: ${game.venue ?? "TBD"}
${oddsContext}

Bet Type: ${betType}
${betValue ? `Bet Value: ${betValue}` : ""}

Respond with ONLY a JSON object (no markdown):
{
  "edgeRating": 7,
  "confidence": "Medium",
  "recommendation": "Lean",
  "keyFactors": ["factor 1", "factor 2", "factor 3"],
  "analysis": "2-3 sentence analysis of this bet.",
  "riskFactors": ["risk 1", "risk 2"]
}

edgeRating: 1-10 where 10 is strongest edge
confidence: Low/Medium/High
recommendation: Strong Bet/Lean/Avoid/Fade`;
}

function parseAnalysisResponse(text) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      edgeRating: Math.min(10, Math.max(1, parseInt(parsed.edgeRating, 10) || 5)),
      confidence: parsed.confidence || "Medium",
      recommendation: parsed.recommendation || "Lean",
      keyFactors: parsed.keyFactors || [],
      analysis: parsed.analysis || "",
      riskFactors: parsed.riskFactors || [],
      fullText: parsed.analysis || "",
    };
  } catch {
    return null;
  }
}

async function generateOnDemandAnalysis(groq, game, betType, betValue) {
  const prompt = buildPrompt(game, betType, betValue);

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = completion.choices?.[0]?.message?.content?.trim();
    if (!responseText) return null;

    return parseAnalysisResponse(responseText);
  } catch (err) {
    console.error("[Analyze] Groq error:", err.message);
    return null;
  }
}

export async function POST(request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  if (!email) {
    return NextResponse.json(
      { error: "No email found", code: "NO_EMAIL" },
      { status: 400 }
    );
  }

  const hasSubscription = await hasActiveSubscription(email);
  if (!hasSubscription) {
    return NextResponse.json(
      {
        error: "Subscription required",
        code: "SUBSCRIPTION_REQUIRED",
        message: "Upgrade to EdgeCheck Pro to unlock AI analysis",
      },
      { status: 402 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { game, betType, betValue } = body;
  if (!game || !betType) {
    return NextResponse.json(
      { error: "Missing required fields: game, betType" },
      { status: 400 }
    );
  }

  const gameId = game.id;

  // Try to get from cache first
  const cached = getAnalysis(gameId);
  const lastBatch = getLastBatchTimestamp();

  // Determine the bet key from the type
  let betKey = "spread_home";
  const betTypeLower = (betType || "").toLowerCase();
  const betValueLower = (betValue || "").toLowerCase();
  const awayAbbrev = (game.awayTeam?.abbreviation || "").toLowerCase();

  if (betTypeLower.includes("spread")) {
    betKey = betValueLower.includes(awayAbbrev) ? "spread_away" : "spread_home";
  } else if (betTypeLower.includes("ml") || betTypeLower.includes("money")) {
    betKey = betValueLower.includes(awayAbbrev) ? "ml_away" : "ml_home";
  } else if (betTypeLower.includes("over")) {
    betKey = "over";
  } else if (betTypeLower.includes("under")) {
    betKey = "under";
  }

  // Return cached if available
  if (cached?.betAnalyses?.[betKey]) {
    return NextResponse.json({
      status: "ok",
      analysis: cached.betAnalyses[betKey],
      analyzedAt: cached.analyzedAt,
      analyzedAtFormatted: formatTimeAgo(cached.analyzedAt),
      cached: true,
      canRefresh: canUserRefresh(userId),
      nextRefreshIn: getNextRefreshTime(userId),
    });
  }

  // Cache miss - generate on demand if user hasn't analyzed recently
  if (!canUserAnalyze(userId)) {
    return NextResponse.json({
      analysis: null,
      pending: true,
      status: "error",
      reason: "rate_limited",
      rateLimited: true,
      message: "Rate limited — try again in a few minutes",
    });
  }

  const groq = getGroq();
  if (!groq) {
    return NextResponse.json({
      analysis: null,
      pending: true,
      status: "error",
      reason: "no_api_key",
      message: "Analysis service unavailable",
    });
  }

  console.log(`[Analyze] Generating on-demand analysis for game ${gameId}`);
  const analysis = await generateOnDemandAnalysis(groq, game, betType, betValue);

  if (!analysis) {
    return NextResponse.json({
      analysis: null,
      pending: true,
      status: "no_data",
      reason: "generation_failed",
      message: "Could not generate analysis",
    });
  }

  // Record that user triggered an analysis
  recordUserAnalysis(userId);

  // Cache for this instance (won't persist across serverless invocations)
  const betAnalyses = cached?.betAnalyses || {};
  betAnalyses[betKey] = analysis;
  setAnalysis(gameId, game, betAnalyses);

  return NextResponse.json({
    status: "ok",
    analysis,
    analyzedAt: Date.now(),
    analyzedAtFormatted: "just now",
    cached: false,
    onDemand: true,
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get("gameId");

  if (!gameId) {
    return NextResponse.json({ error: "gameId required" }, { status: 400 });
  }

  const cached = getAnalysis(gameId);
  const lastBatch = getLastBatchTimestamp();

  if (!cached) {
    return NextResponse.json({
      available: false,
      lastBatch: lastBatch ? formatTimeAgo(lastBatch) : null,
    });
  }

  return NextResponse.json({
    available: true,
    analyzedAt: cached.analyzedAt,
    analyzedAtFormatted: formatTimeAgo(cached.analyzedAt),
  });
}
