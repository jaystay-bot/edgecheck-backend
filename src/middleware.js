import { NextResponse } from "next/server";

const PUBLIC_ROUTES = [
  "/",
  "/sign-in",
  "/sign-up",
  "/verify-email",
  "/api/webhooks",
  "/api/auth/check-whop",
];

function isPublicRoute(pathname) {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

export default async function middleware(request) {
  const { pathname } = request.nextUrl;

  // If Clerk is not configured, only allow public routes
  if (!process.env.CLERK_SECRET_KEY) {
    if (isPublicRoute(pathname)) {
      return NextResponse.next();
    }
    // Redirect to home if trying to access protected route without Clerk
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Clerk is configured — use Clerk middleware
  const { clerkMiddleware, createRouteMatcher } = await import(
    "@clerk/nextjs/server"
  );

  const isPublicClerkRoute = createRouteMatcher([
    "/",
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/verify-email",
    "/api/webhooks(.*)",
    "/api/auth/check-whop",
  ]);

  return clerkMiddleware(async (auth, req) => {
    const { pathname: path } = req.nextUrl;

    // Allow public routes
    if (isPublicClerkRoute(req)) {
      return NextResponse.next();
    }

    // Get auth state
    const { userId } = await auth();

    // Not signed in → redirect to sign-in
    if (!userId) {
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", path);
      return NextResponse.redirect(signInUrl);
    }

    // Dashboard page handles its own Whop verification
    return NextResponse.next();
  })(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
