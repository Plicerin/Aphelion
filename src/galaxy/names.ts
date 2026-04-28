/**
 * Aphelion — system names
 *
 * Each system gets a 3–8 character name built from two-letter syllable pairs.
 * We pick four pair-indices from the seed bits and concatenate them, then
 * trim trailing whitespace pairs to vary the length.
 *
 * The table below is original to Aphelion. Each entry is two characters; the
 * blend of consonants and vowels is tuned so any combination of four entries
 * produces a pronounceable result. There are 32 entries so we can index into
 * the table with 5 bits — a natural fit for the seed-bit budget.
 *
 * Design notes on the table:
 *   - Roughly half the entries start with a vowel and half with a consonant,
 *     so adjacent pairs alternate naturally.
 *   - We avoid digraphs that look modern-English (no "TH", "SH", "WH") to
 *     keep names feeling alien.
 *   - We include some pairs ending in vowels so concatenation produces flow:
 *     "TA" + "RI" -> "TARI" reads better than "TR" + "RB".
 *   - A few "blank" entries (just one letter + space) shorten names; trailing
 *     spaces get stripped so a name like "AR..XO" becomes "ARXO".
 */

import type { SeedTriple } from '../types';

// 32 entries; index with 5 bits each. Each entry is exactly 2 characters.
// Trailing single-character entries use a space to be trimmed later.
const SYLLABLES: readonly string[] = [
  'AR', 'EN', 'TI', 'OS', 'EX', 'AL', 'IR', 'AN',
  'OR', 'EL', 'US', 'IS', 'AT', 'ON', 'IL', 'EM',
  'XO', 'VE', 'RI', 'KA', 'ME', 'TU', 'ZA', 'GE',
  'NO', 'LA', 'CE', 'PI', 'SO', 'DA', 'BE', 'HE',
];

/**
 * A separate table for GALAXY names. Tuned for a grander phonetic feel —
 * more long vowels, more flowing consonants, fewer hard stops. Where system
 * names sound like places ("Geka", "Onarno"), galaxy names should sound
 * like eras or empires ("Solanae", "Vesperia").
 *
 * Design choices:
 *   - More entries ending in vowels, so concatenation flows ("So" + "lan" = Solan).
 *   - Soft consonants (l, m, n, r, s, v) over hard ones (k, t, x, z).
 *   - A few classical-feeling endings appear in the suffix table separately,
 *     because they need to land at the END of the name, not anywhere.
 */
const GALAXY_PREFIXES: readonly string[] = [
  'Sol', 'Ves', 'Aur', 'Lyr', 'Mer', 'Cal', 'Hes', 'Dor',
  'Per', 'Ari', 'Cor', 'Eos', 'Lum', 'Tha', 'Nym', 'Ele',
];
const GALAXY_MIDDLES: readonly string[] = [
  'an', 'er', 'ad', 'om', 'al', 'in', 'es', 'on',
  'ar', 'el', 'ir', 'us', 'ol', 'iv', 'um', 'as',
];
const GALAXY_SUFFIXES: readonly string[] = [
  'ia', 'us', 'on', 'is', 'ae', 'or', 'um', 'ix',
];

/**
 * Generate a galaxy name from its starting seed.
 *
 * Each galaxy name is built from prefix + (optional middle) + suffix.
 * We pick a 4-bit index for prefix and middle (16 each), and 3 bits for
 * suffix (8 entries). Whether a middle is included depends on a bit of s0,
 * giving a 50/50 split between shorter (Solia, Vesus) and longer (Solanir,
 * Vesperae) names.
 *
 * Example outputs: Solanae, Vesperia, Lyromus, Hesinus, Calix, Dorae, Aurin.
 */
export function galaxyNameFromSeed(seed: SeedTriple): string {
  const [s0, s1, s2] = seed;

  const prefixIdx = (s1 >> 4) & 0xf;
  const middleIdx = (s2 >> 4) & 0xf;
  const suffixIdx = s2 & 0x7;
  const useMiddle = (s0 & 0x4) !== 0;

  let name = GALAXY_PREFIXES[prefixIdx]!;
  if (useMiddle) name += GALAXY_MIDDLES[middleIdx]!;
  name += GALAXY_SUFFIXES[suffixIdx]!;

  // Already title-cased by the prefix table.
  return name;
}

/**
 * Generate a name from a seed triple. We pull four 5-bit indices, two from
 * each of seeds[1] and seeds[2], spreading across the most-distinct bits to
 * keep adjacent systems' names from looking too similar.
 *
 * The low two bits of seed[0] decide whether the name is 2, 3, or 4 syllables
 * long (4, 6, or 8 characters). This gives the galaxy a natural mix of short
 * snappy names ("Arxo") and longer evocative ones ("Tarvelisor").
 */
export function nameFromSeed(seed: SeedTriple): string {
  const [s0, s1, s2] = seed;

  const idx = [
    (s1 >> 8) & 0x1f,
    s1 & 0x1f,
    (s2 >> 8) & 0x1f,
    s2 & 0x1f,
  ];

  // Syllable count: 2 bits of s0 -> 0,1,2,3 -> 2,3,3,4 syllables.
  // We weight 3-syllable names twice as common because they sound best.
  const lenBits = s0 & 0x3;
  const syllableCount = lenBits === 0 ? 2 : lenBits === 3 ? 4 : 3;

  let name = '';
  for (let i = 0; i < syllableCount; i++) {
    name += SYLLABLES[idx[i]!]!;
  }

  // Title-case: first letter uppercase, rest lowercase.
  return name.charAt(0) + name.slice(1).toLowerCase();
}
