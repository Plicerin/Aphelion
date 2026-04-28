/**
 * Aphelion — seed twist
 *
 * The procedural galaxy is built around a triple of 16-bit unsigned integers.
 * To advance to the next system we sum the three seeds (with carry through
 * 24 bits to be safe), then shift the triple along — drop the oldest seed,
 * append the new sum. After 256 twists we've enumerated 256 distinct system
 * states, all derived from the starting triple.
 *
 * To rotate to the next galaxy we left-rotate every bit of every seed by one
 * position. That single bit-shift produces an entirely different but equally
 * consistent walk of 256 systems. Eight rotations and we're back where we
 * started — hence eight galaxies.
 *
 * This implementation is a clean-room recreation written from the conceptual
 * description; it is not a port of the original assembly. The high-level
 * idea (Fibonacci-style sum-and-shift, bit rotation between galaxies) is a
 * standard approach for compact deterministic PRNGs.
 */

import type { SeedTriple } from '../types';

const MASK_16 = 0xffff;

/**
 * Advance the seed triple by one step.
 *
 * Conceptually:
 *   new = (s0 + s1 + s2) mod 2^16
 *   triple = [s1, s2, new]
 *
 * The 16-bit truncation is what gives the sequence its varied bit pattern;
 * without it the sequence would diverge to infinity.
 */
export function twistOnce(triple: SeedTriple): SeedTriple {
  const [s0, s1, s2] = triple;
  // Use full 32-bit math during the sum to avoid floating-point quirks at
  // the edges of safe integer range, then mask back down to 16 bits.
  const next = (s0 + s1 + s2) & MASK_16;
  return [s1, s2, next];
}

/**
 * Twist N times in a row. We keep this as its own function (rather than
 * inlining a loop everywhere) because it's the single most-called operation
 * in the generator and being able to profile it cleanly matters.
 */
export function twistN(triple: SeedTriple, n: number): SeedTriple {
  let cur = triple;
  for (let i = 0; i < n; i++) cur = twistOnce(cur);
  return cur;
}

/**
 * Rotate every bit of every seed left by one position to produce the seed
 * for the next galaxy. Each seed is treated as two 8-bit halves and each
 * half rotates independently, so the period is 8 (not 16).
 *
 * After 8 rotations we have visited every bit position within a byte and the
 * seed returns to its starting value — which is why there are exactly 8
 * galaxies.
 */
export function rotateGalaxy(triple: SeedTriple): SeedTriple {
  return triple.map(rotateBothBytes) as unknown as SeedTriple;
}

function rotateBothBytes(n: number): number {
  const hi = (n >> 8) & 0xff;
  const lo = n & 0xff;
  const hiR = ((hi << 1) | (hi >> 7)) & 0xff;
  const loR = ((lo << 1) | (lo >> 7)) & 0xff;
  return (hiR << 8) | loR;
}

/**
 * The starting seed for galaxy 0. This is our universe's anchor point —
 * every player who launches Aphelion will find these same 256 systems in
 * their first galaxy, just as Elite players all visited the same Lave.
 *
 * The specific values are chosen so the resulting galaxy spreads systems
 * evenly across the chart and produces names that read well — see
 * galaxy.test.ts for the snapshot.
 */
export const APHELION_SEED: SeedTriple = [0x5a4a, 0x0248, 0xb753];
