/**
 * Aphelion — combat
 *
 * Front laser hit detection, hull damage accounting, and explosion
 * lifecycle. Pure functions over (npcs, ship, dt) — no side effects,
 * no internal state. The flight tick wires player input to these,
 * and the renderer reads npc.hp / npc.explodingT for visuals.
 *
 * Phase 1 scope: player shoots, NPCs don't shoot back. NPC weapons,
 * police response to crime, and combat-rank tracking land in
 * follow-ups.
 */

import type { Vec3 } from './vec';
import type { NpcShip } from './npc';

/** Maximum laser range in world units. NPCs spawn at z=25..90, so
 *  this comfortably covers the spawn space. */
export const LASER_RANGE = 80;

/** Damage per second of sustained fire. With NPC_MAX_HP=100, that's
 *  a clean 1.25-second time-to-kill on a stationary target — long
 *  enough that the player feels combat happening, short enough that
 *  it doesn't drag. */
export const LASER_DPS = 80;

/** Initial hull HP for spawned NPCs. */
export const NPC_MAX_HP = 100;

/** Sphere radius used for laser-vs-npc intersection. NPC ships are
 *  visually ~1 unit wide; 2.5 gives generous "I had it on the
 *  crosshair" tolerance without making aim feel like a barn door. */
export const NPC_HIT_RADIUS = 2.5;

/** Seconds the explosion animation runs. Once explodingT exceeds
 *  this, advanceExplosions removes the npc from the list. */
export const EXPLOSION_DURATION = 1.0;

/** Player ship hull HP. Same scale as NPC_MAX_HP. */
export const PLAYER_MAX_HP = 100;

/** Pirate laser DPS — half the player's, so 1v1 is winnable but not
 *  trivial. Multiple pirates stacking fire makes group fights tense. */
export const NPC_PIRATE_DPS = 40;

/** Maximum range at which a pirate will open fire on the player. */
export const NPC_LASER_RANGE = 60;

/** Cosine of the half-angle of the cone within which a pirate
 *  considers itself "on target". 0.92 ≈ ~23° half-angle — generous
 *  enough that turning pirates can hit, tight enough that you can
 *  juke off the line. */
export const NPC_FIRING_CONE_DOT = 0.92;

/** Result of a successful laser ray test. */
export interface LaserTarget {
  /** Index of the hit ship in the npc list passed to laserTarget. */
  readonly index: number;
  /** Distance along the ray to the hit, in world units. */
  readonly distance: number;
}

/**
 * Find the nearest non-exploding NPC along the ray from shipPos in
 * direction shipForward, within LASER_RANGE. Returns null if nothing
 * is in line.
 *
 * Each NPC is treated as a sphere of radius NPC_HIT_RADIUS — a
 * small generous bubble around its origin point, since the
 * wireframe ships are tiny and we want hits to land when the
 * player visibly has them on the crosshair.
 */
export function laserTarget(
  shipPos: Vec3, shipForward: Vec3, npcs: readonly NpcShip[],
): LaserTarget | null {
  let bestIdx = -1;
  let bestT = LASER_RANGE;
  for (let i = 0; i < npcs.length; i++) {
    const npc = npcs[i];
    if (npc.explodingT > 0 || npc.hp <= 0) continue;
    const t = rayHitsSphere(shipPos, shipForward, npc.position, NPC_HIT_RADIUS);
    if (t !== null && t < bestT) {
      bestT = t;
      bestIdx = i;
    }
  }
  return bestIdx >= 0 ? { index: bestIdx, distance: bestT } : null;
}

/**
 * Apply DPS damage to npcs[index] for one frame of duration dt.
 * Returns a new npc list (copy-on-write — npc objects are
 * immutable). When HP reaches zero, the npc transitions to the
 * exploding state by setting explodingT to a tiny positive value;
 * subsequent calls on the same index are no-ops.
 */
export function applyLaserDamage(
  npcs: readonly NpcShip[], index: number, dps: number, dt: number,
): readonly NpcShip[] {
  const target = npcs[index];
  if (!target || target.explodingT > 0 || target.hp <= 0) return npcs;
  const newHp = Math.max(0, target.hp - dps * dt);
  // Tiny positive epsilon flags "explosion just started"; the
  // renderer reads explodingT to draw the burst.
  const explodingT = newHp <= 0 ? 0.0001 : target.explodingT;
  const out = npcs.slice();
  out[index] = { ...target, hp: newHp, explodingT };
  return out;
}

/**
 * Advance every exploding NPC's explodingT by dt; remove ones whose
 * explosion has run for longer than EXPLOSION_DURATION. Non-
 * exploding npcs pass through unchanged.
 */
export function advanceExplosions(
  npcs: readonly NpcShip[], dt: number,
): readonly NpcShip[] {
  const out: NpcShip[] = [];
  for (const npc of npcs) {
    if (npc.explodingT > 0) {
      const newT = npc.explodingT + dt;
      if (newT < EXPLOSION_DURATION) {
        out.push({ ...npc, explodingT: newT });
      }
      // else: explosion finished, npc dropped from the list.
    } else {
      out.push(npc);
    }
  }
  return out;
}

/**
 * Decide whether a single pirate is firing this frame.
 *
 * Conditions: pirate must be alive, within NPC_LASER_RANGE of the
 * player, and pointing at the player within the firing cone (dot
 * product of forward heading and player direction > cone-cosine).
 *
 * Pure read — no state changes. The renderer uses this to draw
 * incoming-fire indicators at the same time damage is applied.
 */
export function pirateIsFiring(npc: NpcShip, playerPos: Vec3): boolean {
  if (npc.role !== 'pirate') return false;
  if (npc.explodingT > 0 || npc.hp <= 0) return false;
  const dx = playerPos[0] - npc.position[0];
  const dz = playerPos[2] - npc.position[2];
  const dist = Math.hypot(dx, dz);
  if (dist > NPC_LASER_RANGE || dist < 0.001) return false;
  // Pirate forward heading (2D — npc movement is yaw-only).
  const fx = Math.sin(npc.yaw);
  const fz = Math.cos(npc.yaw);
  const tox = dx / dist;
  const toz = dz / dist;
  return fx * tox + fz * toz > NPC_FIRING_CONE_DOT;
}

/**
 * Apply incoming pirate fire to the player. Returns the new player
 * hp after every firing pirate's DPS contribution has drained for
 * dt seconds. Multiple pirates stack additively.
 */
export function applyPirateFire(
  playerHp: number, npcs: readonly NpcShip[], playerPos: Vec3, dt: number,
): number {
  if (playerHp <= 0) return 0;
  let totalDps = 0;
  for (const npc of npcs) {
    if (pirateIsFiring(npc, playerPos)) totalDps += NPC_PIRATE_DPS;
  }
  if (totalDps === 0) return playerHp;
  return Math.max(0, playerHp - totalDps * dt);
}

/* ===== Internals ===== */

/** Returns the t-along-ray of the nearest point of the ray to the
 *  sphere centre, IF that point is inside the sphere AND in front
 *  of the ray origin. null otherwise. */
function rayHitsSphere(
  ro: Vec3, rd: Vec3, sc: Vec3, radius: number,
): number | null {
  const ox = sc[0] - ro[0];
  const oy = sc[1] - ro[1];
  const oz = sc[2] - ro[2];
  const t = ox * rd[0] + oy * rd[1] + oz * rd[2];
  if (t < 0) return null;       // sphere is behind the ship
  const ocLen2 = ox * ox + oy * oy + oz * oz;
  const d2 = ocLen2 - t * t;
  if (d2 > radius * radius) return null;
  return t;
}
