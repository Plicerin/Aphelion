/**
 * Trade anchor tests.
 *
 * Properties that matter:
 *   - Placement is deterministic from a (planet, seed) pair.
 *   - Placement stays within the documented offset range from the planet.
 *   - Elevation off the orbital plane is bounded so anchors aren't stacked
 *     above/below the planet where they'd be hard to find from the cockpit.
 *   - Different seeds produce visibly different positions.
 *   - Range stages classify correctly across boundaries with no gaps.
 *   - Within-stage `t` advances monotonically as the ship approaches.
 *   - Edge cases: ship on anchor, exactly at a boundary.
 */

import { describe, it, expect } from 'vitest';
import {
  placeAnchor,
  anchorStage,
  ANCHOR_RANGE_FAR,
  ANCHOR_RANGE_MEDIUM,
  ANCHOR_RANGE_CLOSE,
} from '../src/sim/anchor';
import type { SeedTriple } from '../src/types';
import type { Vec3 } from '../src/sim/vec';

const planet: Vec3 = [10, -3, 60];

const SEEDS: readonly SeedTriple[] = [
  [0x0000, 0x0000, 0x0001],
  [0xffff, 0xffff, 0xfffe],
  [0x1234, 0x5678, 0x9abc],
  [0x5a4a, 0x0248, 0xb753], // canonical APHELION_SEED
  [0xdead, 0xbeef, 0xcafe],
];

describe('placeAnchor', () => {
  it('is deterministic for a given planet + seed', () => {
    const seed: SeedTriple = [0x1234, 0x5678, 0x9abc];
    const a = placeAnchor(planet, seed);
    const b = placeAnchor(planet, seed);
    expect(a.position).toEqual(b.position);
  });

  it('places the anchor 8..14 units from the planet', () => {
    for (const seed of SEEDS) {
      const a = placeAnchor(planet, seed);
      const dx = a.position[0] - planet[0];
      const dy = a.position[1] - planet[1];
      const dz = a.position[2] - planet[2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      expect(d).toBeGreaterThanOrEqual(8 - 1e-6);
      expect(d).toBeLessThanOrEqual(14 + 1e-6);
    }
  });

  it('keeps the anchor within ±0.3 rad of the orbital plane', () => {
    for (const seed of SEEDS) {
      const a = placeAnchor(planet, seed);
      const dy = a.position[1] - planet[1];
      const dx = a.position[0] - planet[0];
      const dz = a.position[2] - planet[2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const elevation = Math.asin(dy / d);
      expect(Math.abs(elevation)).toBeLessThanOrEqual(0.3 + 1e-6);
    }
  });

  it('different seeds produce different positions', () => {
    const a = placeAnchor(planet, [0x0001, 0x0002, 0x0003]);
    const b = placeAnchor(planet, [0xffff, 0xfffe, 0xfffd]);
    expect(a.position).not.toEqual(b.position);
  });
});

describe('anchorStage', () => {
  const anchor: Vec3 = [0, 0, 0];

  it("returns 'silent' beyond ANCHOR_RANGE_FAR", () => {
    const r = anchorStage([0, 0, ANCHOR_RANGE_FAR + 5], anchor);
    expect(r.stage).toBe('silent');
    expect(r.t).toBe(0);
  });

  it("treats exactly ANCHOR_RANGE_FAR as silent (boundary inclusive on the far side)", () => {
    const r = anchorStage([0, 0, ANCHOR_RANGE_FAR], anchor);
    expect(r.stage).toBe('silent');
  });

  it("transitions to 'far' just inside ANCHOR_RANGE_FAR", () => {
    const r = anchorStage([0, 0, ANCHOR_RANGE_FAR - 0.001], anchor);
    expect(r.stage).toBe('far');
    expect(r.t).toBeGreaterThanOrEqual(0);
    expect(r.t).toBeLessThanOrEqual(0.01);
  });

  it("returns 'medium' between CLOSE and MEDIUM", () => {
    const mid = (ANCHOR_RANGE_MEDIUM + ANCHOR_RANGE_CLOSE) / 2;
    const r = anchorStage([0, 0, mid], anchor);
    expect(r.stage).toBe('medium');
    expect(r.t).toBeGreaterThan(0);
    expect(r.t).toBeLessThan(1);
  });

  it("returns 'close' inside ANCHOR_RANGE_CLOSE", () => {
    const r = anchorStage([0, 0, ANCHOR_RANGE_CLOSE - 0.5], anchor);
    expect(r.stage).toBe('close');
  });

  it('t advances monotonically toward the inner edge of a stage', () => {
    const farEdge = anchorStage([0, 0, ANCHOR_RANGE_FAR - 0.001], anchor).t;
    const farMid = anchorStage([0, 0, (ANCHOR_RANGE_FAR + ANCHOR_RANGE_MEDIUM) / 2], anchor).t;
    const farNear = anchorStage([0, 0, ANCHOR_RANGE_MEDIUM + 0.001], anchor).t;
    expect(farMid).toBeGreaterThan(farEdge);
    expect(farNear).toBeGreaterThan(farMid);
    expect(farNear).toBeLessThanOrEqual(1);
  });

  it('reports correct distance', () => {
    const r = anchorStage([3, 4, 0], [0, 0, 0]);
    expect(r.distance).toBeCloseTo(5, 6);
  });

  it('handles the ship sitting exactly on the anchor', () => {
    const r = anchorStage([0, 0, 0], [0, 0, 0]);
    expect(r.stage).toBe('close');
    expect(r.distance).toBe(0);
    expect(r.t).toBe(1);
  });

  it('classification is consistent across all three axes', () => {
    // Distance is direction-agnostic; verify the stage purely by magnitude.
    const d = (ANCHOR_RANGE_MEDIUM + ANCHOR_RANGE_CLOSE) / 2;
    const fromX = anchorStage([d, 0, 0], anchor);
    const fromY = anchorStage([0, d, 0], anchor);
    const fromZ = anchorStage([0, 0, d], anchor);
    const negZ = anchorStage([0, 0, -d], anchor);
    expect(fromX.stage).toBe('medium');
    expect(fromY.stage).toBe('medium');
    expect(fromZ.stage).toBe('medium');
    expect(negZ.stage).toBe('medium');
    expect(fromX.distance).toBeCloseTo(d, 6);
    expect(negZ.distance).toBeCloseTo(d, 6);
  });
});
