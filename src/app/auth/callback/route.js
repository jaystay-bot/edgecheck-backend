import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  // --- OAuth flow: ?code= present ---
  if (code) {
    console.log("[EdgeCheck] Code received:", code);
    try {
      const tokenBody = {
        code,
        client_id: process.env.WHOP_CLIENT_ID,
        client_secret: process.env.WHOP_CLIENT_SECRET,
        redirect_uri: process.env.WHOP_REDIRECT_URI,
        grant_type: "authorization_code",
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
        });
      }

      let tokenData;
      try {
        tokenData = JSON.parse(tokenResponseText);
      } catch (e) {
        return Response.json({
          error: "Failed to parse token response as JSON",
          step: "token_parse",
          details: tokenResponseText,
        });
      }

      const accessToken = tokenData.access_token;
      console.log("[EdgeCheck] Token data keys:", Object.keys(tokenData));

      if (!accessToken) {
        return Response.json({
          error: "No access_token in token response",
          step: "access_token_check",
          details: tokenData,
        });
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
        });
      }

      let memberData;
      try {
        memberData = JSON.parse(memberResponseText);
      } catch (e) {
        return Response.json({
          error: "Failed to parse membership response as JSON",
          step: "membership_parse",
          details: memberResponseText,
        });
      }

      const memberships = memberData.data ?? memberData;
      console.log("[EdgeCheck] Memberships count:", Array.isArray(memberships) ? memberships.length : "not an array");
      console.log("[EdgeCheck] WHOP_PRODUCT_ID env:", process.env.WHOP_PRODUCT_ID);
      if (Array.isArray(memberships)) {
        console.log("[EdgeCheck] Membership product_ids:", memberships.map((m) => ({ product_id: m.product_id, status: m.status })));
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
        });
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
      console.error("[EdgeCheck] OAuth callback error:", err.message, err);
      return Response.json({
        error: err.message,
        step: "unexpected_error",
        details: err.stack,
      });
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
