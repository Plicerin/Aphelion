/**
 * Planet biome tests. Pin determinism, polar caps, and the biome
 * shape contract.
 */

import { describe, it, expect } from 'vitest';
import { BIOMES, biomeAt, biomeInfoAt, biomePaletteForSeed, biomeHueShiftForSeed, type Biome } from '../src/sim/planetSurface';
import type { SeedTriple } from '../src/types';

const SEEDS: readonly SeedTriple[] = [
  [0x1234, 0x5678, 0x9abc],
  [0x5a4a, 0x0248, 0xb753],
  [0xdead, 0xbeef, 0xcafe],
  [0x0001, 0x0002, 0x0003],
  [0xffff, 0xffff, 0xfffe],
];

describe('BIOMES table', () => {
  const ALL: Biome[] = ['ice', 'forest', 'land', 'ocean', 'deepOcean'];

  it('every biome key is defined', () => {
    for (const k of ALL) expect(BIOMES[k]).toBeDefined();
  });

  it('every biome has a non-empty pool with paletteSize <= pool length', () => {
    for (const k of ALL) {
      expect(BIOMES[k].pool.length).toBeGreaterThan(0);
      expect(BIOMES[k].paletteSize).toBeGreaterThan(0);
      expect(BIOMES[k].paletteSize).toBeLessThanOrEqual(BIOMES[k].pool.length);
      for (const g of BIOMES[k].pool) {
        expect(typeof g).toBe('string');
        expect(g.length).toBeGreaterThan(0);
      }
    }
  });

  it('brightness is in (0, 1] and ordered ice > land > ocean > deepOcean', () => {
    for (const k of ALL) {
      expect(BIOMES[k].brightness).toBeGreaterThan(0);
      expect(BIOMES[k].brightness).toBeLessThanOrEqual(1);
    }
    expect(BIOMES.ice.brightness).toBeGreaterThan(BIOMES.land.brightness);
    expect(BIOMES.land.brightness).toBeGreaterThan(BIOMES.ocean.brightness);
    expect(BIOMES.ocean.brightness).toBeGreaterThan(BIOMES.deepOcean.brightness);
  });

  it('exactly the ocean biomes are marked isWater', () => {
    expect(BIOMES.ocean.isWater).toBe(true);
    expect(BIOMES.deepOcean.isWater).toBe(true);
    expect(BIOMES.land.isWater).toBe(false);
    expect(BIOMES.forest.isWater).toBe(false);
    expect(BIOMES.ice.isWater).toBe(false);
  });
});

