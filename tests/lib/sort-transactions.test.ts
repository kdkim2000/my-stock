import { describe, expect, it } from 'vitest';
import { sortTransactionsByDate } from '../../lib/sort-transactions';
import type { SheetTransactionRow } from '../../types/sheet';

describe('sortTransactionsByDate', () => {
  it('should sort transactions by date chronologically', () => {
    const transactions: SheetTransactionRow[] = [
      {
        Type: '매수',
        Date: '2024-03-10',
        Ticker: 'AAPL',
        Quantity: 10,
        Price: 150,
        Fee: 0,
        Tax: 0,
        Journal: '',
        Tags: '',
      },
      {
        Type: '매수',
        Date: '2024-03-08',
        Ticker: 'AAPL',
        Quantity: 10,
        Price: 140,
        Fee: 0,
        Tax: 0,
        Journal: '',
        Tags: '',
      },
      {
        Type: '매도',
        Date: '2024-03-09',
        Ticker: 'AAPL',
        Quantity: 5,
        Price: 160,
        Fee: 0,
        Tax: 0,
        Journal: '',
        Tags: '',
      },
    ];

    const sorted = sortTransactionsByDate(transactions);

    expect(sorted[0].Date).toBe('2024-03-08');
    expect(sorted[1].Date).toBe('2024-03-09');
    expect(sorted[2].Date).toBe('2024-03-10');
  });

  it('should maintain original order for identical dates', () => {
    const transactions: SheetTransactionRow[] = [
      {
        Type: '매수',
        Date: '2024-03-10',
        Ticker: 'AAPL',
        Quantity: 10,
        Price: 150,
        Fee: 0,
        Tax: 0,
        Journal: '',
        Tags: '',
      },
      {
        Type: '매도',
        Date: '2024-03-10',
        Ticker: 'AAPL',
        Quantity: 5,
        Price: 160,
        Fee: 0,
        Tax: 0,
        Journal: '',
        Tags: '',
      },
    ];

    const sorted = sortTransactionsByDate(transactions);

    expect(sorted[0].Type).toBe('매수'); // First in original array
    expect(sorted[1].Type).toBe('매도'); // Second in original array
  });
});
