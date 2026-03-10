import React from "react";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface AiGuideSectionProps {
  aiLoading: boolean;
  aiError: string | null;
  aiContent: string | null;
  aiCachedAt: string | null;
  code: string;
  requestAiGuide: () => void;
  requestAiGuideRefresh: () => void;
}

export function AiGuideSection({
  aiLoading,
  aiError,
  aiContent,
  aiCachedAt,
  code,
  requestAiGuide,
  requestAiGuideRefresh,
}: AiGuideSectionProps) {
  const cachedDateStr = aiCachedAt
    ? new Date(aiCachedAt).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    : null;
  return (
    <section
      id="section-ai-guide"
      className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm"
      aria-busy={aiLoading}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0 text-primary/80" aria-hidden />
          AI 분석 및 매매 가이드
        </h2>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80 bg-muted/50 px-2 py-1 rounded">
          참고용
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        시세·가치평가·보조지표·최근 매매 일지를 바탕으로 투자전략 요약과 매매 가이드(참고)를 생성합니다. 매수/매도 권유가 아닙니다.
      </p>

      {/* 액션: 분석 요청 / 다시 분석 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => requestAiGuide()}
          disabled={!code || aiLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-opacity"
        >
          {aiLoading ? (
            <>
              <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden />
              <span>분석 중…</span>
            </>
          ) : (
            <span>AI 분석 요청</span>
          )}
        </button>
        {aiContent && !aiLoading && (
          <button
            type="button"
            onClick={requestAiGuideRefresh}
            disabled={!code}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 shrink-0" aria-hidden />
            <span>다시 분석</span>
          </button>
        )}
      </div>

      {/* 에러: 재시도 가능 */}
      {aiError && (
        <div
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          <p className="font-medium mb-1">분석을 불러올 수 없습니다</p>
          <p className="text-muted-foreground text-xs mb-3">{aiError}</p>
          <button
            type="button"
            onClick={requestAiGuideRefresh}
            disabled={!code || aiLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-background px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            <RefreshCw className="w-3 h-3 shrink-0" /> 다시 시도
          </button>
        </div>
      )}

      {/* 로딩: 레이아웃 유지용 플레이스홀더 */}
      {aiLoading && (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-6 min-h-[180px] flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin opacity-60" aria-hidden />
          <p className="text-sm">AI가 분석 중입니다. 잠시만 기다려 주세요.</p>
          <div className="flex gap-2 w-full max-w-[280px]">
            <div className="h-2 flex-1 rounded-full bg-muted animate-pulse" />
            <div className="h-2 flex-1 rounded-full bg-muted animate-pulse" />
            <div className="h-2 w-12 rounded-full bg-muted animate-pulse" />
          </div>
        </div>
      )}

      {/* 빈 상태: 첫 요청 유도 */}
      {!aiContent && !aiLoading && !aiError && (
        <div className="rounded-lg border border-dashed border-border/80 bg-muted/10 p-5 text-center">
          <p className="text-sm text-muted-foreground mb-3">아래 버튼을 누르면 이 종목에 대한 분석을 생성합니다.</p>
          <ul className="text-xs text-muted-foreground/90 text-left max-w-sm mx-auto mb-4 space-y-1.5">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 shrink-0" /> 시세·가치지표·투자의견
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 shrink-0" /> 재무 추이·보조지표
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 shrink-0" /> 내 포트폴리오·최근 매매 일지
            </li>
          </ul>
          <button
            type="button"
            onClick={() => requestAiGuide()}
            disabled={!code}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            AI 분석 요청
          </button>
        </div>
      )}

      {/* 결과: 마크다운 가독성 + 스크롤 */}
      {aiContent && !aiLoading && (
        <div
          className="rounded-lg border border-border/60 bg-muted/10 overflow-hidden"
          role="region"
          aria-label="AI 분석 결과"
        >
          {cachedDateStr && (
            <div className="flex items-center justify-end gap-1.5 px-4 pt-3 pb-0">
              <span className="text-[10px] text-muted-foreground/70">
                분석일시: {cachedDateStr}
              </span>
            </div>
          )}
          <div className="max-h-[420px] overflow-y-auto p-4 sm:p-5">
            <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:text-foreground prose-h2:text-sm prose-h2:mt-4 prose-h2:mb-2 prose-h2:pb-1 prose-h2:border-b prose-h2:border-border/60 prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-strong:text-foreground">
              <ReactMarkdown
                components={{
                  h2: ({ children }) => <h2>{children}</h2>,
                  h3: ({ children }) => <h3 className="text-xs font-medium mt-3 mb-1 text-foreground">{children}</h3>,
                  p: ({ children }) => <p className="text-sm">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-4 space-y-0.5">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-4 space-y-0.5">{children}</ol>,
                }}
              >
                {aiContent}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
