import { NextResponse } from "next/server";
import crypto from "crypto";

// Generate a random code_verifier (43-128 chars, URL-safe)
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString("base64url");
}

// Derive code_challenge from code_verifier using S256
async function generateCodeChallenge(verifier) {
  const hash = crypto.createHash("sha256").update(verifier).digest();
  return Buffer.from(hash).toString("base64url");
}

export async function GET() {
  const clientId = process.env.WHOP_CLIENT_ID;
  const redirectUri = process.env.WHOP_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    console.error("[EdgeCheck] WHOP_CLIENT_ID or WHOP_REDIRECT_URI not set");
    return NextResponse.redirect(new URL("/"));
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const oauthUrl = new URL("https://whop.com/oauth");
  oauthUrl.searchParams.set("client_id", clientId);
  oauthUrl.searchParams.set("redirect_uri", redirectUri);
  oauthUrl.searchParams.set("response_type", "code");
  oauthUrl.searchParams.set("code_challenge", codeChallenge);
  oauthUrl.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.redirect(oauthUrl.toString());
  response.cookies.set("pkce_verifier", codeVerifier, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10 minutes — plenty for the OAuth round-trip
  });

  console.log("[EdgeCheck] PKCE flow initiated, redirecting to Whop OAuth");
  return response;
}
