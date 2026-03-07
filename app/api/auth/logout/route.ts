import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "app_access";

export async function GET(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/auth/signin", request.url));
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return res;
}
