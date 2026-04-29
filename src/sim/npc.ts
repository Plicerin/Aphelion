/**
 * Aphelion — NPC ships (per-system spawns + behaviour)
 *
 * Two responsibilities:
 *
 *   spawnNpcs(system)           — pure derivation. Returns the ships
 *                                 visible in a system, deterministic
 *                                 from the seed. Each NPC has a role
 *                                 (pirate / police / trader) whose
 *                                 distribution is biased by government
 *                                 type — anarchies skew pirate,
 *                                 corporate-states skew police.
 *
 *   stepNpc(npc, ctx, dt)       — per-frame behaviour. Pirates yaw
 *                                 toward the player and throttle in;
 *                                 traders detect nearby pirates and
 *                                 flee in the opposite direction;
 *                                 police stay parked in this slice.
 *                                 Pure function, returns a new npc.
 *
 * No state machine, no encounter system, no save format — every
 * frame the renderer asks for the npc list, calls stepNpc on each
 * one, and that's it. Police behaviour and combat-rank tracking
 * land in follow-ups.
 */

import type { Government, SeedTriple, System } from '../types';
import type { Vec3 } from './vec';

export type NpcRole = 'pirate' | 'police' | 'trader';

export interface NpcShip {
  /** Blueprint id from src/sim/blueprints.ts. */
  readonly shipId: string;
  /** Behavioural role — drives both visual identity and stepNpc logic. */
  readonly role: NpcRole;
  /** World-space position relative to the system origin. */
  readonly position: Vec3;
  /** Yaw rotation around the world-up axis, in radians [0, 2π). */
  readonly yaw: number;
}

/**
 * Per-government [pirate, police, trader] role weights. Numbers are
 * intentionally chunky — exact percentages aren't load-bearing, the
 * point is that each system *feels* like its government on arrival.
 * Weights sum to 1.0 within each row.
 */
const ROLE_WEIGHTS: Readonly<Record<Government, readonly [number, number, number]>> = {
  'anarchy':          [0.70, 0.00, 0.30],
  'feudal':           [0.50, 0.05, 0.45],
  'multi-government': [0.30, 0.15, 0.55],
  'dictatorship':     [0.30, 0.20, 0.50],
  'communist':        [0.20, 0.30, 0.50],
  'confederacy':      [0.15, 0.35, 0.50],
  'democracy':        [0.10, 0.35, 0.55],
  'corporate-state':  [0.05, 0.50, 0.45],
};

/**
 * Hash (system seed, slot index) into a stable [0, 1) float. Used by
 * the spawner to make every property of every npc reproducible from
 * the system seed alone.
 */
function seedSlotFloat(seed: SeedTriple, slot: number, salt: number): number {
  let h = ((seed[0] * 73856093) ^ (seed[1] * 19349663) ^ (seed[2] * 83492791)) >>> 0;
  h = (Math.imul(h, 31) + slot)  >>> 0;
  h = (Math.imul(h, 31) + salt)  >>> 0;
  h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
  return h / 0x100000000;
}

function pickRole(roll: number, gov: Government): NpcRole {
  const [pirateW, policeW] = ROLE_WEIGHTS[gov];
  if (roll < pirateW) return 'pirate';
  if (roll < pirateW + policeW) return 'police';
  return 'trader';
}

/**
 * Spawn 3–5 NPCs per system. Count, position, yaw, and role are all
 * deterministic from the system's seed + government, so two visits
 * to the same system see identical configurations.
 *
 * Position bounds (kept compatible with earlier single-NPC tests):
 *   x: ±50, y: ±15, z: 25..90
 */
export function spawnNpcs(system: System): readonly NpcShip[] {
  const { seed, government } = system;
  const count = 3 + Math.floor(seedSlotFloat(seed, 0, 0xc0) * 3);  // 3..5
  const npcs: NpcShip[] = [];
  for (let i = 0; i < count; i++) {
    const role = pickRole(seedSlotFloat(seed, i, 0xa1), government);
    const ox  = (seedSlotFloat(seed, i, 0xb2) - 0.5) * 100;        // -50..+50
    const oy  = (seedSlotFloat(seed, i, 0xc3) - 0.5) * 30;         // -15..+15
    const oz  = 25 + seedSlotFloat(seed, i, 0xd4) * 65;            // 25..90
    const yaw = seedSlotFloat(seed, i, 0xe5) * Math.PI * 2;
    npcs.push({ shipId: 'wraith', role, position: [ox, oy, oz], yaw });
  }
  return npcs;
}

