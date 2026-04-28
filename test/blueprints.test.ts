/**
 * Ship blueprint tests. Validates the data shape, edge index integrity,
 * and per-ship sanity. The renderer wires up in v0.2; tests pin the
 * data so we don't ship blueprints with broken edge indices.
 */

import { describe, it, expect } from 'vitest';
import { SHIPS, findShip, type ShipBlueprint, type ShipRole } from '../src/sim/blueprints';

const VALID_ROLES: readonly ShipRole[] = ['trader', 'fighter', 'pirate', 'police', 'freighter'];

describe('SHIPS', () => {
  it('contains 5 entries', () => {
    expect(SHIPS.length).toBe(5);
  });

  it('every ship has a unique id', () => {
    const ids = SHIPS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every role is one of the known types', () => {
    for (const s of SHIPS) {
      expect(VALID_ROLES).toContain(s.role);
    }
  });

  it('every ship has the player Cobra Mk III as the trader', () => {
    const cobra = SHIPS.find(s => s.id === 'cobra3');
    expect(cobra).toBeDefined();
    expect(cobra!.role).toBe('trader');
  });

  it('roster covers all five ship roles', () => {
    const roles = new Set(SHIPS.map(s => s.role));
    for (const r of VALID_ROLES) expect(roles.has(r)).toBe(true);
  });

  it('per-ship stats are positive', () => {
    for (const s of SHIPS) {
      expect(s.defaultScale).toBeGreaterThan(0);
      expect(s.maxHull).toBeGreaterThan(0);
      expect(s.maxSpeed).toBeGreaterThan(0);
      expect(s.cargoCapacity).toBeGreaterThanOrEqual(0);
    }
  });

  it('fighters and police are faster than freighters', () => {
    const freighter = SHIPS.find(s => s.role === 'freighter')!;
    const fighter   = SHIPS.find(s => s.role === 'fighter')!;
    const police    = SHIPS.find(s => s.role === 'police')!;
    expect(fighter.maxSpeed).toBeGreaterThan(freighter.maxSpeed);
    expect(police.maxSpeed).toBeGreaterThan(freighter.maxSpeed);
  });

  it('freighters have more hull and cargo than fighters', () => {
    const freighter = SHIPS.find(s => s.role === 'freighter')!;
    const fighter   = SHIPS.find(s => s.role === 'fighter')!;
    expect(freighter.maxHull).toBeGreaterThan(fighter.maxHull);
    expect(freighter.cargoCapacity).toBeGreaterThan(fighter.cargoCapacity);
  });
});

describe('blueprint geometry', () => {
  function check(s: ShipBlueprint) {
    // Vertex array non-empty; each vertex is [x, y, z].
    expect(s.vertices.length).toBeGreaterThan(0);
    for (const v of s.vertices) {
      expect(v.length).toBe(3);
      for (const k of v) {
        expect(typeof k).toBe('number');
        expect(Number.isFinite(k)).toBe(true);
      }
    }
    // Edges reference valid vertex and face indices.
    expect(s.edges.length).toBeGreaterThan(0);
    for (const [v1, v2, f1, f2] of s.edges) {
      expect(v1).toBeGreaterThanOrEqual(0);
      expect(v1).toBeLessThan(s.vertices.length);
      expect(v2).toBeGreaterThanOrEqual(0);
      expect(v2).toBeLessThan(s.vertices.length);
      expect(v1).not.toBe(v2);
      // Face indices: -1 means "no adjoining face on that side".
      if (f1 !== -1) expect(f1).toBeLessThan(s.faces.length);
      if (f2 !== -1) expect(f2).toBeLessThan(s.faces.length);
    }
    // Faces non-empty; each is a non-zero normal vector.
    expect(s.faces.length).toBeGreaterThan(0);
    for (const n of s.faces) {
      expect(n.length).toBe(3);
      const mag = Math.hypot(n[0], n[1], n[2]);
      expect(mag).toBeGreaterThan(0);
    }
  }

  for (const s of SHIPS) {
    it(`${s.name} has valid geometry`, () => check(s));
  }

  it('Cobra Mk III matches the published 28/38/13 layout', () => {
    const cobra = SHIPS.find(s => s.id === 'cobra3')!;
    expect(cobra.vertices.length).toBe(28);
    expect(cobra.edges.length).toBe(37);
    expect(cobra.faces.length).toBe(13);
  });
});

describe('findShip', () => {
  it('returns the matching blueprint by id', () => {
    expect(findShip('cobra3')!.name).toBe('Cobra Mk III');
    expect(findShip('shrike')!.role).toBe('fighter');
  });

  it('returns undefined for unknown ids', () => {
    expect(findShip('not-a-ship')).toBeUndefined();
  });
});