describe('biomeAt', () => {
  it('is deterministic — same inputs return the same biome', () => {
    for (const seed of SEEDS) {
      const a = biomeAt(seed, 0.3, 1.2);
      const b = biomeAt(seed, 0.3, 1.2);
      expect(a).toBe(b);
    }
  });

  it('polar regions are always ice', () => {
    for (const seed of SEEDS) {
      expect(biomeAt(seed, +1.4, 0.0)).toBe('ice');
      expect(biomeAt(seed, -1.4, 0.0)).toBe('ice');
      expect(biomeAt(seed, +1.5, 3.0)).toBe('ice');
    }
  });

  it('non-polar regions hit at least three different biomes across a sample sweep', () => {
    // Sweep many (lat, lon) points for a single seed; the biome
    // distribution should land on at least three different biomes —
    // otherwise the planet would look uniform.
    const seed = SEEDS[0];
    const seen = new Set<Biome>();
    for (let i = 0; i < 64; i++) {
      const lat = ((i % 8) / 7 - 0.5) * 2;          // -1..+1 (avoid polar ice)
      const lon = (i / 64) * Math.PI * 2;
      seen.add(biomeAt(seed, lat, lon));
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  it('different seeds produce visibly different biome distributions', () => {
    // Sample the same lat/lon grid for two different seeds; if the
    // biome at every point matches, the seed isn't actually mixing in.
    const grid: Array<[number, number]> = [];
    for (let i = 0; i < 36; i++) {
      grid.push([((i % 6) / 5 - 0.5) * 2, ((i / 36)) * Math.PI * 2]);
    }
    const a = grid.map(([lat, lon]) => biomeAt([0x0001, 0x0002, 0x0003], lat, lon));
    const b = grid.map(([lat, lon]) => biomeAt([0xffff, 0xfffe, 0xfffd], lat, lon));
    let differences = 0;
    for (let i = 0; i < grid.length; i++) if (a[i] !== b[i]) differences++;
    expect(differences).toBeGreaterThan(grid.length * 0.2);
  });

  it('handles longitude wrap-around: lon and lon+2π give the same biome', () => {
    for (const seed of SEEDS) {
      const a = biomeAt(seed, 0.4, 1.0);
      const b = biomeAt(seed, 0.4, 1.0 + Math.PI * 2);
      expect(a).toBe(b);
    }
  });
});

describe('biomeInfoAt', () => {
  it('returns the BIOMES entry for the resolved biome', () => {
    const info = biomeInfoAt([0x1234, 0x5678, 0x9abc], 0.0, 0.0);
    // Must be the same object as BIOMES[<that biome>].
    expect(Object.values(BIOMES)).toContain(info);
  });
});

describe('biomePaletteForSeed', () => {
  const ALL: Biome[] = ['ice', 'forest', 'land', 'ocean', 'deepOcean'];

  it('is deterministic — same (seed, biome) returns the same palette', () => {
    for (const seed of SEEDS) {
      for (const k of ALL) {
        const a = biomePaletteForSeed(seed, k);
        const b = biomePaletteForSeed(seed, k);
        expect(a).toEqual(b);
      }
    }
  });

  it('palette length matches BIOMES[biome].paletteSize', () => {
    for (const seed of SEEDS) {
      for (const k of ALL) {
        expect(biomePaletteForSeed(seed, k).length).toBe(BIOMES[k].paletteSize);
      }
    }
  });

  it('every glyph in the palette comes from the biome pool', () => {
    for (const seed of SEEDS) {
      for (const k of ALL) {
        const palette = biomePaletteForSeed(seed, k);
        for (const g of palette) expect(BIOMES[k].pool).toContain(g);
      }
    }
  });

  it('different seeds yield different palettes for at least one biome', () => {
    // Sanity check that the seed actually mixes in. With five biomes
    // and meaningfully different seeds, at least one biome's palette
    // should differ — otherwise the seed isn't reaching the shuffle.
    const a = ALL.map(k => biomePaletteForSeed([0x0001, 0x0002, 0x0003], k).join(''));
    const b = ALL.map(k => biomePaletteForSeed([0xffff, 0xfffe, 0xfffd], k).join(''));
    let differences = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) differences++;
    expect(differences).toBeGreaterThan(0);
  });
});

describe('biomeHueShiftForSeed', () => {
  const ALL: Biome[] = ['ice', 'forest', 'land', 'ocean', 'deepOcean'];

  it('is deterministic', () => {
    for (const seed of SEEDS) {
      for (const k of ALL) {
        const a = biomeHueShiftForSeed(seed, k);
        const b = biomeHueShiftForSeed(seed, k);
        expect(a).toBe(b);
      }
    }
  });

  it('always within ±hueShiftRange', () => {
    for (const seed of SEEDS) {
      for (const k of ALL) {
        const shift = biomeHueShiftForSeed(seed, k);
        const range = BIOMES[k].hueShiftRange;
        expect(shift).toBeGreaterThanOrEqual(-range);
        expect(shift).toBeLessThanOrEqual(range);
      }
    }
  });

  it('different seeds produce different shifts somewhere across biomes', () => {
    const a = ALL.map(k => biomeHueShiftForSeed([0x0001, 0x0002, 0x0003], k));
    const b = ALL.map(k => biomeHueShiftForSeed([0xffff, 0xfffe, 0xfffd], k));
    let differences = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) differences++;
    expect(differences).toBeGreaterThan(0);
  });
});
