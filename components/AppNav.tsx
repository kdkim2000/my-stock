"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppNav() {
  const pathname = usePathname() ?? "";
  const isTickerDetail = pathname.startsWith("/dashboard/ticker/");

  return (
    <nav className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border/80 bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80">
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
    </nav>
  );
}
