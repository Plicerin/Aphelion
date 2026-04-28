/**
 * Aphelion — system descriptions
 *
 * Each system gets a 1–3 sentence flavor description, generated from a
 * recursive grammar driven by a per-system PRNG. The grammar is a context-
 * free expansion: starting from <root>, we pick one production from each
 * nonterminal's rule list and recurse, substituting in literal tokens
 * along the way.
 *
 * The mechanism (CFG + deterministic PRNG) is a standard technique in
 * procedural text generation. The grammar content below — which symbols
 * exist, which expansions they have, which adjective and noun pools we
 * draw from — is original to Aphelion and is tuned for our tone:
 *
 *   - Slightly absurd, in the spirit of classic space opera ("the deadly
 *     poets of Tarvel", "famous for its inability to count past three").
 *   - Self-aware, with running gags about bureaucracy, fauna, and food.
 *   - Vary by system properties: rich systems sound prosperous, poor
 *     systems sound desperate, anarchies sound dangerous, agriculturals
 *     sound bucolic.
 *
 * A description is a pure function of (seed, system properties). Same
 * inputs always produce the same description, so we don't need to store
 * the text — it regenerates instantly from the seed any time we need it.
 */

import type { System, SeedTriple, Economy, Government } from '../types';

/* ===========================================================================
   PRNG: a small deterministic generator seeded by the system's seed triple.
   We don't use the galaxy twist here because we want descriptions to feel
   independent of the seed-walk order. Instead we mix the seed bits into a
   simple LCG that's "good enough" for picking from short lists — not
   cryptographic, just repeatable.
   =========================================================================== */

class DescriptionRng {
  private state: number;

  constructor(seed: SeedTriple) {
    // Mix all three seed words into a single 32-bit state. The XOR shifts
    // help spread bits so adjacent systems don't pick neighboring entries.
    const [s0, s1, s2] = seed;
    this.state = (s0 ^ (s1 << 8) ^ (s2 << 16) ^ (s0 << 24)) >>> 0;
    // Skip a few steps to mix initial bits.
    for (let i = 0; i < 4; i++) this.next();
  }

  /** Advance and return a 32-bit unsigned int. Standard LCG constants. */
  next(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state;
  }

  /** Pick a uniform random index in [0, n). */
  pick<T>(arr: readonly T[]): T {
    return arr[this.next() % arr.length]!;
  }

  /** Return true with probability `p` (0..1). */
  chance(p: number): boolean {
    return (this.next() & 0xffff) / 0x10000 < p;
  }
}

/* ===========================================================================
   Grammar — terminal vocabulary
   Each list is short enough (8–16 entries) that combinations stay varied
   without becoming nonsense. Bigger lists make descriptions feel random;
   smaller lists make patterns recognizable, which is part of the charm.
   =========================================================================== */

const ADJECTIVES_PLEASANT = [
  'fabled', 'remarkable', 'renowned', 'celebrated', 'unusual', 'curious',
  'splendid', 'storied', 'beguiling', 'idyllic', 'breathtaking', 'serene',
];

const ADJECTIVES_GRIM = [
  'forsaken', 'troubled', 'unforgiving', 'inhospitable', 'sweltering',
  'frigid', 'plague-ridden', 'lawless', 'restless', 'crumbling',
];

const ADJECTIVES_NEUTRAL = [
  'peculiar', 'unconventional', 'odd', 'sleepy', 'quiet', 'ordinary',
  'unassuming', 'modest', 'small', 'sprawling',
];

const NATURAL_FEATURES = [
  'oceans', 'mountains', 'deserts', 'glaciers', 'crystal forests',
  'singing caves', 'salt plains', 'lava tubes', 'mist gardens',
  'iron jungles', 'amber lakes', 'wind valleys',
];

const CULTURAL_FEATURES = [
  'three suns', 'twin moons', 'rings of dust', 'low gravity', 'long winters',
  'unusual tides', 'permanent twilight', 'extraordinary storms',
];

const PRODUCTS = [
  'cuisine', 'wines', 'tea', 'spices', 'silks', 'glasswork', 'pottery',
  'poetry', 'mathematics', 'shipwrights', 'clockmakers', 'tailors',
];

const CRAFTS_GRIM = [
  'mercenaries', 'smugglers', 'forgers', 'pirates', 'tax collectors',
  'bureaucrats', 'lawyers', 'inspectors',
];

const CREATURES = [
  'beetles', 'fish', 'birds', 'lizards', 'crabs', 'wolves', 'cats',
  'rabbits', 'jellyfish', 'turtles',
];

const CREATURE_QUALIFIERS = [
  'venomous', 'enormous', 'invisible', 'singing', 'philosophical',
  'territorial', 'short-tempered', 'remarkably patient', 'extremely small',
  'mildly poisonous',
];

const ABSURD_FACTS = [
  'its inhabitants greet each other by reciting prime numbers',
  'tourists are required to register their dreams on arrival',
  'the official language has no past tense',
  'all music is performed underwater',
  'the planetary clock runs backwards on Tuesdays',
  'every meal is preceded by a thirty-minute apology',
  'the local currency is a kind of cheese',
  'no two clouds are alike, by law',
  'public speaking is illegal between sunset and midnight',
  'the mail is delivered exclusively by trained crows',
];

const HAZARDS = [
  'the local ground crews', 'the orbital traffic', 'the ash storms',
  'the customs officers', 'the unpredictable suns', 'the corporate police',
  'the wild moons',
];

const FAMOUS_FOR = [
  'famous for', 'renowned for', 'best known for', 'celebrated for',
  'notorious for', 'occasionally remembered for',
];

const HOME_TO = [
  'home to', 'the birthplace of', 'where you can find', 'the only place with',
];

