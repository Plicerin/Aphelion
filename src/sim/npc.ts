/**
 * Aphelion — NPC ships (per-system spawns)
 *
 * Pure derivation: spawnNpcs(system) returns the ships visible in that
 * system. Position, orientation, and ship type are all deterministic
 * functions of the system's seed, so every visit to the same system
 * sees the same configuration. No state machine, no save format.
 *
 * Phase 1: one Wraith per system, parked. AI behaviours, multi-NPC
 * encounters, and per-system role weighting (more pirates in
 * anarchy systems, more police in corporate-state systems) land in
 * follow-ups.
 */

import type { SeedTriple, System } from '../types';
import type { Vec3 } from './vec';

export interface NpcShip {
  /** Blueprint id from src/sim/blueprints.ts. */
  readonly shipId: string;
  /** World-space position relative to the system origin. */
  readonly position: Vec3;
  /** Yaw rotation around the world-up axis, in radians. */
  readonly yaw: number;
}

/* Bit-extract helpers for a deterministic spawn from a seed triple. */
function seedByte(seed: SeedTriple, word: 0 | 1 | 2, shift: number): number {
  return (seed[word] >> shift) & 0xff;
}

/**
 * NPC list for a system. For phase 1, exactly one Wraith. Position is
 * offset from the system origin by seed-derived amounts so each system
 * has a different parked-ship arrangement.
 */
export function spawnNpcs(system: System): readonly NpcShip[] {
  const seed = system.seed;
  // Offset components from non-overlapping bit slices so neighbouring
  // systems don't all spawn ships in the same spot.
  const ox = (seedByte(seed, 0, 4) - 128) * 0.40;   // -51 .. +51
  const oy = (seedByte(seed, 1, 4) - 128) * 0.15;   // -19 .. +19
  const oz = 25 + (seedByte(seed, 2, 0) & 0x3f);    //  25 .. +88
  const yaw = (seedByte(seed, 0, 0) / 256) * Math.PI * 2;

  return [{
    shipId: 'wraith',
    position: [ox, oy, oz],
    yaw,
  }];
}
