"use client";

import type { SheetTransactionRow } from "@/types/sheet";

interface JournalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: SheetTransactionRow | null;
}

/**
 * 매매 복기 모달 (PRD §3.4) — 상세 내역, 매매 사유·감정·전략 태그 에디터 placeholder
 */
export function JournalModal({ open, onOpenChange, transaction }: JournalModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => onOpenChange(false)}>
      <div className="bg-card rounded-lg border p-6 max-w-lg w-full mx-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">매매 복기</h3>
        {transaction ? (
          <div className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">일자:</span> {transaction.Date}</p>
            <p><span className="text-muted-foreground">종목:</span> {transaction.Ticker}</p>
            <p><span className="text-muted-foreground">구분:</span> {transaction.Type}</p>
            <p><span className="text-muted-foreground">매매 복기:</span> {transaction.Journal || "(비어 있음)"}</p>
            <p><span className="text-muted-foreground">태그:</span> {transaction.Tags || "(없음)"}</p>
          </div>
        ) : (
          <p className="text-muted-foreground">거래를 선택하세요.</p>
        )}
        <p className="mt-4 text-xs text-muted-foreground">에디터 기능은 추후 구현 예정입니다.</p>
        <button type="button" className="mt-4 px-4 py-2 rounded-md border" onClick={() => onOpenChange(false)}>닫기</button>
      </div>
    </div>
  );
}
