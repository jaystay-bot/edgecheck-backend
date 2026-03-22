import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  // --- No ?code= param: redirect through /auth/login (PKCE) ---
  if (!code) {
    console.log("[EdgeCheck] No code param, redirecting to /auth/login for PKCE flow");
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // --- OAuth flow: ?code= present ---
  console.log("[EdgeCheck] Code received:", code);

  // Retrieve PKCE code_verifier from cookie
  const codeVerifier = request.cookies.get("pkce_verifier")?.value;
  if (!codeVerifier) {
    console.error("[EdgeCheck] No pkce_verifier cookie found");
    return Response.json({
      error: "Missing PKCE verifier — OAuth session may have expired",
      step: "pkce_verifier_check",
    }, { status: 400 });
  }

  try {
    const tokenBody = {
      code,
      client_id: process.env.WHOP_CLIENT_ID,
      client_secret: process.env.WHOP_CLIENT_SECRET,
      redirect_uri: process.env.WHOP_REDIRECT_URI,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    };
    console.log("[EdgeCheck] Token request body:", JSON.stringify({ ...tokenBody, client_secret: "[REDACTED]" }));

    const tokenRes = await fetch("https://api.whop.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tokenBody),
    });

    const tokenResponseText = await tokenRes.text();
    console.log("[EdgeCheck] Token response status:", tokenRes.status);
    console.log("[EdgeCheck] Token response body:", tokenResponseText);

    if (!tokenRes.ok) {
      return Response.json({
        error: "Token exchange failed",
        step: "token_exchange",
        status: tokenRes.status,
        details: tokenResponseText,
      }, { status: 502 });
    }

    let tokenData;
    try {
      tokenData = JSON.parse(tokenResponseText);
    } catch (e) {
      return Response.json({
        error: "Failed to parse token response as JSON",
        step: "token_parse",
        details: tokenResponseText,
      }, { status: 502 });
    }

    const accessToken = tokenData.access_token;
    console.log("[EdgeCheck] Token data keys:", Object.keys(tokenData));

    if (!accessToken) {
      return Response.json({
        error: "No access_token in token response",
        step: "access_token_check",
        details: tokenData,
      }, { status: 502 });
    }

    // Verify active membership
    const memberRes = await fetch(
      "https://api.whop.com/api/v2/me/memberships",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const memberResponseText = await memberRes.text();
    console.log("[EdgeCheck] Membership response status:", memberRes.status);
    console.log("[EdgeCheck] Membership response body:", memberResponseText);

    if (!memberRes.ok) {
      return Response.json({
        error: "Membership check failed",
        step: "membership_check",
        status: memberRes.status,
        details: memberResponseText,
      }, { status: 502 });
    }

    let memberData;
    try {
      memberData = JSON.parse(memberResponseText);
    } catch (e) {
      return Response.json({
        error: "Failed to parse membership response as JSON",
        step: "membership_parse",
        details: memberResponseText,
      }, { status: 502 });
    }

    const memberships = memberData.data ?? memberData;
    console.log("[EdgeCheck] Memberships count:", Array.isArray(memberships) ? memberships.length : "not an array");
    console.log("[EdgeCheck] WHOP_PRODUCT_ID env:", process.env.WHOP_PRODUCT_ID);
    if (Array.isArray(memberships)) {
      console.log("[EdgeCheck] Membership details:", memberships.map((m) => ({ product_id: m.product_id, status: m.status })));
    }

    const hasAccess = Array.isArray(memberships) && memberships.some(
      (m) =>
        m.product_id === process.env.WHOP_PRODUCT_ID &&
        m.status === "active"
    );

    if (!hasAccess) {
      return Response.json({
        error: "No active membership found for product",
        step: "membership_validation",
        whop_product_id: process.env.WHOP_PRODUCT_ID,
        memberships: Array.isArray(memberships)
          ? memberships.map((m) => ({ product_id: m.product_id, status: m.status }))
          : memberships,
      }, { status: 403 });
    }

    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    response.cookies.set("whop_access", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    response.cookies.delete("pkce_verifier");

    console.log("[EdgeCheck] Auth successful, redirecting to /dashboard");
    return response;
  } catch (err) {
    console.error("[EdgeCheck] OAuth callback error:", err.message, err);
    return Response.json({
      error: err.message,
      step: "unexpected_error",
      details: err.stack,
    }, { status: 500 });
  }
}
