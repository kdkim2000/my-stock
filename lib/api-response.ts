import { NextResponse } from "next/server";

export function ok<T>(data: T, headers?: Record<string, string>): NextResponse<T> {
  return NextResponse.json(data, headers ? { headers } : undefined);
}

export function badRequest(message: string): NextResponse<{ error: string }> {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function unauthorized(message = "Unauthorized"): NextResponse<{ error: string }> {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function notFound(message: string): NextResponse<{ error: string }> {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(
  message: string,
  err?: unknown
): NextResponse<{ error: string; detail?: string }> {
  const detail =
    process.env.NODE_ENV === "development" && err instanceof Error ? err.message : undefined;
  return NextResponse.json(
    { error: message, ...(detail ? { detail } : {}) },
    { status: 503 }
  );
}
