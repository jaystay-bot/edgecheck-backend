import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request) {
  console.log("ENV CHECK:", { hasApiKey: !!process.env.WHOP_API_KEY, hasProductId: !!process.env.WHOP_PRODUCT_ID });

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
    const missing = [!apiKey && "WHOP_API_KEY", !productId && "WHOP_PRODUCT_ID"].filter(Boolean).join(", ");
    console.error("[EdgeCheck] Missing env vars:", missing);
    return NextResponse.json({ success: false, error: `Missing env: ${missing}` }, { status: 500 });
  }

  try {
    // Look up memberships for this email
    const url = new URL("https://api.whop.com/api/v2/memberships");
    url.searchParams.set("product_id", productId);
    url.searchParams.set("email", email);
    url.searchParams.set("per", "50");

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
    console.log("[EdgeCheck] Raw Whop API response:", JSON.stringify(data));

    const memberships = data.data ?? data;

    console.log("[EdgeCheck] Memberships found:", Array.isArray(memberships) ? memberships.length : 0);

    const validStatuses = ["active", "trialing", "completed"];
    const hasActive = Array.isArray(memberships) && memberships.some(m => validStatuses.includes(m.status));

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
