import { describe, it, expect } from 'vitest';
import { getNextPositions, advancePosition } from '../../src/domain/rotation';

describe('getNextPositions', () => {
  it('returns single position for 1 worker', () => {
    expect(getNextPositions(0, 4, 1)).toEqual([0]);
    expect(getNextPositions(3, 4, 1)).toEqual([3]);
  });

  it('returns consecutive positions for 2 workers', () => {
    expect(getNextPositions(0, 4, 2)).toEqual([0, 1]);
    expect(getNextPositions(1, 4, 2)).toEqual([1, 2]);
  });

  it('wraps around the kid list', () => {
    expect(getNextPositions(3, 4, 2)).toEqual([3, 0]);
    expect(getNextPositions(2, 3, 2)).toEqual([2, 0]);
  });

  it('returns all positions when workers_count equals kid count', () => {
    expect(getNextPositions(2, 4, 4)).toEqual([2, 3, 0, 1]);
  });
});

describe('advancePosition', () => {
  it('advances without wrap', () => {
    expect(advancePosition(0, 4, 1)).toBe(1);
    expect(advancePosition(1, 4, 2)).toBe(3);
  });

  it('wraps around', () => {
    expect(advancePosition(3, 4, 1)).toBe(0);
    expect(advancePosition(2, 4, 3)).toBe(1);
  });
});
