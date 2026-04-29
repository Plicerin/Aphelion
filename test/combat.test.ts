/**
 * Combat tests — laserTarget ray test, applyLaserDamage HP and death
 * trigger, advanceExplosions lifecycle.
 */

import { describe, it, expect } from 'vitest';
import {
  laserTarget,
  applyLaserDamage,
  advanceExplosions,
  LASER_RANGE,
  LASER_DPS,
  NPC_MAX_HP,
  NPC_HIT_RADIUS,
  EXPLOSION_DURATION,
} from '../src/sim/combat';
import type { NpcShip } from '../src/sim/npc';
import type { Vec3 } from '../src/sim/vec';

function npc(position: Vec3, overrides: Partial<NpcShip> = {}): NpcShip {
  return {
    shipId: 'wraith', role: 'pirate', position, yaw: 0,
    hp: NPC_MAX_HP, explodingT: 0,
    ...overrides,
  };
}

const origin: Vec3 = [0, 0, 0];
const forwardZ: Vec3 = [0, 0, 1];

describe('laserTarget', () => {
  it('returns null when no NPCs are in range', () => {
    expect(laserTarget(origin, forwardZ, [])).toBeNull();
  });

  it('hits an NPC directly in front', () => {
    const t = laserTarget(origin, forwardZ, [npc([0, 0, 30])]);
    expect(t).not.toBeNull();
    expect(t!.index).toBe(0);
    expect(t!.distance).toBeCloseTo(30, 5);
  });

  it('misses an NPC behind the ship', () => {
    expect(laserTarget(origin, forwardZ, [npc([0, 0, -30])])).toBeNull();
  });

  it('misses an NPC outside LASER_RANGE', () => {
    expect(laserTarget(origin, forwardZ, [npc([0, 0, LASER_RANGE + 5])])).toBeNull();
  });

  it('misses an NPC laterally outside the hit radius', () => {
    expect(laserTarget(origin, forwardZ, [npc([NPC_HIT_RADIUS + 1, 0, 30])])).toBeNull();
  });

  it('still hits when NPC is just inside the hit radius laterally', () => {
    const t = laserTarget(origin, forwardZ, [npc([NPC_HIT_RADIUS - 0.5, 0, 30])]);
    expect(t).not.toBeNull();
  });

  it('picks the nearest of multiple in-line NPCs', () => {
    const list = [
      npc([0, 0, 50]),
      npc([0, 0, 20]),  // closer
      npc([0, 0, 70]),
    ];
    const t = laserTarget(origin, forwardZ, list);
    expect(t!.index).toBe(1);
  });

  it('ignores already-exploding NPCs', () => {
    const list = [
      npc([0, 0, 20], { explodingT: 0.5 }),
      npc([0, 0, 40]),
    ];
    const t = laserTarget(origin, forwardZ, list);
    expect(t!.index).toBe(1);
  });

  it('ignores NPCs whose hp is already 0', () => {
    const list = [
      npc([0, 0, 20], { hp: 0 }),
      npc([0, 0, 40]),
    ];
    const t = laserTarget(origin, forwardZ, list);
    expect(t!.index).toBe(1);
  });
});

describe('applyLaserDamage', () => {
  it('reduces HP by dps * dt', () => {
    const list = [npc([0, 0, 30])];
    const next = applyLaserDamage(list, 0, LASER_DPS, 0.1);  // 8 hp removed
    expect(next[0].hp).toBeCloseTo(NPC_MAX_HP - LASER_DPS * 0.1, 5);
  });

  it('clamps HP at zero — does not go negative', () => {
    const list = [npc([0, 0, 30], { hp: 5 })];
    const next = applyLaserDamage(list, 0, LASER_DPS, 1.0);  // would remove 80
    expect(next[0].hp).toBe(0);
  });

  it('triggers explosion when HP reaches zero', () => {
    const list = [npc([0, 0, 30], { hp: 1 })];
    const next = applyLaserDamage(list, 0, LASER_DPS, 1.0);
    expect(next[0].hp).toBe(0);
    expect(next[0].explodingT).toBeGreaterThan(0);
  });

  it('is a no-op on already-exploding NPCs', () => {
    const list = [npc([0, 0, 30], { hp: 50, explodingT: 0.2 })];
    const next = applyLaserDamage(list, 0, LASER_DPS, 0.5);
    expect(next).toBe(list);
  });

  it('returns a new list (copy-on-write) so callers can compare references', () => {
    const list = [npc([0, 0, 30])];
    const next = applyLaserDamage(list, 0, LASER_DPS, 0.1);
    expect(next).not.toBe(list);
    expect(list[0].hp).toBe(NPC_MAX_HP);  // original unchanged
  });

  it('only mutates the targeted NPC; others pass through unchanged', () => {
    const a = npc([0, 0, 30]);
    const b = npc([0, 0, 50]);
    const next = applyLaserDamage([a, b], 0, LASER_DPS, 0.1);
    expect(next[0]).not.toBe(a);
    expect(next[1]).toBe(b);
  });
});

describe('advanceExplosions', () => {
  it('passes alive NPCs through unchanged', () => {
    const list = [npc([0, 0, 30]), npc([0, 0, 50], { role: 'trader' })];
    const next = advanceExplosions(list, 0.05);
    expect(next).toEqual(list);
  });

  it('advances explodingT for exploding NPCs', () => {
    const list = [npc([0, 0, 30], { explodingT: 0.1 })];
    const next = advanceExplosions(list, 0.05);
    expect(next[0].explodingT).toBeCloseTo(0.15, 5);
  });

  it('removes NPCs whose explosion has finished', () => {
    const list = [
      npc([0, 0, 30], { explodingT: EXPLOSION_DURATION - 0.001 }),
      npc([0, 0, 50]),
    ];
    const next = advanceExplosions(list, 0.05);
    expect(next.length).toBe(1);
    expect(next[0].position[2]).toBe(50);
  });

  it('keeps multiple in-flight explosions advancing in parallel', () => {
    const list = [
      npc([0, 0, 30], { explodingT: 0.1 }),
      npc([0, 0, 50], { explodingT: 0.4 }),
      npc([0, 0, 70]),
    ];
    const next = advanceExplosions(list, 0.05);
    expect(next.length).toBe(3);
    expect(next[0].explodingT).toBeCloseTo(0.15, 5);
    expect(next[1].explodingT).toBeCloseTo(0.45, 5);
    expect(next[2].explodingT).toBe(0);
  });
});
