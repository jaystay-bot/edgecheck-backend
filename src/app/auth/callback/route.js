import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  // --- OAuth flow: ?code= present ---
  if (code) {
    try {
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

      const response = NextResponse.redirect(new URL("/dashboard", request.url));
      response.cookies.set("whop_access", accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });

      return response;
    } catch (err) {
      console.error("[EdgeCheck] OAuth callback error:", err.message);
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // --- Post-checkout redirect: no ?code= ---
  // User completed Whop checkout and was redirected back.
  // Verify their membership using the server-side WHOP_API_KEY.
  try {
    const apiKey = process.env.WHOP_API_KEY;
    if (!apiKey) {
      console.error("[EdgeCheck] WHOP_API_KEY not configured");
      return NextResponse.redirect(new URL("/", request.url));
    }

    const memberRes = await fetch(
      "https://api.whop.com/api/v2/memberships?valid=true&per=5",
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!memberRes.ok) {
      console.error("[EdgeCheck] Whop membership lookup failed:", memberRes.status);
      return NextResponse.redirect(new URL("/", request.url));
    }

    const memberData = await memberRes.json();
    const memberships = memberData.data ?? memberData;

    const activeMembership = Array.isArray(memberships) && memberships.find(
      (m) =>
        m.product_id === process.env.WHOP_PRODUCT_ID &&
        m.status === "active"
    );

    if (!activeMembership) {
      console.warn("[EdgeCheck] No active membership found after checkout");
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Use the membership ID as the cookie value (no user token available)
    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    response.cookies.set("whop_access", activeMembership.id, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err) {
    console.error("[EdgeCheck] Post-checkout callback error:", err.message);
    return NextResponse.redirect(new URL("/", request.url));
  }
}
