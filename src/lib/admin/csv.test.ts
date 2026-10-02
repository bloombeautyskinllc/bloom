import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';

describe('toCsv', () => {
  it('quotes commas, quotes and newlines', () => {
    const csv = toCsv(['a', 'b'], [['x, y', 'say "hi"\nbye']]);
    expect(csv).toBe('\uFEFFa,b\r\n"x, y","say ""hi""\nbye"\r\n');
  });
  it('neutralizes spreadsheet formulas', () => {
    expect(toCsv(['a'], [['=HYPERLINK("x")'], ['+1'], ['@cmd']])).toBe('\uFEFFa\r\n"\'=HYPERLINK(""x"")"\r\n\'+1\r\n\'@cmd\r\n');
  });
  it('writes empty cells for null and undefined', () => {
    expect(toCsv(['a', 'b', 'c'], [[null, undefined, 0]])).toBe('\uFEFFa,b,c\r\n,,0\r\n');
  });
});
