"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

export function AppNav() {
  const pathname = usePathname() ?? "";
  const isTickerDetail = pathname.startsWith("/dashboard/ticker/");

  return (
    <nav className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex flex-wrap items-center gap-3">
        {isTickerDetail ? (
          <Link
            href="/dashboard"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            ← 대시보드
          </Link>
        ) : (
          <Link
            href="/dashboard"
            className="rounded-md px-3 py-2 text-sm font-medium transition-colors bg-muted/80 text-foreground"
          >
            대시보드
          </Link>
        )}
      </div>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/api/auth/signin" })}
        className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      >
        로그아웃
      </button>
    </nav>
  );
}
