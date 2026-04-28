/**
 * Trade-data shape tests. Real economy / transactions land in a
 * follow-up; this file pins the data structure.
 */

import { describe, it, expect } from 'vitest';
import {
  COMMODITIES,
  CARGO_CAPACITY,
  INITIAL_CREDITS,
  findCommodity,
  emptyCargo,
  cargoUsed,
} from '../src/sim/trade';

describe('COMMODITIES', () => {
  it('contains exactly 17 entries', () => {
    expect(COMMODITIES.length).toBe(17);
  });

  it('every commodity has the expected shape', () => {
    for (const c of COMMODITIES) {
      expect(typeof c.id).toBe('string');
      expect(c.id.length).toBeGreaterThan(0);
      expect(typeof c.name).toBe('string');
      expect(c.name.length).toBeGreaterThan(0);
      expect(typeof c.glyph).toBe('string');
      expect(c.glyph.length).toBeGreaterThan(0);
      expect(c.glyph.length).toBeLessThanOrEqual(8);
      expect(typeof c.basePrice).toBe('number');
      expect(c.basePrice).toBeGreaterThan(0);
      expect(['t', 'kg']).toContain(c.unit);
    }
  });

  it('all ids are unique', () => {
    const ids = COMMODITIES.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all glyphs are unique', () => {
    const glyphs = COMMODITIES.map(c => c.glyph);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });
});

describe('CARGO_CAPACITY / INITIAL_CREDITS', () => {
  it('cargo capacity is a sensible positive integer', () => {
    expect(Number.isInteger(CARGO_CAPACITY)).toBe(true);
    expect(CARGO_CAPACITY).toBeGreaterThan(0);
  });

  it('initial credits is a positive number', () => {
    expect(INITIAL_CREDITS).toBeGreaterThan(0);
  });
});

describe('findCommodity', () => {
  it('returns the matching commodity by id', () => {
    const food = findCommodity('food');
    expect(food).toBeDefined();
    expect(food!.name).toBe('Food');
  });

  it('returns undefined for unknown ids', () => {
    expect(findCommodity('not-a-real-id')).toBeUndefined();
  });
});

describe('emptyCargo / cargoUsed', () => {
  it('emptyCargo has every commodity at 0', () => {
    const c = emptyCargo();
    expect(Object.keys(c).length).toBe(COMMODITIES.length);
    for (const com of COMMODITIES) expect(c[com.id]).toBe(0);
  });

  it('cargoUsed sums only tonne commodities', () => {
    const cargo = emptyCargo();
    cargo.food = 5;
    cargo.liquor = 3;
    cargo.gold = 10;     // kg, ignored
    cargo.platinum = 2;  // kg, ignored
    expect(cargoUsed(cargo)).toBe(8);
  });

  it('cargoUsed of an empty cargo is 0', () => {
    expect(cargoUsed(emptyCargo())).toBe(0);
  });
});
