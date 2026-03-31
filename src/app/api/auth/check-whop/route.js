import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  if (!email) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  // Check if email is verified
  const emailVerified =
    user?.primaryEmailAddress?.verification?.status === "verified";

  if (!emailVerified) {
    return NextResponse.redirect(new URL("/verify-email", request.url));
  }

  const apiKey = process.env.WHOP_API_KEY;
  const productId = process.env.WHOP_PRODUCT_ID;

  if (!apiKey || !productId) {
    console.error("[EdgeCheck] Missing WHOP_API_KEY or WHOP_PRODUCT_ID");
    return NextResponse.redirect(new URL("/", request.url));
  }

  try {
    // Check Whop membership
    const url = new URL("https://api.whop.com/api/v2/memberships");
    url.searchParams.set("product_id", productId);
    url.searchParams.set("email", email);
    url.searchParams.set("per", "50");

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      console.error("[EdgeCheck] Whop API error:", await res.text());
      return NextResponse.redirect(
        new URL("/?error=whop_check_failed", request.url)
      );
    }

    const data = await res.json();
    const memberships = data.data ?? data;
    const validStatuses = ["active", "trialing", "completed"];
    const hasActive =
      Array.isArray(memberships) &&
      memberships.some((m) => validStatuses.includes(m.status));

    if (!hasActive) {
      // No active membership — redirect to Whop checkout
      const checkoutUrl = "https://whop.com/checkout/plan_nQHnE1nsW602p";
      return NextResponse.redirect(checkoutUrl);
    }

    // Has active membership — set cookie and redirect to dashboard
    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    response.cookies.set("whop_access", "granted", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err) {
    console.error("[EdgeCheck] Whop check error:", err.message);
    return NextResponse.redirect(new URL("/?error=whop_error", request.url));
  }
}
