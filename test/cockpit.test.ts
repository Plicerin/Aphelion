/**
 * Cockpit sim tests. Covers compass direction, fuel arithmetic, cabin
 * heat scaling near a sun, and mass lock boolean across thresholds.
 */

import { describe, it, expect } from 'vitest';
import {
  compass,
  fuelCost,
  canJump,
  fuelAfterJump,
  cabinHeat,
  isMassLocked,
  FUEL_MAX_LY,
  MASS_LOCK_RADIUS,
} from '../src/sim/cockpit';
import type { Vec3 } from '../src/sim/vec';

describe('compass', () => {
  it('returns null when current or target is missing', () => {
    expect(compass(null, { x: 5, y: 5 })).toBeNull();
    expect(compass({ x: 0, y: 0 }, null)).toBeNull();
    expect(compass(null, null)).toBeNull();
  });

  it('returns null when target equals current', () => {
    expect(compass({ x: 7, y: 9 }, { x: 7, y: 9 })).toBeNull();
  });

  it('points east (0) when target is to the +X', () => {
    const a = compass({ x: 0, y: 0 }, { x: 10, y: 0 })!;
    expect(a).toBeCloseTo(0, 6);
  });

  it('points north (PI/2) when target is to the +Y', () => {
    const a = compass({ x: 0, y: 0 }, { x: 0, y: 10 })!;
    expect(a).toBeCloseTo(Math.PI / 2, 6);
  });

  it('points southwest (-3PI/4) for -X, -Y target', () => {
    const a = compass({ x: 5, y: 5 }, { x: 0, y: 0 })!;
    expect(a).toBeCloseTo(-3 * Math.PI / 4, 6);
  });
});

describe('fuel', () => {
  it('cost is the LY argument (clamped at zero)', () => {
    expect(fuelCost(4.2)).toBeCloseTo(4.2, 6);
    expect(fuelCost(0)).toBe(0);
    expect(fuelCost(-1)).toBe(0);
  });

  it('canJump is true when fuel >= cost', () => {
    expect(canJump(7, 7)).toBe(true);
    expect(canJump(7, 6.99)).toBe(true);
    expect(canJump(7, 7.01)).toBe(false);
  });

  it('canJump tolerates tiny float drift', () => {
    expect(canJump(5, 5 + 1e-12)).toBe(true);
  });

  it('fuelAfterJump deducts cost and never goes negative', () => {
    expect(fuelAfterJump(7, 4)).toBeCloseTo(3, 6);
    expect(fuelAfterJump(7, 7)).toBe(0);
    expect(fuelAfterJump(2, 5)).toBe(0);
  });

  it('fuelAfterJump caps at FUEL_MAX_LY', () => {
    expect(fuelAfterJump(FUEL_MAX_LY + 5, 0)).toBe(FUEL_MAX_LY);
  });
});

describe('cabinHeat', () => {
  const sun: Vec3 = [0, 0, 0];

  it('is 0 well outside the cool radius', () => {
    expect(cabinHeat([300, 0, 0], sun)).toBe(0);
    expect(cabinHeat([0, 0, 250], sun)).toBe(0);
  });

  it('is 1 at or inside the danger radius', () => {
    expect(cabinHeat([35, 0, 0], sun)).toBe(1);
    expect(cabinHeat([0, 10, 0], sun)).toBe(1);
    expect(cabinHeat(sun, sun)).toBe(1);
  });

  it('rises monotonically as the ship approaches', () => {
    const farH  = cabinHeat([180, 0, 0], sun);
    const midH  = cabinHeat([100, 0, 0], sun);
    const nearH = cabinHeat([50, 0, 0], sun);
    expect(midH).toBeGreaterThan(farH);
    expect(nearH).toBeGreaterThan(midH);
    expect(nearH).toBeLessThan(1);
  });

  it('is direction-agnostic (uses scalar distance)', () => {
    const a = cabinHeat([100, 0, 0], sun);
    const b = cabinHeat([0, 0, 100], sun);
    const c = cabinHeat([60, 80, 0], sun);  // 100
    expect(b).toBeCloseTo(a, 6);
    expect(c).toBeCloseTo(a, 6);
  });

  it('respects custom thresholds', () => {
    expect(cabinHeat([10, 0, 0], sun, 5, 50)).toBeCloseTo(1 - (10 - 5) / 45, 6);
  });
});

describe('isMassLocked', () => {
  it('is false when no bodies', () => {
    expect(isMassLocked([0, 0, 0], [])).toBe(false);
  });

  it('is true when within radius of any body', () => {
    const planet: Vec3 = [0, 0, 0];
    const sun: Vec3 = [500, 0, 0];
    expect(isMassLocked([10, 0, 0], [planet, sun])).toBe(true);
    expect(isMassLocked([490, 0, 0], [planet, sun])).toBe(true);    // close to sun
  });

  it('is false when outside radius of every body', () => {
    const planet: Vec3 = [0, 0, 0];
    const sun: Vec3 = [500, 0, 0];
    expect(isMassLocked([300, 0, 0], [planet, sun])).toBe(false);
  });

  it('boundary at exactly MASS_LOCK_RADIUS counts as locked', () => {
    expect(isMassLocked([MASS_LOCK_RADIUS, 0, 0], [[0, 0, 0]])).toBe(true);
  });

  it('just outside the radius is not locked', () => {
    expect(isMassLocked([MASS_LOCK_RADIUS + 0.01, 0, 0], [[0, 0, 0]])).toBe(false);
  });

  it('respects a custom radius', () => {
    expect(isMassLocked([20, 0, 0], [[0, 0, 0]], 10)).toBe(false);
    expect(isMassLocked([20, 0, 0], [[0, 0, 0]], 30)).toBe(true);
  });
});
