import React from "react";

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
  className?: string;
}

export function TableSkeleton({ rows = 5, cols = 5, className }: TableSkeletonProps) {
  return (
    <div className={`space-y-2 ${className ?? ""}`} aria-busy="true" aria-label="로딩 중">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">
          {Array.from({ length: cols }).map((__, j) => (
            <div
              key={j}
              className="h-10 flex-1 rounded-md bg-muted/50 animate-pulse"
              style={{ flexGrow: j === 0 ? 2 : 1 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
