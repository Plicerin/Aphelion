/**
 * Aphelion — cockpit sim functions
 *
 * Pure data calculations behind the four cheap dashboard indicators
 * we can wire up before v0.2 combat lands the rest of the systems:
 *
 *   compass(curX, curY, tgtX, tgtY) → angle (radians)
 *     Direction from the current chart position to the selected
 *     target. 0 = east, π/2 = north, etc. Returns null if no target.
 *
 *   fuelAfterJump(fuel, ly) → number
 *     Fuel left after a jump of `ly` light-years. Never goes
 *     negative; if there isn't enough fuel the jump is impossible
 *     and the caller should gate it via canJump() first.
 *
 *   canJump(fuel, ly) → boolean
 *     True if the player has at least the cost of the jump.
 *
 *   cabinHeat(shipPos, sunPos, sunRadius?) → 0..1
 *     Cabin temperature scaled into [0, 1]. Rises as the ship
 *     approaches the local sun; saturates at 1 when very close.
 *     0 means "ambient", 1 means "danger / would damage hull".
 *
 *   isMassLocked(shipPos, bodies, mlRadius?) → boolean
 *     True if the ship is within mass-lock radius of any massive
 *     body (sun or planet). Hyperspace should be gated on
 *     !isMassLocked() so the player can't jump out of a docking
 *     bay or while hugging a sun.
 *
 * All values are dimensionless world units consistent with the
 * flight renderer (positions in cells/world-units, distances
 * compared via straight Euclidean math). Tunable thresholds live
 * here so we can rebalance without hunting through the renderer.
 */

import type { Vec3 } from './vec';
import { ANCHOR_DOCK_RADIUS } from './anchor';

/* ---------- compass ---------- */

/**
 * Angle (radians) from the current chart position to the target.
 * 0 = +X (east on chart), π/2 = +Y (north). Returns null if either
 * argument is null (no current system or no target selected).
 */
export function compass(
  cur: { x: number; y: number } | null,
  tgt: { x: number; y: number } | null,
): number | null {
  if (!cur || !tgt) return null;
  if (cur.x === tgt.x && cur.y === tgt.y) return null;   // same system
  return Math.atan2(tgt.y - cur.y, tgt.x - cur.x);
}

/* ---------- fuel ---------- */

/** Maximum tank size in light-years. Matches Elite-era 7.0 LY tradition. */
export const FUEL_MAX_LY = 7.0;

/** Light-years required for a hyperspace jump of straight-line distance `ly`. */
export function fuelCost(ly: number): number {
  return Math.max(0, ly);
}

/** True if the player has enough fuel to cover the jump. */
export function canJump(fuel: number, ly: number): boolean {
  return fuel >= fuelCost(ly) - 1e-9;
}

/**
 * Fuel remaining after a jump of `ly`. Clamped to [0, FUEL_MAX_LY].
 * If the jump exceeds available fuel, returns 0 (caller should gate
 * via canJump before calling).
 */
export function fuelAfterJump(fuel: number, ly: number): number {
  const remaining = fuel - fuelCost(ly);
  if (remaining < 0) return 0;
  if (remaining > FUEL_MAX_LY) return FUEL_MAX_LY;
  return remaining;
}

/* ---------- cabin heat ---------- */

/**
 * Scale 0..1 representing how hot the cabin is. Rises as the ship
 * gets closer to the sun on a 1/r curve.
 *
 *   - 0  : ship is past `coolRadius` (default 200) — ambient.
 *   - 1  : ship is at or inside `dangerRadius` (default 35) — would
 *          damage the hull; UI should display warn color.
 *   - between: 1 - (d - dangerRadius) / (coolRadius - dangerRadius),
 *              clamped.
 */
export function cabinHeat(
  shipPos: Vec3,
  sunPos: Vec3,
  dangerRadius = 35,
  coolRadius = 200,
): number {
  const dx = shipPos[0] - sunPos[0];
  const dy = shipPos[1] - sunPos[1];
  const dz = shipPos[2] - sunPos[2];
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (d >= coolRadius) return 0;
  if (d <= dangerRadius) return 1;
  return 1 - (d - dangerRadius) / (coolRadius - dangerRadius);
}

/* ---------- mass lock ---------- */

/**
 * Mass-lock radius around a massive body. Within this distance, the
 * ship is "mass-locked" and can't initiate hyperspace.
 */
export const MASS_LOCK_RADIUS = 80;

/**
 * True if any of `bodies` is within `mlRadius` of `shipPos`.
 * Body list is typically [planetPos, sunPos, ...stations] for the
 * current system. Empty list returns false.
 */
export function isMassLocked(
  shipPos: Vec3,
  bodies: readonly Vec3[],
  mlRadius = MASS_LOCK_RADIUS,
): boolean {
  for (const b of bodies) {
    const dx = shipPos[0] - b[0];
    const dy = shipPos[1] - b[1];
    const dz = shipPos[2] - b[2];
    if (dx * dx + dy * dy + dz * dz <= mlRadius * mlRadius) return true;
  }
  return false;
}

/* ---------- docking timer ---------- */

/** Seconds the player must hold position inside the anchor to dock. */
export const DOCK_TIME_REQUIRED = 3.0;

/** Maximum scalar speed (world units / sec) that still counts as "stationary". */
export const DOCK_VELOCITY_MAX = 1.0;

/**
 * Update the docking-progress timer for one frame.
 *
 * Increments while the ship is inside `dockRadius` of the anchor AND
 * scalar speed is below DOCK_VELOCITY_MAX. Otherwise decays toward 0
 * — at half the increment rate so small velocity blips don't fully
 * reset progress on a near-stationary player.
 *
 * Returns the new T in [0, 1]. The screen manager should dispatch a
 * dock action when T crosses 1.
 */
export function updateDockingT(
  currentT: number,
  shipPos: Vec3,
  shipSpeed: number,
  anchorPos: Vec3,
  dt: number,
  dockRadius = ANCHOR_DOCK_RADIUS,
): number {
  const dx = shipPos[0] - anchorPos[0];
  const dy = shipPos[1] - anchorPos[1];
  const dz = shipPos[2] - anchorPos[2];
  const dist2 = dx * dx + dy * dy + dz * dz;
  const inRange = dist2 <= dockRadius * dockRadius;
  const slow = shipSpeed <= DOCK_VELOCITY_MAX;

  if (inRange && slow) {
    return Math.min(1, currentT + dt / DOCK_TIME_REQUIRED);
  }
  // Decay slower than increment so brief blips don't reset.
  return Math.max(0, currentT - dt / (DOCK_TIME_REQUIRED * 2));
}
