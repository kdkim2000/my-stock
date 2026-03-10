import React from "react";
import { BarChart2, Table2, FileText } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
} from "recharts";
import { formatFundamentalNum } from "../utils";

interface DartSectionProps {
  fundamentalData: any;
}

export function DartSection({ fundamentalData }: DartSectionProps) {
  return (
    <>
      {/* 차트: DART 매출·영업이익·당기순이익 (최근 5개년) */}
      {(fundamentalData.dart?.multiYear?.length ?? 0) > 0 && (() => {
        const multiYear = fundamentalData.dart!.multiYear!;
        const chartData = multiYear.map((y: any) => ({
          year: y.year,
          매출액: y.incomeStatement?.revenue ?? 0,
          영업이익: y.incomeStatement?.operatingIncome ?? 0,
          당기순이익: y.incomeStatement?.netIncome ?? 0,
        }));
        if (chartData.every((r: any) => !r.매출액 && !r.영업이익 && !r.당기순이익)) return null;
        return (
          <section id="section-dart-income" className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm" key="fundamental-chart">
            <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 shrink-0 text-muted-foreground" />
            매출·영업이익·당기순이익 (DART 최근 5개년)
          </h2>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="year" className="text-xs" />
                  <YAxis tickFormatter={formatFundamentalNum} className="text-xs" />
                  <Tooltip formatter={(v: number | undefined) => formatFundamentalNum(v ?? 0)} />
                  <Legend />
                  <Bar dataKey="매출액" fill="hsl(var(--chart-1))" name="매출액" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="영업이익" fill="hsl(var(--chart-2))" name="영업이익" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="당기순이익" fill="hsl(var(--chart-3))" name="당기순이익" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        );
      })()}

      {/* 현금흐름 (DART 5개년) */}
      {(fundamentalData.dart?.multiYear?.length ?? 0) > 0 && (() => {
        const cfRows = fundamentalData.dart!.multiYear!.map((y: any) => ({
          year: y.year,
          영업: y.cashFlow?.operating ?? 0,
          투자: y.cashFlow?.investing ?? 0,
          재무: y.cashFlow?.financing ?? 0,
        }));
        if (cfRows.every((r: any) => !r.영업 && !r.투자 && !r.재무)) return null;
        return (
          <section id="section-cashflow" className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm" key="cashflow">
            <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
            <Table2 className="w-4 h-4 shrink-0 text-muted-foreground" />
            현금흐름 (영업·투자·재무, DART 5개년)
          </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">연도</th>
                    <th className="p-3 text-right text-xs font-medium text-muted-foreground">영업활동</th>
                    <th className="p-3 text-right text-xs font-medium text-muted-foreground">투자활동</th>
                    <th className="p-3 text-right text-xs font-medium text-muted-foreground">재무활동</th>
                  </tr>
                </thead>
                <tbody>
                  {cfRows.map((row: any) => (
                    <tr key={row.year} className="border-b border-border/60">
                      <td className="p-3">{row.year}</td>
                      <td className={`p-3 text-right ${(row.영업 ?? 0) >= 0 ? "text-profit" : "text-loss"}`}>
                        {formatFundamentalNum(row.영업 ?? 0)}
                      </td>
                      <td className={`p-3 text-right ${(row.투자 ?? 0) >= 0 ? "text-profit" : "text-loss"}`}>
                        {formatFundamentalNum(row.투자 ?? 0)}
                      </td>
                      <td className={`p-3 text-right ${(row.재무 ?? 0) >= 0 ? "text-profit" : "text-loss"}`}>
                        {formatFundamentalNum(row.재무 ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })()}

      {/* 공시: 링크만 제공. 상세 내용은 DART에서 확인 */}
      <section id="section-disclosure" className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
          <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
          공시
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          공시 상세 내용은 아래 링크에서 확인할 수 있습니다.
        </p>
        <div className="flex flex-wrap gap-2">
          {fundamentalData.dart?.preliminaryLink ? (
            <a
              href={fundamentalData.dart.preliminaryLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-4 py-2.5 text-sm font-medium hover:bg-muted/80"
            >
              최근 잠정실적 공시 (DART) ↗
            </a>
          ) : null}
          <a
            href="https://dart.fss.or.kr"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-4 py-2.5 text-sm font-medium hover:bg-muted/80"
          >
            DART 공시검색 ↗
          </a>
        </div>
      </section>
    </>
  );
}
