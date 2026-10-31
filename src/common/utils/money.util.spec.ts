import { fromCents, toCents } from '@/common/utils/money.util';

describe('money', () => {
  it('reads the text that Postgres delivers', () => {
    expect(toCents('123.45')).toBe(12345);
    expect(toCents('0.00')).toBe(0);
  });

  it('does not drag floating point residue', () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(fromCents(toCents('19.99') + toCents('0.01'))).toBe(20);
  });
});
