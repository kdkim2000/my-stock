"use client";

import { useState, useMemo, useEffect } from "react";
import { useSheetData } from "@/hooks/useSheetData";
import type { SheetTransactionRow } from "@/types/sheet";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const;
const DEFAULT_PAGE_SIZE = 10;
const PAGE_WINDOW = 10;

export function TransactionTable() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const { data, isPending, error } = useSheetData();
  const transactions: SheetTransactionRow[] = data?.transactions ?? [];

  const { totalPages, paginatedRows, startItem, endItem } = useMemo(() => {
    const total = transactions.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * pageSize;
    const end = Math.min(start + pageSize, total);
    return {
      totalPages,
      paginatedRows: transactions.slice(start, end),
      startItem: total === 0 ? 0 : start + 1,
      endItem: end,
    };
  }, [transactions, page, pageSize]);

  useEffect(() => {
    if (totalPages >= 1 && page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));
  const goToPage = (p: number) => setPage(Math.max(1, Math.min(totalPages, p)));

  const pageNumbers = useMemo(() => {
    if (totalPages <= PAGE_WINDOW) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const half = Math.floor(PAGE_WINDOW / 2);
    let low = Math.max(1, page - half);
    let high = Math.min(totalPages, low + PAGE_WINDOW - 1);
    if (high - low + 1 < PAGE_WINDOW) low = Math.max(1, high - PAGE_WINDOW + 1);
    return Array.from({ length: high - low + 1 }, (_, i) => low + i);
  }, [totalPages, page]);

  if (isPending) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        로딩 중…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-destructive text-sm">
        거래 내역을 불러올 수 없습니다.
      </div>
    );
  }
  if (transactions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/10 px-4 py-8 text-center text-muted-foreground text-sm">
        거래 내역이 없습니다. Google Sheets를 연동하면 여기에 표시됩니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          페이지당 건수
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
            aria-label="페이지당 건수"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}건
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">일자</th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">종목</th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">구분</th>
              <th className="p-3 text-right text-xs font-medium text-muted-foreground">수량</th>
              <th className="p-3 text-right text-xs font-medium text-muted-foreground">단가</th>
              <th className="p-3 text-right text-xs font-medium text-muted-foreground">수수료</th>
              <th className="p-3 text-right text-xs font-medium text-muted-foreground">세금</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, i) => {
              const globalIndex = (page - 1) * pageSize + i;
              return (
                <tr key={globalIndex} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                  <td className="p-3">{row.Date}</td>
                  <td className="p-3">{row.Ticker}</td>
                  <td className="p-3">{row.Type}</td>
                  <td className="p-3 text-right">{row.Quantity.toLocaleString()}</td>
                  <td className="p-3 text-right">{row.Price.toLocaleString()}</td>
                  <td className="p-3 text-right">{row.Fee.toLocaleString()}</td>
                  <td className="p-3 text-right">{row.Tax.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          총 {transactions.length.toLocaleString()}건 · {startItem}-{endItem} 표시
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
            onClick={goPrev}
            disabled={page <= 1}
            aria-label="이전 페이지"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="flex items-center gap-1">
            {pageNumbers[0] > 1 && (
              <>
                <button
                  type="button"
                  className="min-w-[2rem] rounded-md border border-input bg-background px-2 py-1.5 text-sm hover:bg-muted"
                  onClick={() => goToPage(1)}
                >
                  1
                </button>
                {pageNumbers[0] > 2 && <span className="px-1 text-muted-foreground">…</span>}
              </>
            )}
            {pageNumbers.map((n) => (
              <button
                key={n}
                type="button"
                className={`min-w-[2rem] rounded-md px-2 py-1.5 text-sm ${
                  n === page
                    ? "border border-primary bg-primary text-primary-foreground"
                    : "border border-input bg-background hover:bg-muted"
                }`}
                onClick={() => goToPage(n)}
                aria-label={`${n}페이지`}
                aria-current={n === page ? "page" : undefined}
              >
                {n}
              </button>
            ))}
            {pageNumbers[pageNumbers.length - 1] < totalPages && (
              <>
                {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                  <span className="px-1 text-muted-foreground">…</span>
                )}
                <button
                  type="button"
                  className="min-w-[2rem] rounded-md border border-input bg-background px-2 py-1.5 text-sm hover:bg-muted"
                  onClick={() => goToPage(totalPages)}
                >
                  {totalPages}
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
            onClick={goNext}
            disabled={page >= totalPages}
            aria-label="다음 페이지"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
