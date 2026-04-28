/**
 * Aphelion — galaxy generator tests
 *
 * Run with: npx vitest run
 *
 * These tests pin down the properties that matter for gameplay:
 *   - Determinism: same seed always produces the same galaxy.
 *   - Coverage: systems spread across the chart, no clumping at origin.
 *   - Uniqueness: no duplicate names within a galaxy (or very few).
 *   - Galaxy rotation: 8 rotations returns to galaxy 0.
 *   - System extraction is a pure function of the seed.
 */

import { describe, it, expect } from 'vitest';
import {
  defaultGalaxy,
  generateAllGalaxies,
  generateGalaxy,
} from '../src/galaxy/generator';
import {
  APHELION_SEED,
  rotateGalaxy,
  twistN,
  twistOnce,
} from '../src/galaxy/twist';
import { nameFromSeed } from '../src/galaxy/names';

describe('twist', () => {
  it('is deterministic', () => {
    const a = twistOnce([0x1234, 0x5678, 0x9abc]);
    const b = twistOnce([0x1234, 0x5678, 0x9abc]);
    expect(a).toEqual(b);
  });

  it('shifts the triple along, not in place', () => {
    const [s0, s1, s2] = [0x0001, 0x0002, 0x0004];
    const next = twistOnce([s0, s1, s2]);
    // The new triple should be [s1, s2, s0+s1+s2]
    expect(next[0]).toBe(s1);
    expect(next[1]).toBe(s2);
    expect(next[2]).toBe(s0 + s1 + s2);
  });

  it('truncates the new seed to 16 bits', () => {
    const next = twistOnce([0xffff, 0xffff, 0xffff]);
    expect(next[2]).toBeLessThanOrEqual(0xffff);
    expect(next[2]).toBeGreaterThanOrEqual(0);
  });

  it('twistN matches N successive twistOnce calls', () => {
    let manual = APHELION_SEED;
    for (let i = 0; i < 17; i++) manual = twistOnce(manual);
    const bulk = twistN(APHELION_SEED, 17);
    expect(bulk).toEqual(manual);
  });
});

describe('galaxy rotation', () => {
  it('returns to the original seed after 8 rotations', () => {
    let seed = APHELION_SEED;
    for (let i = 0; i < 8; i++) seed = rotateGalaxy(seed);
    expect(seed).toEqual(APHELION_SEED);
  });

  it('produces 8 distinct seeds in the cycle', () => {
    const seen = new Set<string>();
    let seed = APHELION_SEED;
    for (let i = 0; i < 8; i++) {
      seen.add(seed.join(','));
      seed = rotateGalaxy(seed);
    }
    expect(seen.size).toBe(8);
  });
});

describe('generateGalaxy', () => {
  const galaxy = defaultGalaxy();

  it('contains exactly 256 systems', () => {
    expect(galaxy.systems).toHaveLength(256);
  });

  it('is deterministic — same seed, same galaxy', () => {
    const a = generateGalaxy(APHELION_SEED);
    const b = generateGalaxy(APHELION_SEED);
    expect(a.systems.map((s) => s.name)).toEqual(b.systems.map((s) => s.name));
  });

  it('spreads systems across the chart (not all clumped at origin)', () => {
    const xs = galaxy.systems.map((s) => s.x);
    const ys = galaxy.systems.map((s) => s.y);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    // Expect to occupy at least 80% of the chart in both dimensions.
    expect(xMax - xMin).toBeGreaterThan(200);
    expect(yMax - yMin).toBeGreaterThan(100);
  });

  it('produces mostly unique names (>= 240 of 256)', () => {
    // Some duplication is fine and even charming — Elite famously had a few.
    const unique = new Set(galaxy.systems.map((s) => s.name));
    expect(unique.size).toBeGreaterThanOrEqual(240);
  });

  it('names are 3..10 characters and look plausible', () => {
    for (const sys of galaxy.systems) {
      expect(sys.name.length).toBeGreaterThanOrEqual(3);
      expect(sys.name.length).toBeLessThanOrEqual(10);
      expect(sys.name).toMatch(/^[A-Z][a-z]+$/);
    }
  });

  it('all property fields are within their declared ranges', () => {
    for (const sys of galaxy.systems) {
      expect(sys.x).toBeGreaterThanOrEqual(0);
      expect(sys.x).toBeLessThanOrEqual(255);
      expect(sys.y).toBeGreaterThanOrEqual(0);
      expect(sys.y).toBeLessThanOrEqual(127);
      expect(sys.techLevel).toBeGreaterThanOrEqual(1);
      expect(sys.techLevel).toBeLessThanOrEqual(15);
      expect(sys.population).toBeGreaterThan(0);
      expect(sys.productivity).toBeGreaterThan(0);
    }
  });

  it('regional flavor: high-y systems lean agricultural', () => {
    const northBand = galaxy.systems.filter((s) => s.y > 96);
    const agriCount = northBand.filter((s) =>
      s.economy.includes('agricultural'),
    ).length;
    // At least 60% of high-y systems should be agricultural by design.
    expect(agriCount / northBand.length).toBeGreaterThan(0.6);
  });
});

describe('generateAllGalaxies', () => {
  it('produces 8 galaxies', () => {
    expect(generateAllGalaxies()).toHaveLength(8);
  });

  it('each galaxy has different system names', () => {
    const galaxies = generateAllGalaxies();
    // Compare galaxy 0 and galaxy 1: should differ in most systems.
    const names0 = galaxies[0].systems.map((s) => s.name);
    const names1 = galaxies[1].systems.map((s) => s.name);
    const sameCount = names0.filter((n, i) => n === names1[i]).length;
    expect(sameCount).toBeLessThan(40); // overwhelmingly different
  });
});

describe('name generation', () => {
  it('is deterministic from seed', () => {
    expect(nameFromSeed([0x1234, 0x5678, 0x9abc])).toBe(
      nameFromSeed([0x1234, 0x5678, 0x9abc]),
    );
  });

  it('produces names of varying lengths', () => {
    const lengths = new Set<number>();
    let seed = APHELION_SEED;
    for (let i = 0; i < 100; i++) {
      seed = twistOnce(seed);
      lengths.add(nameFromSeed(seed).length);
    }
    // Should see at least 3 different lengths in 100 samples.
    expect(lengths.size).toBeGreaterThanOrEqual(3);
  });
});
