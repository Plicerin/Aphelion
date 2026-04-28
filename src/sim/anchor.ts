/**
 * Aphelion — trade anchor
 *
 * The "trade anchor" is each system's commerce point: a fixed location
 * in flight world-space, near the planet, that resolves into a readable
 * trade interface as the player approaches it.
 *
 * No skill check on docking — the showpiece is the visual *resolution*
 * of the signal as you fly closer, leaning on the per-color bloom and
 * brightest-wins compositing pipeline. Combat provides the skill gate
 * elsewhere; arriving at an anchor is supposed to feel like a payoff,
 * not another test.
 *
 * The anchor goes through four stages by ship-to-anchor distance:
 *
 *   silent  — beyond ANCHOR_RANGE_FAR. Renderer ignores it entirely.
 *   far     — faint bloom, hint of structure. A pinprick of light with
 *             messy bloom hinting at something out there.
 *   medium  — noisy glyph cloud. Corrupted text, garbled prices, ghost
 *             ship registries. Maximum chromatic chaos. The "fragmented
 *             signal" pitch literalized.
 *   close   — stable HUD overlay. Station name, demand arrows, a
 *             scrolling commodity manifest. Holding position inside
 *             ANCHOR_DOCK_RADIUS for a few seconds opens the trade
 *             screen.
 *
 * This module is pure data: placement and stage classification as
 * functions on plain values. The renderer reads from these and decides
 * what to draw; trade-screen entry timing lives in the screen manager.
 */

import type { SeedTriple } from '../types';
import type { Vec3 } from './vec';

/** Distance thresholds in flight world units. */
export const ANCHOR_RANGE_FAR = 100;
export const ANCHOR_RANGE_MEDIUM = 25;
export const ANCHOR_RANGE_CLOSE = 6;

/**
 * Inside this radius — and roughly stationary — the player is "tuning
 * in". A few seconds of holding station here will open the trade screen.
 * Smaller than ANCHOR_RANGE_CLOSE so the close-range HUD stabilizes
 * before the player commits to docking.
 */
export const ANCHOR_DOCK_RADIUS = 3;

/** Anchor offset distance from the planet, in world units. */
const OFFSET_MIN = 8;
const OFFSET_MAX = 14;

/** Maximum elevation off the orbital plane, in radians. */
const OFFSET_MAX_ELEVATION = 0.3;

export type AnchorStage = 'silent' | 'far' | 'medium' | 'close';

export interface Anchor {
  /** World-space position. Same coordinate frame as ship/planet/sun. */
  readonly position: Vec3;
}

export interface AnchorStageInfo {
  readonly stage: AnchorStage;
  /** Straight-line distance from ship to anchor, in world units. */
  readonly distance: number;
  /**
   * Within-stage progress, 0..1. 0 at the far edge of the stage,
   * 1 at the near edge. For 'silent', always 0. For 'close', reaches 1
   * when the ship is exactly on the anchor. Lets the renderer crossfade
   * visual treatments smoothly across a stage boundary.
   */
  readonly t: number;
}

/**
 * Place an anchor for a system. The offset from the planet is a
 * deterministic function of the seed, so every visit to the same
 * system finds the anchor in the same spot.
 *
 * The bit fields below are mixed across all three seed words with xor
 * and shifts so the offset doesn't correlate strongly with the system's
 * chart position (which is mostly s0 in the galaxy generator).
 */
export function placeAnchor(planetPos: Vec3, seed: SeedTriple): Anchor {
  const [s0, s1, s2] = seed;

  const azBits = (s1 ^ (s2 >> 3) ^ (s0 << 1)) & 0xffff;
  const elBits = (s2 ^ (s0 >> 5) ^ (s1 << 2)) & 0xffff;
  const distBits = ((s0 ^ s1 ^ s2) >> 4) & 0xff;

  const az = (azBits / 0x10000) * Math.PI * 2;
  const el = ((elBits / 0x10000) - 0.5) * 2 * OFFSET_MAX_ELEVATION;
  const dist = OFFSET_MIN + (distBits / 0xff) * (OFFSET_MAX - OFFSET_MIN);

  const cosEl = Math.cos(el);
  const ox = Math.cos(az) * cosEl * dist;
  const oy = Math.sin(el) * dist;
  const oz = Math.sin(az) * cosEl * dist;

  return {
    position: [planetPos[0] + ox, planetPos[1] + oy, planetPos[2] + oz],
  };
}

/**
 * Classify the ship's distance to the anchor and report progress within
 * the current stage so the renderer can crossfade visuals smoothly.
 */
export function anchorStage(shipPos: Vec3, anchorPos: Vec3): AnchorStageInfo {
  const dx = shipPos[0] - anchorPos[0];
  const dy = shipPos[1] - anchorPos[1];
  const dz = shipPos[2] - anchorPos[2];
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (distance >= ANCHOR_RANGE_FAR) {
    return { stage: 'silent', distance, t: 0 };
  }
  if (distance >= ANCHOR_RANGE_MEDIUM) {
    const span = ANCHOR_RANGE_FAR - ANCHOR_RANGE_MEDIUM;
    return { stage: 'far', distance, t: (ANCHOR_RANGE_FAR - distance) / span };
  }
  if (distance >= ANCHOR_RANGE_CLOSE) {
    const span = ANCHOR_RANGE_MEDIUM - ANCHOR_RANGE_CLOSE;
    return { stage: 'medium', distance, t: (ANCHOR_RANGE_MEDIUM - distance) / span };
  }
  const t = Math.max(0, Math.min(1, (ANCHOR_RANGE_CLOSE - distance) / ANCHOR_RANGE_CLOSE));
  return { stage: 'close', distance, t };
}
