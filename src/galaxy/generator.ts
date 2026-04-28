/**
 * Aphelion — galaxy generator
 *
 * Walks the seed twist 256 times, extracting a System from each triple.
 * The bit-to-property mapping below is our own; it's chosen so that:
 *   - Coordinates spread evenly over the 256x256 chart.
 *   - Economy and government are loosely correlated with x/y position, so
 *     regions of the galaxy have a recognizable "feel" rather than being
 *     uniform noise. (E.g. the high-y band tends to have more agricultural
 *     systems, the low-y band more industrial.)
 *   - Tech level is a weighted sum of government stability and economy
 *     wealth, so safe rich systems have the best equipment.
 *
 * This bit layout is independent of any specific game's prior choices.
 */

import type { Economy, Galaxy, Government, SeedTriple, System } from '../types';
import { APHELION_SEED, rotateGalaxy, twistOnce } from './twist';
import { nameFromSeed } from './names';

const ECONOMIES: readonly Economy[] = [
  'rich-industrial',
  'average-industrial',
  'poor-industrial',
  'mainly-industrial',
  'mainly-agricultural',
  'rich-agricultural',
  'average-agricultural',
  'poor-agricultural',
];

const GOVERNMENTS: readonly Government[] = [
  'anarchy',
  'feudal',
  'multi-government',
  'dictatorship',
  'communist',
  'confederacy',
  'democracy',
  'corporate-state',
];

/**
 * Extract a System from a seed triple at a given index.
 *
 * Bit mapping (chosen for spread, not derived from any prior implementation):
 *   x         = high byte of s0
 *   y         = low byte of s0, halved (chart is 256x128 visually)
 *   economy   = bits 0..2 of s2 high byte, with a y-bias nudge
 *   government= bits 3..5 of s1 high byte
 *   techLevel = derived from economy + government + 1..3 noise from s2
 *   pop, prod = derived from techLevel and economy
 */
function systemFromSeed(seed: SeedTriple, index: number): System {
  const [s0, s1, s2] = seed;

  const x = (s0 >> 8) & 0xff;
  const y = (s0 & 0xff) >> 1;            // 0..127

  // Economy: take 3 bits from s2, then nudge based on y-band so the galaxy
  // has regional flavor rather than being uniform noise.
  let econIdx = (s2 >> 8) & 0x7;
  if (y > 96 && econIdx < 4) econIdx += 4;        // northern band: more agri
  if (y < 32 && econIdx >= 4) econIdx -= 4;       // southern band: more industrial
  const economy: Economy = ECONOMIES[econIdx];

  // Government: 3 bits from s1.
  const govIdx = (s1 >> 11) & 0x7;
  const government: Government = GOVERNMENTS[govIdx];

  // Tech level: stable governments + wealthy economies score higher.
  // Anarchy=0 is least stable, corporate-state=7 most stable.
  // For economy, lower index is wealthier industrial; we map to a wealth score.
  const wealthScore = econIdx < 4 ? 4 - econIdx : econIdx - 3; // 1..4
  const stability = govIdx;                                     // 0..7
  const noise = (s2 & 0x3) + 1;                                 // 1..4
  const techLevel = Math.min(15, Math.max(1, stability + wealthScore + noise));

  // Population scales with tech and is in tenths of billions.
  // Stable, high-tech places host larger populations.
  const population = (techLevel * 4 + stability + econIdx) / 10;

  // Productivity drives trade volumes; rough formula combines wealth + stability.
  const productivity =
    ((stability + 3) * (wealthScore + 4) * 8 + (techLevel * 100)) | 0;

  // Radius — flavor only. 4000..8000 km range.
  const radius = 4000 + (((s2 >> 8) & 0xf) * 256) + (s1 & 0xff);

  return {
    index,
    name: nameFromSeed(seed),
    x,
    y,
    economy,
    government,
    techLevel,
    population: Math.round(population * 10) / 10,
    productivity,
    radius,
    seed,
  };
}

/**
 * Generate a full galaxy of 256 systems from a starting seed.
 *
 * We advance the seed once before extracting each system, so the very first
 * twist gives us system 0. This means the starting seed itself is not a
 * system — it's the "key" that unlocks the galaxy. (This matches the
 * conceptual model: the seed is a generator, the systems are its output.)
 */
export function generateGalaxy(startSeed: SeedTriple, galaxyIndex = 0): Galaxy {
  const systems: System[] = [];
  let cur = startSeed;
  for (let i = 0; i < 256; i++) {
    cur = twistOnce(cur);
    systems.push(systemFromSeed(cur, i));
  }
  return { index: galaxyIndex, systems };
}

/**
 * Generate all 8 galaxies. Each is the bit-rotation of the previous.
 * Cheap to compute (a few hundred microseconds each) so we just do them all.
 */
export function generateAllGalaxies(): readonly Galaxy[] {
  const out: Galaxy[] = [];
  let seed = APHELION_SEED;
  for (let g = 0; g < 8; g++) {
    out.push(generateGalaxy(seed, g));
    seed = rotateGalaxy(seed);
  }
  return out;
}

/** Default galaxy 0 from the canonical APHELION_SEED. */
export function defaultGalaxy(): Galaxy {
  return generateGalaxy(APHELION_SEED, 0);
}
