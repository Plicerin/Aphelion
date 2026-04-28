/**
 * Aphelion — core types
 *
 * These are the public data shapes used across modules. Keep this file
 * dependency-free so anything can import from it without cycles.
 */

/**
 * A system's economic stance, ordered from most industrial to most agricultural.
 * Industrial systems pay more for food and minerals; agricultural systems pay
 * more for machinery and computers. This drives the trade loop.
 */
export type Economy =
  | 'rich-industrial'
  | 'average-industrial'
  | 'poor-industrial'
  | 'mainly-industrial'
  | 'mainly-agricultural'
  | 'rich-agricultural'
  | 'average-agricultural'
  | 'poor-agricultural';

/**
 * Government types influence crime levels, police presence, and pirate spawns.
 * Anarchy systems are dangerous but lucrative; corporate states are safe but
 * tight-margin. Order matters: anarchy=0 is most dangerous, corporate=7 safest.
 */
export type Government =
  | 'anarchy'
  | 'feudal'
  | 'multi-government'
  | 'dictatorship'
  | 'communist'
  | 'confederacy'
  | 'democracy'
  | 'corporate-state';

/** A single system as it appears on the galactic chart. */
export interface System {
  /** 0..255 — index in the galaxy, deterministic from the seed walk. */
  readonly index: number;

  /** Display name, e.g. "Tarvel". 3–8 characters of consonant/vowel pairs. */
  readonly name: string;

  /** Coordinates on the galactic chart, both 0..255. */
  readonly x: number;
  readonly y: number;

  readonly economy: Economy;
  readonly government: Government;

  /** 1..15. Higher tech sells better lasers, shields, computers. */
  readonly techLevel: number;

  /** In billions of inhabitants. Set the lore tone — 0.1B vs 7.0B feels different. */
  readonly population: number;

  /** Productivity score, used to scale trade volumes. */
  readonly productivity: number;

  /** Approximate radius in km — flavor only. */
  readonly radius: number;

  /**
   * The seed triple used to enter this system. We keep it so we can
   * regenerate things like the goat-soup description on demand without
   * storing the full description string with every system.
   */
  readonly seed: SeedTriple;
}

/** Three 16-bit unsigned integers — the heart of the procedural generator. */
export type SeedTriple = readonly [number, number, number];

/** A whole galaxy of 256 systems, fully generated from one starting seed. */
export interface Galaxy {
  readonly index: number; // 0..7
  readonly name: string;  // procedural — e.g. "Solanae", "Vesperia"
  readonly systems: readonly System[];
}
