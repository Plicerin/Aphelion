/**
 * Refuel tests — pricing and fill caps.
 */

import { describe, it, expect } from 'vitest';
import { applyRefuel, refuelCost, FUEL_PRICE_PER_LY } from '../src/sim/refuel';

const MAX_FUEL = 7;

describe('applyRefuel', () => {
  it('does nothing when tank is already full', () => {
    const r = applyRefuel(MAX_FUEL, 1000, MAX_FUEL);
    expect(r.bought).toBe(0);
    expect(r.newFuel).toBe(MAX_FUEL);
    expect(r.newCredits).toBe(1000);
  });

  it('does nothing when credits are below the per-LY price', () => {
    const r = applyRefuel(0, FUEL_PRICE_PER_LY - 1, MAX_FUEL);
    expect(r.bought).toBe(0);
    expect(r.newFuel).toBe(0);
    expect(r.newCredits).toBe(FUEL_PRICE_PER_LY - 1);
  });

  it('fills tank to max when credits are plentiful', () => {
    const r = applyRefuel(0, 1000, MAX_FUEL);
    expect(r.bought).toBe(MAX_FUEL);
    expect(r.newFuel).toBe(MAX_FUEL);
    expect(r.newCredits).toBe(1000 - MAX_FUEL * FUEL_PRICE_PER_LY);
  });

  it('partial fill when credits run out before tank is full', () => {
    // 12 credits at 5/LY → 2 LY bought, 2 cr change left over
    const r = applyRefuel(0, 12, MAX_FUEL);
    expect(r.bought).toBe(2);
    expect(r.newFuel).toBe(2);
    expect(r.newCredits).toBe(2);
  });

  it('only buys whole LY (no fractional credit waste)', () => {
    const r = applyRefuel(0, 7, MAX_FUEL);   // 7 cr buys 1 LY, 2 left
    expect(r.bought).toBe(1);
    expect(r.newCredits).toBe(2);
  });

  it('tops up partial tank without overfilling', () => {
    const r = applyRefuel(5, 1000, MAX_FUEL);
    expect(r.bought).toBe(2);
    expect(r.newFuel).toBe(MAX_FUEL);
  });

  it('handles fractional starting fuel by topping up to floor of max', () => {
    // Player at 5.4 LY; max 7. Floor(7 - 5.4) = 1 LY bought → 6.4 LY.
    const r = applyRefuel(5.4, 1000, MAX_FUEL);
    expect(r.bought).toBe(1);
    expect(r.newFuel).toBeCloseTo(6.4, 5);
  });

  it('does not mutate its inputs', () => {
    // (Inputs are primitives so they can't be mutated, but the test
    // documents the intent — caller-controlled state.)
    const fuel = 0, credits = 50;
    applyRefuel(fuel, credits, MAX_FUEL);
    expect(fuel).toBe(0);
    expect(credits).toBe(50);
  });
});

describe('refuelCost', () => {
  it('zero when tank is full', () => {
    expect(refuelCost(MAX_FUEL, MAX_FUEL)).toBe(0);
  });

  it('full price for an empty tank', () => {
    expect(refuelCost(0, MAX_FUEL)).toBe(MAX_FUEL * FUEL_PRICE_PER_LY);
  });

  it('cost reflects whole-LY pricing for fractional tanks', () => {
    expect(refuelCost(5.4, MAX_FUEL)).toBe(1 * FUEL_PRICE_PER_LY);
  });
});
