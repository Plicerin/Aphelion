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
  priceForSystem,
  canBuy,
  canSell,
  applyBuy,
  applySell,
} from '../src/sim/trade';
import type { System } from '../src/types';

function makeSystem(econ: System['economy'], techLevel: number, seedSalt = 0): System {
  return {
    index: 0,
    name: 'Test',
    x: 0, y: 0,
    economy: econ,
    government: 'democracy',
    techLevel,
    population: 1,
    productivity: 100,
    radius: 5000,
    seed: [(seedSalt + 1) & 0xffff, (seedSalt + 2) & 0xffff, (seedSalt + 3) & 0xffff],
  };
}

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

describe('priceForSystem', () => {
  const food = COMMODITIES.find(c => c.id === 'food')!;
  const computers = COMMODITIES.find(c => c.id === 'computers')!;
  const gold = COMMODITIES.find(c => c.id === 'gold')!;

  it('is deterministic for the same system + commodity', () => {
    const sys = makeSystem('mainly-industrial', 8, 42);
    expect(priceForSystem(food, sys)).toBe(priceForSystem(food, sys));
  });

  it('food is more expensive in industrial than in agricultural systems', () => {
    const ind = makeSystem('rich-industrial', 8, 1);
    const agri = makeSystem('rich-agricultural', 8, 1);
    expect(priceForSystem(food, ind)).toBeGreaterThan(priceForSystem(food, agri));
  });

  it('computers are cheaper in industrial than in agricultural systems', () => {
    const ind = makeSystem('rich-industrial', 8, 1);
    const agri = makeSystem('rich-agricultural', 8, 1);
    expect(priceForSystem(computers, ind)).toBeLessThan(priceForSystem(computers, agri));
  });

  it('computers are cheaper at high tech than at low tech', () => {
    const lowTech = makeSystem('mainly-industrial', 1, 1);
    const highTech = makeSystem('mainly-industrial', 15, 1);
    expect(priceForSystem(computers, highTech)).toBeLessThan(priceForSystem(computers, lowTech));
  });

  it('returns a positive integer', () => {
    const sys = makeSystem('mainly-industrial', 8, 7);
    const p = priceForSystem(food, sys);
    expect(Number.isInteger(p)).toBe(true);
    expect(p).toBeGreaterThan(0);
  });

  it('different system seeds produce different prices for the same commodity', () => {
    // For low-base-price commodities, integer rounding can collapse the
    // ±10% flux to identical values for nearby seeds. Use a higher-base
    // commodity (computers, base 64) and check across several seeds for
    // at least two distinct prices.
    const seen = new Set<number>();
    for (let i = 1; i <= 8; i++) {
      const sys = makeSystem('mainly-industrial', 8, i * 13);
      seen.add(priceForSystem(computers, sys));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('precious metals (gradient 0) ignore the economy axis', () => {
    const ind = makeSystem('rich-industrial', 8, 5);
    const agri = makeSystem('rich-agricultural', 8, 5);
    // With same seed and gradient 0, only flux differs — not economy.
    // We can't assert exact equality due to flux, but the spread should
    // be small (within 20% bound).
    const pInd = priceForSystem(gold, ind);
    const pAgri = priceForSystem(gold, agri);
    const ratio = Math.max(pInd, pAgri) / Math.min(pInd, pAgri);
    expect(ratio).toBeLessThan(1.5);
  });

  it('stays within sensible bounds (0.3x - 2.5x of base)', () => {
    // Compounded extremes: gradient * econMod (±40%) * techBias * dTL (±30%)
    // * flux (±10%) can push prices to ~0.34x of base in the worst direction.
    // 0.3 gives margin; 2.5 is the symmetric upper bound.
    for (const c of COMMODITIES) {
      for (const econ of ['rich-industrial', 'poor-agricultural'] as const) {
        for (const tl of [1, 8, 15]) {
          const sys = makeSystem(econ, tl, tl);
          const p = priceForSystem(c, sys);
          expect(p).toBeGreaterThanOrEqual(Math.max(1, c.basePrice * 0.3));
          expect(p).toBeLessThanOrEqual(c.basePrice * 2.5);
        }
      }
    }
  });
});

describe('canBuy / canSell', () => {
  it('canBuy true when funds and capacity allow', () => {
    expect(canBuy(10, 3, 0, 40, 100, true)).toBe(true);
  });

  it('canBuy false when not enough credits', () => {
    expect(canBuy(50, 3, 0, 40, 100, true)).toBe(false);
  });

  it('canBuy false when cargo would exceed capacity (tonne)', () => {
    expect(canBuy(1, 5, 38, 40, 9999, true)).toBe(false);
  });

  it('canBuy ignores capacity for kg commodities', () => {
    expect(canBuy(1, 999, 38, 40, 9999, false)).toBe(true);
  });

  it('canBuy false for n < 1', () => {
    expect(canBuy(1, 0, 0, 40, 100, true)).toBe(false);
  });

  it('canBuy true at exact funds', () => {
    expect(canBuy(10, 5, 0, 40, 50, true)).toBe(true);
  });

  it('canBuy true at exact capacity', () => {
    expect(canBuy(1, 5, 35, 40, 100, true)).toBe(true);
  });

  it('canSell true when held >= n', () => {
    expect(canSell(5, 3)).toBe(true);
    expect(canSell(3, 3)).toBe(true);
  });

  it('canSell false when held < n', () => {
    expect(canSell(2, 3)).toBe(false);
  });

  it('canSell false for n < 1', () => {
    expect(canSell(5, 0)).toBe(false);
  });
});

describe('applyBuy / applySell', () => {
  it('applyBuy increases cargo and decreases credits', () => {
    const r = applyBuy({ food: 0 }, 100, 'food', 5, 10);
    expect(r.cargo.food).toBe(5);
    expect(r.credits).toBe(50);
  });

  it('applySell decreases cargo and increases credits', () => {
    const r = applySell({ food: 5 }, 50, 'food', 3, 10);
    expect(r.cargo.food).toBe(2);
    expect(r.credits).toBe(80);
  });

  it('applyBuy does not mutate inputs', () => {
    const cargo = { food: 1 };
    const credits = 100;
    applyBuy(cargo, credits, 'food', 2, 10);
    expect(cargo.food).toBe(1);
    expect(credits).toBe(100);
  });

  it('round trip is exact (bought then sold = original at same price)', () => {
    const start = { food: 0 };
    const startCr = 100;
    const after = applyBuy(start, startCr, 'food', 5, 12);
    const back = applySell(after.cargo, after.credits, 'food', 5, 12);
    expect(back.cargo.food).toBe(0);
    expect(back.credits).toBe(100);
  });
});
