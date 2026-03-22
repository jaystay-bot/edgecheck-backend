import { NextResponse } from "next/server";

// Routes that don't require authentication
const PUBLIC_PATHS = [
  "/",
  "/auth/callback",
  "/auth/login",
  "/favicon.ico",
];

const PUBLIC_PREFIXES = [
  "/_next/",
  "/api/auth/",
];

function isPublic(pathname) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get("whop_access")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Verify membership with Whop
  try {
    // Try user-scoped token first (OAuth flow)
    const res = await fetch("https://api.whop.com/api/v2/me/memberships", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = await res.json();
      const memberships = data.data ?? data;

      const hasAccess = Array.isArray(memberships) && memberships.some(
        (m) =>
          m.product_id === process.env.WHOP_PRODUCT_ID &&
          m.status === "active"
      );

      if (hasAccess) return NextResponse.next();
    }

    // Fallback: cookie may hold a membership ID (post-checkout flow).
    // Verify it using the server-side API key.
    const apiKey = process.env.WHOP_API_KEY;
    if (apiKey && token.startsWith("mem_")) {
      const memberRes = await fetch(
        `https://api.whop.com/api/v2/memberships/${token}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(5000),
        }
      );

      if (memberRes.ok) {
        const membership = await memberRes.json();
        if (
          membership.product_id === process.env.WHOP_PRODUCT_ID &&
          membership.status === "active"
        ) {
          return NextResponse.next();
        }
      }
    }

    // Neither method verified access — clear cookie
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.delete("whop_access");
    return response;
  } catch (err) {
    console.error("[EdgeCheck] Middleware auth check failed:", err.message);
    // On network error, allow through (don't lock out users if Whop is down)
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
