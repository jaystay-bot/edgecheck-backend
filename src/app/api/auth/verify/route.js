import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
  }

  const apiKey = process.env.WHOP_API_KEY;
  const productId = process.env.WHOP_PRODUCT_ID;

  if (!apiKey || !productId) {
    console.error("[EdgeCheck] WHOP_API_KEY or WHOP_PRODUCT_ID not set");
    return NextResponse.json({ success: false, error: "Server configuration error" }, { status: 500 });
  }

  try {
    // Look up memberships for this email
    const url = new URL("https://api.whop.com/api/v2/memberships");
    url.searchParams.set("product_id", productId);
    url.searchParams.set("status", "active");
    url.searchParams.set("email", email);
    url.searchParams.set("per", "5");

    console.log("[EdgeCheck] Checking membership for:", email);
    console.log("[EdgeCheck] API URL:", url.toString());

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    console.log("[EdgeCheck] Whop API response status:", res.status);

    if (!res.ok) {
      const text = await res.text();
      console.error("[EdgeCheck] Whop API error:", text);
      return NextResponse.json({ success: false, error: "Failed to verify membership" }, { status: 502 });
    }

    const data = await res.json();
    const memberships = data.data ?? data;

    console.log("[EdgeCheck] Memberships found:", Array.isArray(memberships) ? memberships.length : 0);

    const hasActive = Array.isArray(memberships) && memberships.length > 0;

    if (!hasActive) {
      return NextResponse.json({ success: false, error: "No active membership found for this email" });
    }

    // Set access cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set("whop_access", "granted", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    console.log("[EdgeCheck] Access granted for:", email);
    return response;
  } catch (err) {
    console.error("[EdgeCheck] Verify error:", err.message);
    return NextResponse.json({ success: false, error: "Something went wrong" }, { status: 500 });
  }
}
