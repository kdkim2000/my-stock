import { describe, expect, it } from 'vitest';
import { normalizeRow, normalizeRows } from '../../lib/normalize-row';
import type { RawSheetRow } from '../../types/sheet';

describe('normalizeRow', () => {
  it('should parse strings properly', () => {
    const raw: RawSheetRow = ['2024-03-10', 'AAPL', '매수', '10', '150', '1.5', '0.5', 'Bought on dip', '#tech'];
    const normalized = normalizeRow(raw);
    
    expect(normalized.Date).toBe('2024-03-10');
    expect(normalized.Ticker).toBe('AAPL');
    expect(normalized.Type).toBe('매수');
    expect(normalized.Quantity).toBe(10);
    expect(normalized.Price).toBe(150);
    expect(normalized.Fee).toBe(1.5);
    expect(normalized.Tax).toBe(0.5);
    expect(normalized.Journal).toBe('Bought on dip');
    expect(normalized.Tags).toBe('#tech');
  });

  it('should handle numbers and format dates from serial', () => {
    const raw: RawSheetRow = [45361, 'AAPL', '매도', 10, 150.5, 0, 0, '', '']; // 45361 is roughly 2024-03-10
    const normalized = normalizeRow(raw);
    
    expect(normalized.Date).toBe('2024-03-10');
    expect(normalized.Ticker).toBe('AAPL');
    expect(normalized.Type).toBe('매도');
    expect(normalized.Quantity).toBe(10);
    expect(normalized.Price).toBe(150.5);
  });

  it('should handle string numbers with commas', () => {
    const raw: RawSheetRow = ['2024-03-10', 'AAPL', '매수', '1,000', '150,000', '1,500', '500', '', ''];
    const normalized = normalizeRow(raw);
    
    expect(normalized.Quantity).toBe(1000);
    expect(normalized.Price).toBe(150000);
    expect(normalized.Fee).toBe(1500);
    expect(normalized.Tax).toBe(500);
  });

  it('should handle missing or empty fields safely', () => {
    const raw: RawSheetRow = [null, undefined, '', '', null, undefined, '', '', ''] as any;
    const normalized = normalizeRow(raw);
    
    expect(normalized.Date).toBe('');
    expect(normalized.Ticker).toBe('');
    expect(normalized.Type).toBe('매수');
    expect(normalized.Quantity).toBe(0);
    expect(normalized.Price).toBe(0);
    expect(normalized.Fee).toBe(0);
    expect(normalized.Tax).toBe(0);
    expect(normalized.Journal).toBe('');
    expect(normalized.Tags).toBe('');
  });
});

describe('normalizeRows', () => {
  it('should normalize an array of rows', () => {
    const raw: RawSheetRow[] = [
      ['2024-03-10', 'AAPL', '매수', '10', '150', '1.5', '0.5', '', ''],
      [45361, 'TSLA', '매도', 5, 200, 0, 0, '', '']
    ];
    const normalized = normalizeRows(raw);
    
    expect(normalized).toHaveLength(2);
    expect(normalized[0].Ticker).toBe('AAPL');
    expect(normalized[1].Ticker).toBe('TSLA');
    expect(normalized[1].Quantity).toBe(5);
  });
});
