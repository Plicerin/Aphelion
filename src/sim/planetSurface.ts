/**
 * Aphelion — planet surface biomes
 *
 * What we're imitating:
 *   Effulgence's planets look the way they do because the underlying 3D
 *   meshes carry vertex colors that the GPU interpolates across faces;
 *   the shader then maps interpolated color → ASCII glyph. That gives
 *   smooth gradients and implicit "biomes" between vertex points.
 *
 *   We can't run a real shader pipeline, but we can fake the result by
 *   defining biomes directly in (latitude, longitude) space on the
 *   sphere and letting the renderer sample them per cell. Each biome
 *   carries its own glyph palette and brightness, so a planet reads as
 *   continents + oceans + ice caps rather than uniform noise.
 *
 * Biome assignment is deterministic from the system seed, so every
 * visit shows the same continents in the same place.
 */

import type { SeedTriple } from '../types';

export type Biome = 'ice' | 'forest' | 'land' | 'ocean' | 'deepOcean';

export interface BiomeInfo {
  /** Glyph candidate pool. The per-planet palette is a deterministic
   *  seed-shuffled subset of size `paletteSize`. */
  readonly pool: readonly string[];
  /** How many glyphs to pick from the pool for any given planet. */
  readonly paletteSize: number;
  /** Intrinsic brightness 0..1. Ice bright, deep ocean dim. */
  readonly brightness: number;
  /** True for ocean variants — used by the renderer to route water to
   *  the cool planet hue layer and land to the warm accent layer. */
  readonly isWater: boolean;
  /** Maximum seed-derived hue offset (degrees, applied symmetrically:
   *  the actual shift falls in [-hueShiftRange, +hueShiftRange]). */
  readonly hueShiftRange: number;
}

export const BIOMES: Readonly<Record<Biome, BiomeInfo>> = {
  ice: {
    pool: ['.', "'", '*', ':', '·', '°', ';', ',', '`', '+', '^', '"'],
    paletteSize: 5, brightness: 0.95, isWater: false, hueShiftRange: 10,
  },
  forest: {
    pool: ['#', '%', '&', 'T', 'Y', '@', '$', '*', 'R', 'K', 'H', 'B', 'V'],
    paletteSize: 6, brightness: 0.55, isWater: false, hueShiftRange: 25,
  },
  land: {
    pool: ['=', '+', 'o', 'O', '0', 'D', 'b', '6', '9', 'q', 'p', 'Q', 'a', 'e'],
    paletteSize: 6, brightness: 0.75, isWater: false, hueShiftRange: 20,
  },
  ocean: {
    pool: ['~', '-', "'", ',', '.', '_', '`', '^', '=', ':'],
    paletteSize: 5, brightness: 0.50, isWater: true,  hueShiftRange: 15,
  },
  deepOcean: {
    pool: ['.', ',', '`', "'", '_', ':', ';', '°', '^', '"'],
    paletteSize: 5, brightness: 0.35, isWater: true,  hueShiftRange: 15,
  },
};

/** Mix the system seed with the biome name into a 32-bit hash that's
 *  stable across runs. Used by the palette-shuffle and hue-shift
 *  helpers below so identical (seed, biome) pairs always agree. */
function seedBiomeHash(seed: SeedTriple, biome: Biome): number {
  let h = ((seed[0] * 73856093) ^ (seed[1] * 19349663) ^ (seed[2] * 83492791)) >>> 0;
  for(let i = 0; i < biome.length; i++){
    h = Math.imul(h, 31) + biome.charCodeAt(i);
    h = h >>> 0;
  }
  return h;
}

/**
 * Per-planet biome palette: a deterministic shuffle of the biome's
 * pool, truncated to `paletteSize`. Two planets with the same seed
 * pick the same glyphs in the same order; two different seeds will
 * almost always pick different palettes for the same biome.
 */
export function biomePaletteForSeed(seed: SeedTriple, biome: Biome): readonly string[] {
  const info = BIOMES[biome];
  const pool = info.pool.slice();
  const N = info.paletteSize;
  if(pool.length <= N) return Object.freeze(pool);
  let s = seedBiomeHash(seed, biome);
  // Fisher-Yates with an LCG so the shuffle is deterministic from `s`.
  for(let i = pool.length - 1; i > 0; i--){
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
  }
  return Object.freeze(pool.slice(0, N));
}

/**
 * Per-planet, per-biome hue offset in degrees. Lets ice on Lave look
 * a different temperature from ice on Diso, etc. Always within
 * ±BIOMES[biome].hueShiftRange.
 */
export function biomeHueShiftForSeed(seed: SeedTriple, biome: Biome): number {
  const info = BIOMES[biome];
  let s = seedBiomeHash(seed, biome);
  s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
  const t = (s & 0xffff) / 0x10000;     // [0, 1)
  return Math.round((t * 2 - 1) * info.hueShiftRange);
}

/** Latitude (radians) above which we always treat the surface as ice. */
const POLAR_CAP_LAT = 1.15;

/**
 * Biome at a sphere surface point. Inputs:
 *   seed — system seed (stable per system).
 *   lat  — latitude in radians, range roughly [-π/2, +π/2].
 *   lon  — longitude in radians, any value (wrapped modulo 2π).
 *
 * The procedural noise is intentionally simple: a sum of three
 * trig terms whose phases are offset by seed-derived constants.
 * Cheaper than Perlin and good enough for the small biome zones
 * we want to read on a wireframe planet.
 */
export function biomeAt(seed: SeedTriple, lat: number, lon: number): Biome {
  // Polar ice caps short-circuit the noise.
  if (Math.abs(lat) > POLAR_CAP_LAT) return 'ice';

  // Wrap longitude to [0, 2π). The noise multipliers below are
  // non-integer so sin/cos aren't 2π-periodic; without this wrap,
  // biomeAt(seed, lat, lon) and biomeAt(seed, lat, lon+2π) would
  // disagree, breaking the "biomes are painted onto the sphere" promise.
  const TWO_PI = Math.PI * 2;
  const lonN = ((lon % TWO_PI) + TWO_PI) % TWO_PI;

  // Seed-derived phase shifts so each system has its own continents.
  const seedHash = ((seed[0] ^ (seed[1] << 4) ^ (seed[2] << 8)) >>> 0) / 0x10000;
  const off = seedHash * Math.PI * 2;

  // Continent-vs-ocean noise (large scale).
  const continent =
      Math.sin(lonN * 2.5 + off)         * 0.7
    + Math.cos(lat  * 3.0 + off * 0.7)   * 0.5
    + Math.sin((lonN - lat) * 1.7 + off * 1.3) * 0.4;

  // Forest overlay noise (smaller scale, cuts into land regions).
  const forestN =
      Math.sin(lonN * 5.0 + off * 2.0) * 0.4
    + Math.cos(lat  * 6.0 + off * 1.5) * 0.3;

  if (continent > 0.45 && forestN > 0.10) return 'forest';
  if (continent > 0.05) return 'land';
  if (continent > -0.6) return 'ocean';
  return 'deepOcean';
}

/** Convenience alias for callers that only need one of the fields. */
export function biomeInfoAt(seed: SeedTriple, lat: number, lon: number): BiomeInfo {
  return BIOMES[biomeAt(seed, lat, lon)];
}
