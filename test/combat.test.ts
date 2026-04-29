/**
 * Combat tests — laserTarget ray test, applyLaserDamage HP and death
 * trigger, advanceExplosions lifecycle.
 */

import { describe, it, expect } from 'vitest';
import {
  laserTarget,
  applyLaserDamage,
  advanceExplosions,
  pirateIsFiring,
  npcIsFiringOnPlayer,
  applyHostileFire,
  rankForKills,
  LASER_RANGE,
  LASER_DPS,
  NPC_MAX_HP,
  NPC_HIT_RADIUS,
  EXPLOSION_DURATION,
  NPC_LASER_RANGE,
  NPC_PIRATE_DPS,
  PLAYER_MAX_HP,
  COMBAT_RANK_NAMES,
  COMBAT_RANK_THRESHOLDS,
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

describe('pirateIsFiring', () => {
  const playerOrigin: Vec3 = [0, 0, 0];

  it('returns false for non-pirate roles', () => {
    const trader = npc([0, 0, 30], { role: 'trader', yaw: Math.PI });
    const police = npc([0, 0, 30], { role: 'police', yaw: Math.PI });
    expect(pirateIsFiring(trader, playerOrigin)).toBe(false);
    expect(pirateIsFiring(police, playerOrigin)).toBe(false);
  });

  it('returns false when pirate is exploding', () => {
    const dying = npc([0, 0, 20], { yaw: Math.PI, explodingT: 0.3 });
    expect(pirateIsFiring(dying, playerOrigin)).toBe(false);
  });

  it('returns false when pirate is out of NPC_LASER_RANGE', () => {
    // Pointing at player but far away. Pirate at z=80 facing -z (yaw=π) → toward origin.
    const far = npc([0, 0, NPC_LASER_RANGE + 5], { yaw: Math.PI });
    expect(pirateIsFiring(far, playerOrigin)).toBe(false);
  });

  it('returns false when pirate is not facing the player', () => {
    // Pirate at z=20 but facing AWAY from the player (yaw=0 = +z).
    const wrongWay = npc([0, 0, 20], { yaw: 0 });
    expect(pirateIsFiring(wrongWay, playerOrigin)).toBe(false);
  });

  it('returns true when pirate is in range and facing the player', () => {
    // Pirate at z=20, facing -z (yaw=π) → pointing at origin.
    const onTarget = npc([0, 0, 20], { yaw: Math.PI });
    expect(pirateIsFiring(onTarget, playerOrigin)).toBe(true);
  });
});

describe('npcIsFiringOnPlayer', () => {
  const playerOrigin: Vec3 = [0, 0, 0];

  it('a pirate fires whenever in range + on target, regardless of wanted', () => {
    const p = npc([0, 0, 20], { yaw: Math.PI });
    expect(npcIsFiringOnPlayer(p, playerOrigin, false)).toBe(true);
    expect(npcIsFiringOnPlayer(p, playerOrigin, true)).toBe(true);
  });

  it('police only fire when the player is wanted', () => {
    const cop = npc([0, 0, 20], { role: 'police', yaw: Math.PI });
    expect(npcIsFiringOnPlayer(cop, playerOrigin, false)).toBe(false);
    expect(npcIsFiringOnPlayer(cop, playerOrigin, true)).toBe(true);
  });

  it('traders never fire even when wanted', () => {
    const t = npc([0, 0, 20], { role: 'trader', yaw: Math.PI });
    expect(npcIsFiringOnPlayer(t, playerOrigin, true)).toBe(false);
  });
});

describe('applyHostileFire', () => {
  const playerOrigin: Vec3 = [0, 0, 0];
  const dt = 0.1;

  it('returns hp unchanged when nothing is firing', () => {
    const trader = npc([0, 0, 20], { role: 'trader', yaw: Math.PI });
    const newHp = applyHostileFire(PLAYER_MAX_HP, [trader], playerOrigin, true, dt);
    expect(newHp).toBe(PLAYER_MAX_HP);
  });

  it('drains hp by NPC_PIRATE_DPS * dt for one firing pirate', () => {
    const onTarget = npc([0, 0, 20], { yaw: Math.PI });
    const newHp = applyHostileFire(PLAYER_MAX_HP, [onTarget], playerOrigin, false, dt);
    expect(newHp).toBeCloseTo(PLAYER_MAX_HP - NPC_PIRATE_DPS * dt, 5);
  });

  it('stacks damage across multiple firing shooters', () => {
    const a = npc([0, 0, 20], { yaw: Math.PI });
    const b = npc([1, 0, 20], { yaw: Math.PI });
    const newHp = applyHostileFire(PLAYER_MAX_HP, [a, b], playerOrigin, false, dt);
    expect(newHp).toBeCloseTo(PLAYER_MAX_HP - 2 * NPC_PIRATE_DPS * dt, 5);
  });

  it('police contribute DPS only when the player is wanted', () => {
    const cop = npc([0, 0, 20], { role: 'police', yaw: Math.PI });
    const peace = applyHostileFire(PLAYER_MAX_HP, [cop], playerOrigin, false, dt);
    const wanted = applyHostileFire(PLAYER_MAX_HP, [cop], playerOrigin, true, dt);
    expect(peace).toBe(PLAYER_MAX_HP);
    expect(wanted).toBeCloseTo(PLAYER_MAX_HP - NPC_PIRATE_DPS * dt, 5);
  });

  it('clamps player hp at zero — does not go negative', () => {
    const onTarget = npc([0, 0, 20], { yaw: Math.PI });
    const newHp = applyHostileFire(1, [onTarget], playerOrigin, false, 1.0);
    expect(newHp).toBe(0);
  });

  it('returns 0 unchanged when player is already at 0 hp', () => {
    const onTarget = npc([0, 0, 20], { yaw: Math.PI });
    const newHp = applyHostileFire(0, [onTarget], playerOrigin, false, dt);
    expect(newHp).toBe(0);
  });
});

describe('rankForKills', () => {
  it('rank 0 (Harmless) for zero kills', () => {
    expect(rankForKills(0)).toBe(0);
    expect(COMBAT_RANK_NAMES[rankForKills(0)]).toBe('Harmless');
  });

  it('clamps negatives and non-finite to rank 0', () => {
    expect(rankForKills(-5)).toBe(0);
    expect(rankForKills(NaN)).toBe(0);
    expect(rankForKills(-Infinity)).toBe(0);
  });

  it('top rank (Elite) at the highest threshold', () => {
    const last = COMBAT_RANK_THRESHOLDS.length - 1;
    expect(rankForKills(COMBAT_RANK_THRESHOLDS[last])).toBe(last);
    expect(rankForKills(COMBAT_RANK_THRESHOLDS[last] + 1000)).toBe(last);
  });

  it('every threshold lands the player on the matching rank', () => {
    for (let i = 0; i < COMBAT_RANK_THRESHOLDS.length; i++) {
      expect(rankForKills(COMBAT_RANK_THRESHOLDS[i])).toBe(i);
    }
  });

  it('one kill below a threshold stays on the previous rank', () => {
    for (let i = 1; i < COMBAT_RANK_THRESHOLDS.length; i++) {
      expect(rankForKills(COMBAT_RANK_THRESHOLDS[i] - 1)).toBe(i - 1);
    }
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
