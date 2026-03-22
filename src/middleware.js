import { NextResponse } from "next/server";

// Routes that don't require authentication
const PUBLIC_PATHS = [
  "/",
  "/auth/callback",
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
    const res = await fetch("https://api.whop.com/api/v2/me/memberships", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      // Token invalid or expired — clear cookie and redirect
      const response = NextResponse.redirect(new URL("/", request.url));
      response.cookies.delete("whop_access");
      return response;
    }

    const data = await res.json();
    const memberships = data.data ?? data;

    const hasAccess = Array.isArray(memberships) && memberships.some(
      (m) =>
        m.product_id === process.env.WHOP_PRODUCT_ID &&
        m.status === "active"
    );

    if (!hasAccess) {
      const response = NextResponse.redirect(new URL("/", request.url));
      response.cookies.delete("whop_access");
      return response;
    }

    return NextResponse.next();
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
