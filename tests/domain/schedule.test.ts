import { describe, it, expect } from 'vitest';
import { matchesDate } from '../../src/domain/schedule';

const SAT = new Date('2026-05-30');
const TUE = new Date('2026-06-02');
const MON = new Date('2026-06-01');

describe('matchesDate', () => {
  it('"daily" matches every day', () => {
    expect(matchesDate('daily', SAT)).toBe(true);
    expect(matchesDate('daily', MON)).toBe(true);
  });

  it('matches a single day', () => {
    expect(matchesDate('sat', SAT)).toBe(true);
    expect(matchesDate('sat', MON)).toBe(false);
  });

  it('matches multiple days', () => {
    expect(matchesDate('tue,thu', TUE)).toBe(true);
    expect(matchesDate('tue,thu', MON)).toBe(false);
    expect(matchesDate('tue,thu,sat', SAT)).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(matchesDate('SAT', SAT)).toBe(true);
    expect(matchesDate('TUE,THU', TUE)).toBe(true);
  });
});
