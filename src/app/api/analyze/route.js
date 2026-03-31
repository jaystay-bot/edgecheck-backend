import { NextResponse } from "next/server";

// Standard Node.js serverless runtime (not edge) — 60s max on Vercel
export const maxDuration = 60;

// --- Rate limiting: 20 requests per 10 minutes per IP ---
const rateMap = new Map();
const RATE_LIMIT = 20;
const RATE_WINDOW = 10 * 60 * 1000; // 10 minutes

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip);

  if (!entry || now - entry.windowStart > RATE_WINDOW) {
    rateMap.set(ip, { windowStart: now, count: 1 });
    return null;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT) {
    const minutesLeft = Math.ceil(
      (entry.windowStart + RATE_WINDOW - now) / 60000
    );
    return minutesLeft;
  }

  return null;
}

// Clean up stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateMap) {
    if (now - entry.windowStart > RATE_WINDOW) rateMap.delete(ip);
  }
}, RATE_WINDOW);

export async function POST(request) {
  // Rate limit check
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const minutesLeft = checkRateLimit(ip);
  if (minutesLeft !== null) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${minutesLeft} minutes.` },
      { status: 429 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
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

  const prompt = buildPrompt(game, betType, betValue);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errBody = await res.text();
      console.error("Anthropic API error:", res.status, errBody);
      return NextResponse.json(
        { error: "Failed to generate analysis", detail: errBody },
        { status: 502 }
      );
    }

    const data = await res.json();
    const analysisText =
      data.content?.[0]?.type === "text"
        ? data.content[0].text
        : "Unable to generate analysis.";

    const analysis = parseAnalysis(analysisText);

    return NextResponse.json({ analysis, raw: analysisText });
  } catch (err) {
    clearTimeout(timeout);
    console.error("Claude API error:", err.name, err.message);

    if (err.name === "AbortError") {
      return NextResponse.json(
        { error: "Analysis timed out — please try again" },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate analysis", detail: err.message },
      { status: 502 }
    );
  }
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

  return `You are an expert sports betting analyst for EdgeCheck, a sports betting edge analyzer. Analyze the following bet and provide your edge assessment.

Game: ${awayTeam}${awayRecord} @ ${homeTeam}${homeRecord}
Sport: ${game.sport?.toUpperCase() ?? "Unknown"}
Game Time: ${game.startTime ?? "TBD"}
Venue: ${game.venue ?? "TBD"}
${oddsContext}

Bet Type: ${betType}
${betValue ? `Bet Value: ${betValue}` : ""}

Provide your analysis in this exact format:

EDGE RATING: [number from 1-10, where 10 is the strongest edge]
CONFIDENCE: [Low/Medium/High]
RECOMMENDATION: [Strong Bet / Lean / Avoid / Fade]

KEY FACTORS:
- [factor 1]
- [factor 2]
- [factor 3]

ANALYSIS:
[2-3 sentence analysis of this bet, noting any edges or concerns. Be specific about why this bet does or doesn't have value. Reference relevant trends, matchup factors, or situational edges.]

RISK FACTORS:
- [risk 1]
- [risk 2]`;
}

function parseAnalysis(text) {
  const edgeMatch = text.match(/EDGE RATING:\s*(\d+)/i);
  const confidenceMatch = text.match(/CONFIDENCE:\s*(Low|Medium|High)/i);
  const recMatch = text.match(
    /RECOMMENDATION:\s*(Strong Bet|Lean|Avoid|Fade)/i
  );

  return {
    edgeRating: edgeMatch ? parseInt(edgeMatch[1], 10) : null,
    confidence: confidenceMatch ? confidenceMatch[1] : null,
    recommendation: recMatch ? recMatch[1] : null,
    fullText: text,
  };
}
