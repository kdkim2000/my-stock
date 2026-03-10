import React from "react";

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted/60 ${className}`} />;
}

export function FinancialSectionSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="rounded-lg border-2 border-border/50 bg-muted/10 p-5 space-y-3">
          <SkeletonBlock className="h-3 w-32" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex flex-col gap-2">
                <SkeletonBlock className="h-3 w-16" />
                <SkeletonBlock className="h-6 w-20" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border-2 border-border/50 bg-muted/10 p-5 space-y-3">
          <SkeletonBlock className="h-3 w-24" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex flex-col gap-2">
                <SkeletonBlock className="h-3 w-16" />
                <SkeletonBlock className="h-6 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <SkeletonBlock className="h-[220px] w-full rounded-lg" />
        <SkeletonBlock className="h-[220px] w-full rounded-lg" />
      </div>
    </div>
  );
}

export function RatioSectionSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SkeletonBlock className="h-[260px] w-full rounded-lg" />
        <SkeletonBlock className="h-[260px] w-full rounded-lg" />
        <SkeletonBlock className="h-[260px] w-full rounded-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-lg border border-border/50 p-4 space-y-2">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-5 w-16" />
            <SkeletonBlock className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TradeSectionSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <SkeletonBlock className="h-3 w-64" />
        <SkeletonBlock className="h-3 w-48" />
        <SkeletonBlock className="h-72 w-full rounded-lg" />
      </div>
      <div className="space-y-2">
        <SkeletonBlock className="h-3 w-56" />
        <SkeletonBlock className="h-72 w-full rounded-lg" />
      </div>
    </div>
  );
}
