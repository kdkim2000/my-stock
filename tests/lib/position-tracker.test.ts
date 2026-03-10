import { describe, expect, it } from 'vitest';
import { PositionTracker } from '../../lib/position-tracker';
import type { SheetTransactionRow } from '../../types/sheet';

describe('PositionTracker', () => {
  it('should track buys correctly', () => {
    const tracker = new PositionTracker();
    const row1: SheetTransactionRow = {
      Type: '매수',
      Date: '2024-03-10',
      Ticker: 'AAPL',
      Quantity: 10,
      Price: 150,
      Fee: 0,
      Tax: 0,
      Journal: '',
      Tags: '',
    };
    const row2: SheetTransactionRow = {
      Type: '매수',
      Date: '2024-03-11',
      Ticker: 'AAPL',
      Quantity: 5,
      Price: 160,
      Fee: 0,
      Tax: 0,
      Journal: '',
      Tags: '',
    };

    tracker.process(row1);
    tracker.process(row2);

    const pos = tracker.getPosition('AAPL');
    expect(pos?.buyQty).toBe(15);
    expect(pos?.buyValue).toBe(10 * 150 + 5 * 160);
  });

  it('should calculate realized PnL correctly', () => {
    const tracker = new PositionTracker();
    const buy: SheetTransactionRow = {
      Type: '매수',
      Date: '2024-03-10',
      Ticker: 'AAPL',
      Quantity: 10,
      Price: 100, // Total buy value = 1000, avg cost = 100
      Fee: 0,
      Tax: 0,
      Journal: '',
      Tags: '',
    };
    const sell: SheetTransactionRow = {
      Type: '매도',
      Date: '2024-03-11',
      Ticker: 'AAPL',
      Quantity: 5, // selling 5 out of 10
      Price: 150, // sell revenue = 750
      Fee: 5,
      Tax: 10,
      Journal: '',
      Tags: '',
    }; // net revenue = 750 - 15 = 735. cost = 5 * 100 = 500. realized = 235

    tracker.process(buy);
    const result = tracker.process(sell);

    expect(result?.costOfSold).toBe(500);
    expect(result?.sellRevenue).toBe(735);
    expect(result?.realizedPnL).toBe(235);

    const pos = tracker.getPosition('AAPL');
    expect(pos?.buyQty).toBe(5);
    expect(pos?.buyValue).toBe(500); // the remaining 500
  });

  it('should handle full sellout and reset cost basis', () => {
    const tracker = new PositionTracker();
    const buy1: SheetTransactionRow = { Type: '매수', Date: '2024-03-10', Ticker: 'AAPL', Quantity: 10, Price: 100, Fee: 0, Tax: 0, Journal: '', Tags: '' };
    const sellAll: SheetTransactionRow = { Type: '매도', Date: '2024-03-11', Ticker: 'AAPL', Quantity: 10, Price: 150, Fee: 0, Tax: 0, Journal: '', Tags: '' };
    
    tracker.process(buy1);
    tracker.process(sellAll);

    let pos = tracker.getPosition('AAPL');
    expect(pos?.buyQty).toBe(0);
    expect(pos?.buyValue).toBe(0);

    const buy2: SheetTransactionRow = { Type: '매수', Date: '2024-03-12', Ticker: 'AAPL', Quantity: 5, Price: 200, Fee: 0, Tax: 0, Journal: '', Tags: '' };
    tracker.process(buy2);

    pos = tracker.getPosition('AAPL');
    expect(pos?.buyQty).toBe(5);
    expect(pos?.buyValue).toBe(1000); // 5 * 200
  });
});
