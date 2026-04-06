import { NextResponse } from "next/server";

export default async function middleware(req) {
  // Skip Clerk entirely if not configured
  if (!process.env.CLERK_SECRET_KEY) {
    return NextResponse.next();
  }

  // Dynamically load Clerk only when key exists
  const { clerkMiddleware, createRouteMatcher } = require("@clerk/nextjs/server");

  // Routes that don't require authentication (Clerk still runs but won't redirect)
  const isPublicRoute = createRouteMatcher([
    "/",
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/verify-email",
    "/api/webhooks(.*)",
    "/api/batch-analyze(.*)",
    "/api/games(.*)",
    "/api/props(.*)",
    ...(process.env.NODE_ENV === "development" ? ["/dashboard(.*)"] : []),
  ]);

  return clerkMiddleware(async (auth, req) => {
    const { pathname } = req.nextUrl;

    // Public routes: Clerk runs (context available) but no auth required
    if (isPublicRoute(req)) {
      return NextResponse.next();
    }

    // Protected routes: require authentication
    const { userId } = await auth();
    if (!userId) {
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", pathname);
      return NextResponse.redirect(signInUrl);
    }

    return NextResponse.next();
  })(req);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
