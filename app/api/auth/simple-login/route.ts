import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "app_access";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export async function POST(request: NextRequest) {
  const secret = process.env.ACCESS_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "ACCESS_SECRET not configured" },
      { status: 500 }
    );
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const password = String(body.password ?? "").trim();
  if (password !== secret) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const callbackUrl =
    request.nextUrl.searchParams.get("callbackUrl") || "/dashboard";
  const res = NextResponse.redirect(new URL(callbackUrl, request.url));
  res.cookies.set(COOKIE_NAME, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}
