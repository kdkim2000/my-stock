"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const formatNum = (v: number) => {
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)}조`;
  if (v >= 1e8) return `${(v / 1e8).toFixed(1)}억`;
  if (v >= 1e4) return `${(v / 1e4).toFixed(1)}만`;
  return String(v);
};

export interface ValuationData {
  code: string;
  per: number | null;
  pbr: number | null;
  eps: number | null;
  roe: number | null;
  evEbitda: number | null;
  currentPrice: number | null;
  bsnsYear: string;
}

export interface YearData {
  year: string;
  balanceSheet?: Record<string, number>;
  incomeStatement?: Record<string, number>;
  cashFlow?: Record<string, number>;
}

export interface FinancialsData {
  code: string;
  latestYear?: string;
  multiYear: YearData[];
}

export interface DocumentData {
  businessOverview?: string;
  mda?: string;
  notes?: string;
}

interface FundamentalDashboardProps {
  code: string;
  valuation: ValuationData | null;
  financials: FinancialsData | null;
  document: DocumentData;
  isPending?: boolean;
  error?: string | null;
}

export function FundamentalDashboard({
  code,
  valuation,
  financials,
  document,
  isPending,
  error,
}: FundamentalDashboardProps) {
  const [openAccordion, setOpenAccordion] = useState<"business" | "mda" | "notes" | null>(null);

  const chartData = useMemo(() => {
    if (!financials?.multiYear?.length) return [];
    return financials.multiYear.map((y) => ({
      year: y.year,
      매출액: y.incomeStatement?.revenue ?? 0,
      영업이익: y.incomeStatement?.operatingIncome ?? 0,
      당기순이익: y.incomeStatement?.netIncome ?? 0,
    }));
  }, [financials]);

  const cfData = useMemo(() => {
    if (!financials?.multiYear?.length) return [];
    return financials.multiYear.map((y) => ({
      year: y.year,
      영업: y.cashFlow?.operating ?? 0,
      투자: y.cashFlow?.investing ?? 0,
      재무: y.cashFlow?.financing ?? 0,
    }));
  }, [financials]);

  if (isPending) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
        지표를 불러오는 중…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-4 text-lg font-semibold">가치평가 (Valuation)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "PER", value: valuation?.per, fmt: (v: number) => v.toFixed(1) },
            { label: "PBR", value: valuation?.pbr, fmt: (v: number) => v.toFixed(1) },
            { label: "ROE(%)", value: valuation?.roe, fmt: (v: number) => v.toFixed(1) },
            { label: "EV/EBITDA", value: valuation?.evEbitda, fmt: (v: number) => v.toFixed(1) },
            { label: "EPS(원)", value: valuation?.eps, fmt: (v: number) => Math.round(v).toLocaleString() },
          ].map(({ label, value, fmt }) => (
            <div
              key={label}
              className="rounded-lg border bg-card p-4 shadow-sm"
            >
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-semibold">
                {value != null && value !== 0 ? fmt(value) : "—"}
              </p>
            </div>
          ))}
        </div>
        {valuation?.currentPrice != null && (
          <p className="mt-2 text-sm text-muted-foreground">
            기준가 {valuation.currentPrice.toLocaleString()}원
            {valuation.bsnsYear && ` · 재무기준 ${valuation.bsnsYear}년`}
          </p>
        )}
      </div>

      {chartData.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">매출액·영업이익·당기순이익 (5개년)</h2>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="year" className="text-xs" />
                <YAxis tickFormatter={formatNum} className="text-xs" />
                <Tooltip formatter={(v: number | undefined) => formatNum(v ?? 0)} />
                <Legend />
                <Bar dataKey="매출액" fill="hsl(var(--chart-1))" name="매출액" radius={[4, 4, 0, 0]} />
                <Bar dataKey="영업이익" fill="hsl(var(--chart-2))" name="영업이익" radius={[4, 4, 0, 0]} />
                <Bar dataKey="당기순이익" fill="hsl(var(--chart-3))" name="당기순이익" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {cfData.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">현금흐름 (영업·투자·재무)</h2>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-2 text-left font-medium">연도</th>
                    <th className="p-2 text-right font-medium">영업활동</th>
                    <th className="p-2 text-right font-medium">투자활동</th>
                    <th className="p-2 text-right font-medium">재무활동</th>
                  </tr>
                </thead>
                <tbody>
                  {cfData.map((row) => (
                    <tr key={row.year} className="border-b">
                      <td className="p-2">{row.year}</td>
                      <td
                        className={`p-2 text-right ${(row.영업 ?? 0) >= 0 ? "text-profit" : "text-loss"}`}
                      >
                        {formatNum(row.영업 ?? 0)}
                      </td>
                      <td
                        className={`p-2 text-right ${(row.투자 ?? 0) >= 0 ? "text-profit" : "text-loss"}`}
                      >
                        {formatNum(row.투자 ?? 0)}
                      </td>
                      <td
                        className={`p-2 text-right ${(row.재무 ?? 0) >= 0 ? "text-profit" : "text-loss"}`}
                      >
                        {formatNum(row.재무 ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-4 text-lg font-semibold">공시 요약</h2>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setOpenAccordion(openAccordion === "business" ? null : "business")}
            className="flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3 text-left font-medium hover:bg-muted/50"
          >
            <span>사업의 내용</span>
            <span className="text-muted-foreground">{openAccordion === "business" ? "▲" : "▼"}</span>
          </button>
          {openAccordion === "business" && (
            <div className="rounded-b-lg border border-t-0 bg-muted/30 p-4 text-sm text-muted-foreground">
              {document.businessOverview ?? "데이터를 불러오지 못했습니다. (document.xml 연동 후 표시)"}
            </div>
          )}

          <button
            type="button"
            onClick={() => setOpenAccordion(openAccordion === "mda" ? null : "mda")}
            className="flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3 text-left font-medium hover:bg-muted/50"
          >
            <span>이사의 경영진단 (MD&A)</span>
            <span className="text-muted-foreground">{openAccordion === "mda" ? "▲" : "▼"}</span>
          </button>
          {openAccordion === "mda" && (
            <div className="rounded-b-lg border border-t-0 bg-muted/30 p-4 text-sm text-muted-foreground">
              {document.mda ?? "데이터를 불러오지 못했습니다. (document.xml 연동 후 표시)"}
            </div>
          )}

          <button
            type="button"
            onClick={() => setOpenAccordion(openAccordion === "notes" ? null : "notes")}
            className="flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3 text-left font-medium hover:bg-muted/50"
          >
            <span>주석</span>
            <span className="text-muted-foreground">{openAccordion === "notes" ? "▲" : "▼"}</span>
          </button>
          {openAccordion === "notes" && (
            <div className="rounded-b-lg border border-t-0 bg-muted/30 p-4 text-sm text-muted-foreground">
              {document.notes ?? "데이터를 불러오지 못했습니다. (document.xml 연동 후 표시)"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
