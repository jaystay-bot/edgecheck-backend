import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import Groq from "groq-sdk";

// Standard Node.js serverless runtime (not edge) — 60s max on Vercel
export const maxDuration = 60;

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return null;
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

function getGroq() {
  if (!process.env.GROQ_API_KEY) {
    return null;
  }
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

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

async function hasActiveSubscription(email) {
  const stripe = getStripe();
  if (!stripe) {
    console.error("[EdgeCheck] Missing STRIPE_SECRET_KEY");
    return false;
  }

  try {
    // Find customer by email
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length === 0) {
      return false;
    }

    const customerId = customers.data[0].id;

    // Check for active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length > 0) {
      return true;
    }

    // Also check for trialing subscriptions
    const trialingSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: "trialing",
      limit: 1,
    });

    return trialingSubs.data.length > 0;
  } catch (err) {
    console.error("[EdgeCheck] Stripe subscription check error:", err.message);
    return false;
  }
}

export async function POST(request) {
  // Verify user is authenticated
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

  // Check Stripe subscription
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

  const groq = getGroq();
  if (!groq) {
    console.error("[EdgeCheck] GROQ_API_KEY not configured");
    return NextResponse.json(
      { error: "GROQ_API_KEY not configured" },
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

  console.log("[EdgeCheck] Sending request to Groq API with model: llama-3.3-70b-versatile");

  try {
    const chatCompletion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const analysisText = chatCompletion.choices?.[0]?.message?.content;

    if (!analysisText) {
      console.error("[EdgeCheck] Groq returned empty response:", JSON.stringify(chatCompletion));
      return NextResponse.json(
        { error: "AI returned empty response", detail: JSON.stringify(chatCompletion) },
        { status: 502 }
      );
    }

    console.log("[EdgeCheck] Groq response received, length:", analysisText.length);

    const analysis = parseAnalysis(analysisText);

    return NextResponse.json({ analysis, raw: analysisText });
  } catch (err) {
    console.error("[EdgeCheck] Groq API error:", err.name, err.message);
    console.error("[EdgeCheck] Full error:", JSON.stringify(err, Object.getOwnPropertyNames(err)));

    // Extract the actual error message
    let errorMessage = err.message || "Failed to generate analysis";

    // Check for specific Groq error types
    if (err.status) {
      errorMessage = `Groq API error (${err.status}): ${err.message}`;
    }

    return NextResponse.json(
      { error: errorMessage, detail: err.message },
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
