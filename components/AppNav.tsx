"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ArrowLeft, LogOut } from "lucide-react";

export function AppNav() {
  const pathname = usePathname() ?? "";
  const isTickerDetail = pathname.startsWith("/dashboard/ticker/");

  return (
    <nav className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-card/98 px-4 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-card/90">
      <div className="flex flex-wrap items-center gap-2">
        {isTickerDetail ? (
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden />
            대시보드
          </Link>
        ) : (
          <>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium bg-muted/70 text-foreground"
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" aria-hidden />
              대시보드
            </Link>
            <a
              href="/dashboard#ticker-analysis"
              className="hidden sm:inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              종목별 분석
            </a>
            <a
              href="/dashboard#journal"
              className="hidden sm:inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              매매 내역
            </a>
          </>
        )}
      </div>
      <Link
        href="/api/auth/logout"
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
      >
        <LogOut className="w-4 h-4 shrink-0" aria-hidden />
        로그아웃
      </Link>
    </nav>
  );
}
