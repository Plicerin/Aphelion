/**
 * NPC tests. Covers spawnNpcs (count, role distribution, determinism,
 * bounds) and stepNpc (pirate pursuit + trader flee).
 */

import { describe, it, expect } from 'vitest';
import { spawnNpcs, stepNpc, type NpcShip, type NpcStepCtx } from '../src/sim/npc';
import type { Government, System } from '../src/types';
import type { Vec3 } from '../src/sim/vec';

function makeSystem(
  seed: System['seed'],
  government: Government = 'democracy',
  economy: System['economy'] = 'mainly-industrial',
): System {
  return {
    index: 0, name: 'Test',
    x: 0, y: 0,
    economy, government,
    techLevel: 8, population: 1, productivity: 100, radius: 5000,
    seed,
  };
}

const SEEDS: ReadonlyArray<System['seed']> = [
  [0x0000, 0x0000, 0x0001],
  [0xffff, 0xffff, 0xfffe],
  [0x5a4a, 0x0248, 0xb753],
  [0xdead, 0xbeef, 0xcafe],
  [0x1234, 0x5678, 0x9abc],
];

describe('spawnNpcs', () => {
  it('returns 3..5 ships per system', () => {
    for (const seed of SEEDS) {
      const npcs = spawnNpcs(makeSystem(seed));
      expect(npcs.length).toBeGreaterThanOrEqual(3);
      expect(npcs.length).toBeLessThanOrEqual(5);
    }
  });

  it('every NPC is a Wraith for now (single-blueprint phase)', () => {
    for (const seed of SEEDS) {
      const npcs = spawnNpcs(makeSystem(seed));
      for (const n of npcs) expect(n.shipId).toBe('wraith');
    }
  });

  it('every NPC has a valid role', () => {
    const valid = new Set(['pirate', 'police', 'trader']);
    for (const seed of SEEDS) {
      const npcs = spawnNpcs(makeSystem(seed));
      for (const n of npcs) expect(valid.has(n.role)).toBe(true);
    }
  });

  it('is deterministic — same seed + government returns the same list', () => {
    for (const seed of SEEDS) {
      const a = spawnNpcs(makeSystem(seed, 'democracy'));
      const b = spawnNpcs(makeSystem(seed, 'democracy'));
      expect(a).toEqual(b);
    }
  });

  it('different seeds produce different positions', () => {
    const a = spawnNpcs(makeSystem([0x1111, 0x2222, 0x3333]));
    const b = spawnNpcs(makeSystem([0xaaaa, 0xbbbb, 0xcccc]));
    expect(a[0].position).not.toEqual(b[0].position);
  });

  it('positions stay within sane world bounds', () => {
    for (const seed of SEEDS) {
      for (const npc of spawnNpcs(makeSystem(seed))) {
        const [x, y, z] = npc.position;
        expect(x).toBeGreaterThan(-60);
        expect(x).toBeLessThan(60);
        expect(y).toBeGreaterThan(-25);
        expect(y).toBeLessThan(25);
        expect(z).toBeGreaterThan(20);
        expect(z).toBeLessThan(95);
      }
    }
  });

  it('yaw is in [0, 2π) for every NPC', () => {
    for (const seed of SEEDS) {
      for (const npc of spawnNpcs(makeSystem(seed))) {
        expect(npc.yaw).toBeGreaterThanOrEqual(0);
        expect(npc.yaw).toBeLessThan(Math.PI * 2);
      }
    }
  });

  it('anarchy systems skew heavily pirate', () => {
    let pirate = 0, total = 0;
    for (let s = 0; s < 64; s++) {
      const sys = makeSystem([s, s * 7, s * 13], 'anarchy');
      for (const n of spawnNpcs(sys)) {
        total++;
        if (n.role === 'pirate') pirate++;
      }
    }
    expect(pirate / total).toBeGreaterThan(0.55);
  });

  it('corporate-state systems skew police-heavy and pirate-light', () => {
    let pirate = 0, police = 0, total = 0;
    for (let s = 0; s < 64; s++) {
      const sys = makeSystem([s, s * 7, s * 13], 'corporate-state');
      for (const n of spawnNpcs(sys)) {
        total++;
        if (n.role === 'pirate') pirate++;
        if (n.role === 'police') police++;
      }
    }
    expect(pirate / total).toBeLessThan(0.15);
    expect(police / total).toBeGreaterThan(0.35);
  });
});

