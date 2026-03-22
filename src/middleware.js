import { NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/",
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
