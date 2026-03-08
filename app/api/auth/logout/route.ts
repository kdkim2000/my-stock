import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** NextAuth 세션 종료 후 로그인 페이지로 리다이렉트 (클라이언트에서 /api/auth/signout 호출해도 됨) */
export async function GET(request: NextRequest) {
  const signOutUrl = new URL("/api/auth/signout", request.url);
  signOutUrl.searchParams.set("callbackUrl", "/auth/signin");
  return NextResponse.redirect(signOutUrl);
}
