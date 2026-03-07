import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "app_access";

export async function middleware(request: NextRequest) {
  const secret = process.env.ACCESS_SECRET?.trim();
  const cookie = request.cookies.get(COOKIE_NAME)?.value;

  const isAuthenticated = !!secret && cookie === secret;

  if (!isAuthenticated) {
    const isApi = request.nextUrl.pathname.startsWith("/api/");
    const isAuthApi =
      request.nextUrl.pathname === "/api/auth/simple-login" ||
      request.nextUrl.pathname === "/api/auth/logout";
    const isSignInPage = request.nextUrl.pathname === "/auth/signin";

    if (isSignInPage || isAuthApi) return NextResponse.next();
    if (isApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const signIn = new URL("/auth/signin", request.url);
    signIn.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(signIn);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard", "/dashboard/:path*", "/api/:path*", "/auth/signin"],
};