/* Behaviour tunables. Pirates are slightly slower than the player so
 * they're catchable; traders out-cruise pirates in a straight line
 * but turn slower, giving pirates a chance to corner them by cutting
 * angles. Both are 2D — pitch stays at 0 until weapons land. */
const PIRATE_SPEED        = 8;
const PIRATE_TURN_RATE    = 0.6;
const PIRATE_STAND_OFF    = 8;

const TRADER_SPEED        = 9;       // a touch faster than pirates in a chase
const TRADER_TURN_RATE    = 0.4;     // but slower to change heading
const TRADER_FLEE_RADIUS  = 30;      // start fleeing when a pirate is this close

/**
 * Per-frame context for stepNpc.
 *
 *   playerPos — current player ship position; pirates target it.
 *   npcs      — full list of NPCs in the system at the START of this
 *               frame. Traders read pirate positions from it. Self
 *               filtering is done inside stepNpc.
 */
export interface NpcStepCtx {
  readonly playerPos: Vec3;
  readonly npcs: readonly NpcShip[];
}

/**
 * One frame of NPC behaviour. Pure: takes the npc + context + dt,
 * returns a new npc. Police return unchanged in this slice.
 */
export function stepNpc(npc: NpcShip, ctx: NpcStepCtx, dt: number): NpcShip {
  if (npc.role === 'pirate') return stepPirate(npc, ctx.playerPos, dt);
  if (npc.role === 'trader') return stepTrader(npc, ctx.npcs, dt);
  return npc;
}

/* ===== Pirate pursuit ===== */

function stepPirate(npc: NpcShip, playerPos: Vec3, dt: number): NpcShip {
  const dx = playerPos[0] - npc.position[0];
  const dz = playerPos[2] - npc.position[2];
  if (Math.hypot(dx, dz) < PIRATE_STAND_OFF) return npc;
  const targetYaw = Math.atan2(dx, dz);
  return stepTowardYaw(npc, targetYaw, PIRATE_SPEED, PIRATE_TURN_RATE, dt);
}

/* ===== Trader flee ===== */

function stepTrader(npc: NpcShip, npcs: readonly NpcShip[], dt: number): NpcShip {
  // Find the closest pirate within flee radius.
  let closest: NpcShip | null = null;
  let closestD2 = TRADER_FLEE_RADIUS * TRADER_FLEE_RADIUS;
  for (const other of npcs) {
    if (other === npc) continue;
    if (other.role !== 'pirate') continue;
    const dx = other.position[0] - npc.position[0];
    const dz = other.position[2] - npc.position[2];
    const d2 = dx * dx + dz * dz;
    if (d2 < closestD2) {
      closest = other;
      closestD2 = d2;
    }
  }
  if (!closest) return npc;
  // Target yaw: away from the closest pirate.
  const ax = npc.position[0] - closest.position[0];
  const az = npc.position[2] - closest.position[2];
  const targetYaw = Math.atan2(ax, az);
  return stepTowardYaw(npc, targetYaw, TRADER_SPEED, TRADER_TURN_RATE, dt);
}

/* ===== Shared movement helper =====
 *
 * Step the npc's heading toward `targetYaw` (capped at turnRate * dt),
 * then translate forward at `speed`. Yaw stays in [0, 2π); y stays
 * unchanged (2D plane only).
 */
function stepTowardYaw(
  npc: NpcShip, targetYaw: number, speed: number, turnRate: number, dt: number,
): NpcShip {
  let yawErr = targetYaw - npc.yaw;
  while (yawErr >  Math.PI) yawErr -= 2 * Math.PI;
  while (yawErr < -Math.PI) yawErr += 2 * Math.PI;
  const maxStep = turnRate * dt;
  const yawStep = Math.abs(yawErr) <= maxStep
    ? yawErr
    : Math.sign(yawErr) * maxStep;
  let newYaw = npc.yaw + yawStep;
  while (newYaw <  0)             newYaw += 2 * Math.PI;
  while (newYaw >= 2 * Math.PI)   newYaw -= 2 * Math.PI;
  const fx = Math.sin(newYaw);
  const fz = Math.cos(newYaw);
  return {
    ...npc,
    yaw: newYaw,
    position: [
      npc.position[0] + fx * speed * dt,
      npc.position[1],
      npc.position[2] + fz * speed * dt,
    ],
  };
}
