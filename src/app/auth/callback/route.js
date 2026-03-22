import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch("https://api.whop.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        client_id: process.env.WHOP_CLIENT_ID,
        client_secret: process.env.WHOP_CLIENT_SECRET,
        redirect_uri: process.env.WHOP_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      console.error("[EdgeCheck] Whop token exchange failed:", tokenRes.status);
      return NextResponse.redirect(new URL("/", request.url));
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error("[EdgeCheck] No access token in Whop response");
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Verify active membership
    const memberRes = await fetch(
      "https://api.whop.com/api/v2/me/memberships",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!memberRes.ok) {
      console.error("[EdgeCheck] Whop membership check failed:", memberRes.status);
      return NextResponse.redirect(new URL("/", request.url));
    }

    const memberData = await memberRes.json();
    const memberships = memberData.data ?? memberData;

    const hasAccess = Array.isArray(memberships) && memberships.some(
      (m) =>
        m.product_id === process.env.WHOP_PRODUCT_ID &&
        m.status === "active"
    );

    if (!hasAccess) {
      console.warn("[EdgeCheck] No active membership found for product");
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Set httpOnly cookie and redirect to dashboard
    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    response.cookies.set("whop_access", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err) {
    console.error("[EdgeCheck] OAuth callback error:", err.message);
    return NextResponse.redirect(new URL("/", request.url));
  }
}
