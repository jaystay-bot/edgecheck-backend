import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getAnalysis,
  getLastBatchTimestamp,
  canUserRefresh,
  recordUserRefresh,
  getNextRefreshTime,
} from "../../../lib/analysis-cache";

export const maxDuration = 10; // Fast lookup only - no live Groq calls

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

async function hasActiveSubscription(email) {
  const stripe = getStripe();
  if (!stripe) {
    console.error("[EdgeCheck] Missing STRIPE_SECRET_KEY");
    return false;
  }

  try {
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length === 0) return false;

    const customerId = customers.data[0].id;

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length > 0) return true;

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

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { game, betType } = body;
  if (!game || !betType) {
    return NextResponse.json(
      { error: "Missing required fields: game, betType" },
      { status: 400 }
    );
  }

  const gameId = game.id;

  // Look up cached analysis - NO live Groq call
  const cached = getAnalysis(gameId);
  const lastBatch = getLastBatchTimestamp();

  if (!cached) {
    // No analysis available yet
    return NextResponse.json({
      analysis: null,
      pending: true,
      message: "Analysis loading — check back in a few minutes",
      lastBatch: lastBatch ? formatTimeAgo(lastBatch) : null,
    });
  }

  // Map bet type to the cached analysis key
  const betTypeMap = {
    spread_home: "spread_home",
    spread_away: "spread_away",
    ml_home: "ml_home",
    ml_away: "ml_away",
    over: "over",
    under: "under",
  };

  // Parse the betType from the label to determine which analysis to show
  let analysisKey = "spread_home"; // default
  const betTypeLower = (betType || "").toLowerCase();

  if (betTypeLower.includes("spread")) {
    if (betTypeLower.includes("away") || body.betValue?.toLowerCase().includes(game.awayTeam?.abbreviation?.toLowerCase())) {
      analysisKey = "spread_away";
    } else {
      analysisKey = "spread_home";
    }
  } else if (betTypeLower.includes("ml") || betTypeLower.includes("money")) {
    if (betTypeLower.includes("away") || body.betValue?.toLowerCase().includes(game.awayTeam?.abbreviation?.toLowerCase())) {
      analysisKey = "ml_away";
    } else {
      analysisKey = "ml_home";
    }
  } else if (betTypeLower.includes("over")) {
    analysisKey = "over";
  } else if (betTypeLower.includes("under")) {
    analysisKey = "under";
  }

  const analysis = cached.betAnalyses?.[analysisKey];

  if (!analysis) {
    return NextResponse.json({
      analysis: null,
      pending: true,
      message: "Analysis loading — check back in a few minutes",
      lastBatch: lastBatch ? formatTimeAgo(lastBatch) : null,
    });
  }

  return NextResponse.json({
    analysis,
    analyzedAt: cached.analyzedAt,
    analyzedAtFormatted: formatTimeAgo(cached.analyzedAt),
    cached: true,
    canRefresh: canUserRefresh(userId),
    nextRefreshIn: getNextRefreshTime(userId),
  });
}

// GET endpoint to check analysis status for a game
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
