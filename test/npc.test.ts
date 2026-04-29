/**
 * NPC spawn tests. Phase 1 — one Wraith per system, deterministic from
 * the seed.
 */

import { describe, it, expect } from 'vitest';
import { spawnNpcs } from '../src/sim/npc';
import type { System } from '../src/types';

function makeSystem(seed: System['seed'], econ: System['economy'] = 'mainly-industrial'): System {
  return {
    index: 0, name: 'Test',
    x: 0, y: 0,
    economy: econ, government: 'democracy',
    techLevel: 8, population: 1, productivity: 100, radius: 5000,
    seed,
  };
}

describe('spawnNpcs', () => {
  it('returns at least one ship per system', () => {
    const npcs = spawnNpcs(makeSystem([0x1234, 0x5678, 0x9abc]));
    expect(npcs.length).toBeGreaterThan(0);
  });

  it('phase-1 NPC is a Wraith', () => {
    const npcs = spawnNpcs(makeSystem([0x1234, 0x5678, 0x9abc]));
    expect(npcs[0].shipId).toBe('wraith');
  });

  it('is deterministic for the same seed', () => {
    const a = spawnNpcs(makeSystem([0x5a4a, 0x0248, 0xb753]));
    const b = spawnNpcs(makeSystem([0x5a4a, 0x0248, 0xb753]));
    expect(a).toEqual(b);
  });

  it('different seeds produce different positions', () => {
    const a = spawnNpcs(makeSystem([0x1111, 0x2222, 0x3333]));
    const b = spawnNpcs(makeSystem([0xaaaa, 0xbbbb, 0xcccc]));
    expect(a[0].position).not.toEqual(b[0].position);
  });

  it('different seeds produce different yaws', () => {
    const a = spawnNpcs(makeSystem([0x0000, 0x0000, 0x0001]));
    const b = spawnNpcs(makeSystem([0xffff, 0x0000, 0x0001]));
    expect(a[0].yaw).not.toBe(b[0].yaw);
  });

  it('positions stay within sane world bounds', () => {
    // Sweep a few seeds to make sure no spawn point lands behind the
    // player or unreasonably far.
    const seeds: System['seed'][] = [
      [0x0000, 0x0000, 0x0001],
      [0xffff, 0xffff, 0xfffe],
      [0x5a4a, 0x0248, 0xb753],
      [0xdead, 0xbeef, 0xcafe],
      [0x1234, 0x5678, 0x9abc],
    ];
    for (const seed of seeds) {
      const [x, y, z] = spawnNpcs(makeSystem(seed))[0].position;
      expect(x).toBeGreaterThan(-60);
      expect(x).toBeLessThan(60);
      expect(y).toBeGreaterThan(-25);
      expect(y).toBeLessThan(25);
      expect(z).toBeGreaterThan(20);
      expect(z).toBeLessThan(95);     // always in front of player
    }
  });

  it('yaw is in [0, 2π)', () => {
    const seeds: System['seed'][] = [
      [0x0000, 0x0000, 0x0001],
      [0xffff, 0xffff, 0xfffe],
      [0x5a4a, 0x0248, 0xb753],
    ];
    for (const seed of seeds) {
      const yaw = spawnNpcs(makeSystem(seed))[0].yaw;
      expect(yaw).toBeGreaterThanOrEqual(0);
      expect(yaw).toBeLessThan(Math.PI * 2);
    }
  });
});
