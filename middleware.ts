import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  });
  const isAuthenticated = !!token;

  if (!isAuthenticated) {
    const isAuthRoute =
      request.nextUrl.pathname.startsWith("/api/auth/") ||
      // /api/ai/* 는 라우트 핸들러에서 getServerSession으로 직접 검증
      request.nextUrl.pathname.startsWith("/api/ai/") ||
      request.nextUrl.pathname === "/auth/signin";

    if (isAuthRoute) return NextResponse.next();
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const signIn = new URL("/auth/signin", request.url);
    signIn.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(signIn);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard", "/dashboard/:path*", "/api/:path*", "/auth/signin"],
};