describe('stepNpc — pirate pursuit', () => {
  const playerOrigin: Vec3 = [0, 0, 0];
  const dt = 0.05;

  function pirate(position: Vec3, yaw = 0): NpcShip {
    return { shipId: 'wraith', role: 'pirate', position, yaw };
  }
  function trader(position: Vec3, yaw = 0): NpcShip {
    return { shipId: 'wraith', role: 'trader', position, yaw };
  }
  function police(position: Vec3, yaw = 0): NpcShip {
    return { shipId: 'wraith', role: 'police', position, yaw };
  }

  function ctx(npcs: NpcShip[], playerPos: Vec3 = playerOrigin): NpcStepCtx {
    return { playerPos, npcs };
  }

  it('police role is unchanged by stepNpc', () => {
    const p = police([10, 0, 30]);
    expect(stepNpc(p, ctx([p]), dt)).toBe(p);
  });

  it('a trader with no pirate nearby is unchanged', () => {
    const t = trader([10, 0, 30]);
    expect(stepNpc(t, ctx([t]), dt)).toBe(t);
  });

  it('a pirate behind the player turns toward the player over time', () => {
    let p = pirate([0, 0, 50], 0);
    const initialErr = Math.PI - p.yaw;
    for (let i = 0; i < 20; i++) p = stepNpc(p, ctx([p]), dt);
    const newErr = Math.PI - p.yaw;
    expect(Math.abs(newErr)).toBeLessThan(Math.abs(initialErr));
  });

  it('a pirate facing the player closes the distance', () => {
    let p = pirate([0, 0, 50], Math.PI);
    const z0 = p.position[2];
    for (let i = 0; i < 10; i++) p = stepNpc(p, ctx([p]), dt);
    expect(p.position[2]).toBeLessThan(z0);
  });

  it('a pirate stops closing once inside the stand-off radius', () => {
    const p = pirate([0, 0, 4], Math.PI);
    expect(stepNpc(p, ctx([p]), dt)).toBe(p);
  });

  it('yaw stays in [0, 2π) across many pursuit steps', () => {
    let p = pirate([20, 0, 30], 0);
    for (let i = 0; i < 100; i++) {
      p = stepNpc(p, ctx([p]), dt);
      expect(p.yaw).toBeGreaterThanOrEqual(0);
      expect(p.yaw).toBeLessThan(Math.PI * 2);
    }
  });

  it('pirate y-coordinate is preserved across pursuit (2D model)', () => {
    let p = pirate([10, 7, 40], 0);
    for (let i = 0; i < 30; i++) p = stepNpc(p, ctx([p]), dt);
    expect(p.position[1]).toBeCloseTo(7, 5);
  });
});

describe('stepNpc — trader flee', () => {
  const dt = 0.05;
  const playerOrigin: Vec3 = [0, 0, 0];

  function pirate(position: Vec3, yaw = 0): NpcShip {
    return { shipId: 'wraith', role: 'pirate', position, yaw };
  }
  function trader(position: Vec3, yaw = 0): NpcShip {
    return { shipId: 'wraith', role: 'trader', position, yaw };
  }
  function ctx(npcs: NpcShip[]): NpcStepCtx {
    return { playerPos: playerOrigin, npcs };
  }

  it('trader is unchanged when the only nearby pirate is beyond flee radius', () => {
    const t = trader([0, 0, 50]);
    const p = pirate([0, 0, 0]);    // ~50 units away — outside FLEE_RADIUS=30
    const next = stepNpc(t, ctx([t, p]), dt);
    expect(next).toBe(t);
  });

  it('trader moves AWAY from a pirate within flee radius', () => {
    // Pirate ahead (smaller z), trader at z=50. Fleeing means z increases.
    let t = trader([0, 0, 50], 0);
    const p = pirate([0, 0, 30]);   // 20 units ahead — inside flee radius
    const z0 = t.position[2];
    for (let i = 0; i < 30; i++) {
      t = stepNpc(t, ctx([t, p]), dt);
    }
    expect(t.position[2]).toBeGreaterThan(z0);
  });

  it('trader yaw turns to point away from the pirate', () => {
    // Pirate is at +z relative to trader; "away" bearing is -z, i.e. yaw≈π.
    let t = trader([0, 0, 0], 0);
    const p = pirate([0, 0, 20]);
    const initialErr = Math.PI - t.yaw;
    for (let i = 0; i < 30; i++) t = stepNpc(t, ctx([t, p]), dt);
    const newErr = Math.PI - t.yaw;
    expect(Math.abs(newErr)).toBeLessThan(Math.abs(initialErr));
  });

  it('trader flees from the CLOSEST pirate when multiple are in range', () => {
    // Two pirates inside flee radius. Closest is on the +x side (5 units),
    // far one is on the -x side (25 units). Trader at origin should turn
    // toward -x (away from closest), so x becomes negative.
    let t = trader([0, 0, 0], 0);
    const close = pirate([5, 0, 0]);
    const far   = pirate([-25, 0, 0]);
    for (let i = 0; i < 50; i++) {
      t = stepNpc(t, ctx([t, close, far]), dt);
    }
    expect(t.position[0]).toBeLessThan(0);
  });

  it('trader flee preserves y-coordinate (2D model)', () => {
    let t = trader([0, 9, 50], 0);
    const p = pirate([0, 9, 30]);
    for (let i = 0; i < 30; i++) t = stepNpc(t, ctx([t, p]), dt);
    expect(t.position[1]).toBeCloseTo(9, 5);
  });

  it('trader yaw stays in [0, 2π) across many flee steps', () => {
    let t = trader([0, 0, 0], 0);
    const p = pirate([10, 0, 5]);
    for (let i = 0; i < 100; i++) {
      t = stepNpc(t, ctx([t, p]), dt);
      expect(t.yaw).toBeGreaterThanOrEqual(0);
      expect(t.yaw).toBeLessThan(Math.PI * 2);
    }
  });

  it('trader ignores other traders even when very close', () => {
    const t1 = trader([0, 0, 50]);
    const t2 = trader([1, 0, 50]);
    expect(stepNpc(t1, ctx([t1, t2]), dt)).toBe(t1);
  });
});