/* ===========================================================================
   System property classifiers — pick adjective tone based on the system.
   Rich + stable = pleasant; poor + anarchic = grim; everything else = neutral.
   This is what keeps descriptions feeling earned rather than random.
   =========================================================================== */

function adjectivePool(sys: System): readonly string[] {
  const wealthy =
    sys.economy.startsWith('rich') || sys.economy.startsWith('average');
  const stable =
    sys.government === 'democracy' ||
    sys.government === 'corporate-state' ||
    sys.government === 'confederacy';
  const dangerous =
    sys.government === 'anarchy' ||
    sys.government === 'feudal' ||
    sys.economy === 'poor-industrial' ||
    sys.economy === 'poor-agricultural';

  if (dangerous) return ADJECTIVES_GRIM;
  if (wealthy && stable) return ADJECTIVES_PLEASANT;
  return ADJECTIVES_NEUTRAL;
}

function craftPool(sys: System): readonly string[] {
  if (sys.government === 'anarchy' || sys.government === 'feudal') {
    return CRAFTS_GRIM;
  }
  return PRODUCTS;
}

/* ===========================================================================
   Inhabitant name — a deterministic transformation of the system name.
   "Geka" -> "Gekans"; "Onarno" -> "Onarnoans"; "Tarvelis" -> "Tarvelisi".
   We don't use English plural rules; we use a simple suffix table that
   sounds vaguely Elite-era science fiction.
   =========================================================================== */

function inhabitantName(systemName: string, rng: DescriptionRng): string {
  const lastChar = systemName[systemName.length - 1]!.toLowerCase();
  const isVowel = 'aeiou'.includes(lastChar);
  const suffixes = isVowel
    ? ['ans', 'ites', 'ese', 'ari']
    : ['ans', 'ites', 'ians', 'oids'];
  return systemName + rng.pick(suffixes);
}

/* ===========================================================================
   Grammar — production rules
   Each <thing> function picks one of its expansions and returns a string.
   Templates are written as plain JS template literals so we can interleave
   logic with text without parsing a separate grammar file.
   =========================================================================== */

function buildSentence1(sys: System, rng: DescriptionRng): string {
  const adj = rng.pick(adjectivePool(sys));
  const articleAdj = /^[aeiou]/i.test(adj) ? 'an' : 'a';

  // 4 templates for the opening sentence; PRNG picks one
  const templates: ((s: System, r: DescriptionRng) => string)[] = [
    (s, r) =>
      `${s.name} is ${articleAdj} ${adj} world ${r.pick(FAMOUS_FOR)} its ${r.pick(NATURAL_FEATURES)}.`,
    (s, r) =>
      `${s.name} is ${r.pick(FAMOUS_FOR)} its ${r.pick(NATURAL_FEATURES)} and its ${r.pick(CULTURAL_FEATURES)}.`,
    (s, r) =>
      `${s.name} is ${articleAdj} ${adj} place — ${r.pick(HOME_TO)} the galaxy's most ${r.pick(CREATURE_QUALIFIERS)} ${r.pick(CREATURES)}.`,
    (s, r) =>
      `${s.name} is ${r.pick(FAMOUS_FOR)} its ${r.pick(craftPool(s))} and ${r.pick(craftPool(s))}.`,
  ];

  return rng.pick(templates)(sys, rng);
}

function buildSentence2(sys: System, rng: DescriptionRng): string {
  const inhabitants = inhabitantName(sys.name, rng);

  // We list templates with weights so common patterns don't dominate. The
  // 'beware of hazards' line was repeating too often when picked uniformly,
  // so it gets a lower weight than the others.
  const weighted: { weight: number; build: (s: System, r: DescriptionRng, who: string) => string }[] = [
    { weight: 3, build: (_s, r, who) =>
      `The ${who} are ${r.pick(FAMOUS_FOR)} their ${r.pick(craftPool(_s))}.` },
    { weight: 2, build: (_s, r, who) =>
      `Visitors are advised to beware of ${r.pick(HAZARDS)}, but the ${who} are friendly enough.` },
    { weight: 3, build: (_s, r, _who) =>
      `It is said that ${r.pick(ABSURD_FACTS)}.` },
    { weight: 2, build: (_s, r, who) =>
      `The ${who} have a peculiar fondness for ${r.pick(CREATURES)}.` },
    { weight: 1, build: (_s, _r, who) =>
      `The ${who} prefer not to discuss it.` },
    { weight: 2, build: (_s, r, who) =>
      `The ${who} are ${r.pick(FAMOUS_FOR)} their ${r.pick(CREATURE_QUALIFIERS)} ${r.pick(CREATURES)}.` },
  ];

  // Weighted pick: build a flat array proportional to weights and pick once.
  // For our small list this is simpler than maintaining a CDF.
  const pool: typeof weighted = [];
  for (const t of weighted) for (let i = 0; i < t.weight; i++) pool.push(t);
  return rng.pick(pool).build(sys, rng, inhabitants);
}

/* ===========================================================================
   Public API
   =========================================================================== */

/**
 * Generate a 1–2 sentence description for a system. Deterministic from the
 * system's seed; calling it twice with the same system always returns the
 * same text.
 *
 * About 2/3 of systems get two sentences; the other 1/3 get just one. This
 * mix is more interesting than uniform length and matches how the original
 * goat-soup descriptions felt — sometimes a one-liner, sometimes a
 * paragraph.
 */
export function describeSystem(sys: System): string {
  const rng = new DescriptionRng(sys.seed);
  const first = buildSentence1(sys, rng);

  // 2/3 chance of a second sentence. We use the rng directly so the choice
  // is deterministic and reproducible.
  if (rng.chance(0.66)) {
    return first + ' ' + buildSentence2(sys, rng);
  }
  return first;
}
