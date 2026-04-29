/**
 * Aphelion — NPC ships (per-system spawns + behaviour)
 *
 * Two responsibilities:
 *
 *   spawnNpcs(system)   — pure derivation. Returns the ships visible
 *                         in a system, deterministic from the seed.
 *                         Each NPC has a role (pirate / police /
 *                         trader) whose distribution is biased by
 *                         government type — anarchies skew pirate,
 *                         corporate-states skew police.
 *
 *   stepNpc(npc, ...)   — per-frame behaviour. Pirates yaw toward the
 *                         player and throttle forward; traders and
 *                         police stay parked in this slice. Pure
 *                         function: takes the npc and player state,
 *                         returns the updated npc.
 *
 * No state machine, no encounter system, no save format — every
 * frame the renderer asks for the npc list, calls stepNpc on each
 * one, and that's it. Multi-role behaviour (trader-flee, police
 * intervention, combat-rank tracking) lands in follow-ups.
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

/* Pirate behaviour tunables. Values picked to read at the same scale
 * as the player ship (TUNING.maxSpeed = 80, TUNING.turnRate = 1.2).
 * Pirates are slower and turn slower so the player has a fighting
 * chance even if the AI is mathematically perfect. */
const PIRATE_SPEED      = 8;        // world units / second
const PIRATE_TURN_RATE  = 0.6;      // radians / second
/** Minimum stand-off distance — once a pirate is this close, it stops
 *  closing so it doesn't fly through the player every frame. */
const PIRATE_STAND_OFF  = 8;

/**
 * One frame of NPC behaviour. Pure: takes the npc + player position
 * + dt, returns the new npc. Non-pirate roles return unchanged.
 *
 * Pirates use a 2D pursuit model in the (x, z) plane — match yaw to
 * the bearing of the player, then throttle forward. Pitch stays at
 * zero; full 3D dogfighting lands when ships start firing.
 */
export function stepNpc(npc: NpcShip, playerPos: Vec3, dt: number): NpcShip {
  if (npc.role !== 'pirate') return npc;

  const dx = playerPos[0] - npc.position[0];
  const dz = playerPos[2] - npc.position[2];
  const horizDist = Math.hypot(dx, dz);
  if (horizDist < PIRATE_STAND_OFF) return npc;

  // Bearing toward player. yaw=0 in this codebase faces +Z, so the
  // target yaw is atan2(dx, dz), not the more familiar atan2(y, x).
  const targetYaw = Math.atan2(dx, dz);

  // Shortest-path yaw step, capped at the per-frame turn budget.
  let yawErr = targetYaw - npc.yaw;
  while (yawErr >  Math.PI) yawErr -= 2 * Math.PI;
  while (yawErr < -Math.PI) yawErr += 2 * Math.PI;
  const maxStep = PIRATE_TURN_RATE * dt;
  const yawStep = Math.abs(yawErr) <= maxStep
    ? yawErr
    : Math.sign(yawErr) * maxStep;
  let newYaw = npc.yaw + yawStep;
  // Keep yaw in [0, 2π) so visualizations / tests never drift.
  while (newYaw <  0)             newYaw += 2 * Math.PI;
  while (newYaw >= 2 * Math.PI)   newYaw -= 2 * Math.PI;

  // Move forward along the new heading at pirate cruise speed.
  const fx = Math.sin(newYaw);
  const fz = Math.cos(newYaw);
  const newPos: Vec3 = [
    npc.position[0] + fx * PIRATE_SPEED * dt,
    npc.position[1],
    npc.position[2] + fz * PIRATE_SPEED * dt,
  ];

  return { ...npc, position: newPos, yaw: newYaw };
}
