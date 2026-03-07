import type { SheetTransactionRow } from "@/types/sheet";

/**
 * 매매 내역을 거래일 순으로 정렬한 복사본 반환.
 * 같은 날짜는 원본 배열 인덱스(행 순서)로 2차 정렬해 일관된 처리 순서를 보장합니다.
 */
export function sortTransactionsByDate(
  transactions: SheetTransactionRow[]
): SheetTransactionRow[] {
  return transactions
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const tA = new Date(a.row.Date).getTime();
      const tB = new Date(b.row.Date).getTime();
      if (tA !== tB) return tA - tB;
      return a.index - b.index;
    })
    .map(({ row }) => row);
}
