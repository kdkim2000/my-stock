"use client";

import { useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, AuthError } from "@/lib/api-client";

interface AiContext {
  detailSummary: string;
  journalEntries: unknown[];
}

export function useAiGuidance({
  code,
  ticker,
  aiContext,
}: {
  code: string;
  ticker: string;
  aiContext: AiContext;
}) {
  const aiForceRef = useRef(false);
  const [aiQueryEnabled] = useState(true);

  const aiGuideQuery = useQuery({
    queryKey: ["ai", "trading-guide", code],
    queryFn: async () => {
      const isForce = aiForceRef.current;
      const body: {
        code: string;
        ticker: string;
        force?: boolean;
        cacheOnly?: boolean;
        context?: { detailSummary: string; journalEntries: unknown[] };
      } = {
        code,
        ticker,
        force: isForce,
        cacheOnly: !isForce,
      };

      if (isForce && aiContext.detailSummary.trim()) {
        body.context = {
          detailSummary: aiContext.detailSummary,
          journalEntries: aiContext.journalEntries,
        };
      }

      const res = await apiFetch("/api/ai/trading-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { content?: string; cachedAt?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "요청 실패");

      aiForceRef.current = false;
      return { content: data.content ?? null, cachedAt: data.cachedAt ?? null };
    },
    enabled: !!code && aiQueryEnabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const requestAiGuide = useCallback(() => {
    if (!code) return;
    aiForceRef.current = true;
    void aiGuideQuery.refetch();
  }, [code, aiGuideQuery.refetch]);

  const requestAiGuideRefresh = useCallback(() => {
    if (!code) return;
    aiForceRef.current = true;
    void aiGuideQuery.refetch();
  }, [code, aiGuideQuery.refetch]);

  const err = aiGuideQuery.error;
  const isAuthError = err instanceof AuthError || (err as AuthError | null)?.isAuthError === true;

  return {
    aiContent: aiGuideQuery.data?.content ?? null,
    aiCachedAt: aiGuideQuery.data?.cachedAt ?? null,
    aiError: isAuthError ? null : (err?.message ?? null),
    aiAuthError: isAuthError,
    aiLoading: aiGuideQuery.isFetching,
    requestAiGuide,
    requestAiGuideRefresh,
  };
}
