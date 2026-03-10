import type { SheetTransactionRow } from "@/types/sheet";

export interface PositionEntry {
  ticker: string;
  buyQty: number;
  buyValue: number;
}

export interface PositionProcessResult {
  ticker: string;
  costOfSold: number;
  realizedPnL: number | null; // null if Buy
  sellRevenue: number | null; // price * q - fee - tax
}

export class PositionTracker {
  private positions: Map<string, PositionEntry> = new Map();

  /**
   * Process a single transaction row.
   * Modifies the internal state tracking quantity and value.
   */
  process(row: SheetTransactionRow): PositionProcessResult | null {
    const t = (row.Ticker || "").trim();
    if (!t) return null;

    if (!this.positions.has(t)) {
      this.positions.set(t, { ticker: t, buyQty: 0, buyValue: 0 });
    }

    const p = this.positions.get(t)!;
    const q = row.Quantity || 0;
    const price = row.Price || 0;
    const fee = row.Fee || 0;
    const tax = row.Tax || 0;

    let costOfSold = 0;
    let realizedPnL: number | null = null;
    let sellRevenue: number | null = null;

    if (row.Type === "매수") {
      p.buyQty += q;
      p.buyValue += price * q;
    } else {
      costOfSold = p.buyQty > 0 ? (p.buyValue * q) / p.buyQty : 0;
      sellRevenue = price * q - fee - tax;
      realizedPnL = sellRevenue - costOfSold;

      p.buyQty -= q;
      p.buyValue -= costOfSold;
      if (p.buyQty <= 0) {
        p.buyQty = 0;
        p.buyValue = 0;
      }
    }

    return {
      ticker: t,
      costOfSold,
      realizedPnL,
      sellRevenue,
    };
  }

  getPosition(ticker: string): PositionEntry | undefined {
    return this.positions.get(ticker.trim());
  }

  getAllPositions(): PositionEntry[] {
    return Array.from(this.positions.values());
  }
}
