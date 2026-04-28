/**
 * Aphelion — trade commodities
 *
 * The 17 commodities you can buy and sell at trade anchors. The data
 * here is the *shape* only — names, glyph icons, base prices, units.
 * The per-system price model and cargo / credits state live alongside
 * but are added in a follow-up pass when the real economy lands.
 *
 * Names track the classic Elite commodity list because the trade
 * loop they enable is the loop we're building. Glyphs are original
 * — short ASCII tokens chosen so each commodity reads as an icon.
 */

/** Units commodities are weighed in. Tonnes for bulk goods, kg for precious. */
export type CommodityUnit = 't' | 'kg';

export interface Commodity {
  /** Stable id — used as a key in the cargo state dictionary. */
  readonly id: string;
  /** Display name. */
  readonly name: string;
  /** Short ASCII icon. 4–7 characters; rendered in the trade screen. */
  readonly glyph: string;
  /** Galactic-average price in credits per unit. Real per-system price
   *  is derived in the price model from this + system economy/gov/tech. */
  readonly basePrice: number;
  readonly unit: CommodityUnit;
  /**
   * Agri-vs-industrial bias.
   *  -1 = pure agricultural good (cheap in agri, expensive in industrial).
   *  +1 = pure industrial good (cheap in industrial, expensive in agri).
   *  0  = neutral (precious metals, alien items).
   */
  readonly gradient: number;
  /**
   * Tech-level price effect.
   *  Negative = cheaper at higher TL (computers, machinery).
   *  Positive = more expensive at higher TL (rarely used).
   *  0  = no tech-level effect.
   */
  readonly techBias: number;
}

/** Default cargo capacity for the starting ship (Cobra Mk III). */
export const CARGO_CAPACITY = 40;

/** Starting credits balance for a fresh game. */
export const INITIAL_CREDITS = 100;

export const COMMODITIES: readonly Commodity[] = [
  { id: 'food',         name: 'Food',          glyph: '[#]',   basePrice: 12, unit: 't',  gradient: -0.8, techBias:  0    },
  { id: 'textiles',     name: 'Textiles',      glyph: '<~~>',  basePrice: 18, unit: 't',  gradient: -0.5, techBias:  0    },
  { id: 'radioactives', name: 'Radioactives',  glyph: '<*>',   basePrice: 32, unit: 't',  gradient:  0.3, techBias: -0.1  },
  { id: 'indentured',   name: 'Indentured',    glyph: '(o-o)', basePrice: 28, unit: 't',  gradient:  0.2, techBias:  0    },
  { id: 'liquor',       name: 'Liquor & Wines',glyph: '[V]',   basePrice: 24, unit: 't',  gradient: -0.6, techBias:  0    },
  { id: 'luxuries',     name: 'Luxuries',      glyph: '<*~*>', basePrice: 78, unit: 't',  gradient:  0.2, techBias:  0    },
  { id: 'narcotics',    name: 'Narcotics',     glyph: '[?]',   basePrice: 95, unit: 't',  gradient:  0.4, techBias:  0    },
  { id: 'computers',    name: 'Computers',     glyph: '[::]',  basePrice: 64, unit: 't',  gradient:  0.8, techBias: -0.3  },
  { id: 'machinery',    name: 'Machinery',     glyph: '[#=]',  basePrice: 56, unit: 't',  gradient:  0.7, techBias: -0.2  },
  { id: 'alloys',       name: 'Alloys',        glyph: '<==>',  basePrice: 32, unit: 't',  gradient:  0.6, techBias: -0.1  },
  { id: 'firearms',     name: 'Firearms',      glyph: '<!>',   basePrice: 50, unit: 't',  gradient:  0.5, techBias: -0.1  },
  { id: 'furs',         name: 'Furs',          glyph: '}~{',   basePrice: 28, unit: 't',  gradient: -0.6, techBias:  0    },
  { id: 'minerals',     name: 'Minerals',      glyph: '<.>',   basePrice: 16, unit: 't',  gradient: -0.3, techBias:  0    },
  { id: 'gold',         name: 'Gold',          glyph: '(Au)',  basePrice: 4,  unit: 'kg', gradient:  0,    techBias:  0    },
  { id: 'platinum',     name: 'Platinum',      glyph: '(Pt)',  basePrice: 8,  unit: 'kg', gradient:  0,    techBias:  0    },
  { id: 'gemstones',    name: 'Gem-Stones',    glyph: '<◇>',   basePrice: 12, unit: 'kg', gradient:  0.1, techBias:  0    },
  { id: 'alien',        name: 'Alien Items',   glyph: '<?!>',  basePrice: 60, unit: 't',  gradient:  0.4, techBias:  0    },
];

/** Lookup a commodity by id; undefined if not found. */
export function findCommodity(id: string): Commodity | undefined {
  return COMMODITIES.find(c => c.id === id);
}

/** Initial cargo state — dictionary keyed by commodity id, all zero. */
export function emptyCargo(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of COMMODITIES) out[c.id] = 0;
  return out;
}

/** Total tonnes (kg counted as 0 for cargo capacity — matches Elite). */
export function cargoUsed(cargo: Record<string, number>): number {
  let total = 0;
  for (const c of COMMODITIES) {
    if (c.unit === 't') total += cargo[c.id] || 0;
  }
  return total;
}

/* =========================================================================
   PRICE MODEL
   -------------------------------------------------------------------------
   Per-system price for a commodity, derived from:
     - basePrice (galactic average)
     - economy axis (industrial ↔ agricultural; tilts up to ±50%)
     - tech level (cheap or expensive in high-TL systems; up to ±30%)
     - per-system flux (deterministic ±10% pseudo-random from system seed)
   The result is rounded to whole credits and floored at 1.
   ========================================================================= */

import type { Economy, SeedTriple, System } from '../types';

/** Industrial-vs-agricultural index 0..7 used by the economy gradient.
 *  0..3 = industrial (rich → mainly), 4..7 = agricultural (mainly → poor). */
const ECONOMY_INDEX: Record<Economy, number> = {
  'rich-industrial':       0,
  'average-industrial':    1,
  'poor-industrial':       2,
  'mainly-industrial':     3,
  'mainly-agricultural':   4,
  'rich-agricultural':     5,
  'average-agricultural':  6,
  'poor-agricultural':     7,
};

/** Deterministic per-(system, commodity) flux in [-0.10, +0.10]. */
function priceFlux(seed: SeedTriple, commodityId: string): number {
  let h = 0x9e3779b1;
  for (let i = 0; i < commodityId.length; i++) {
    h = ((h ^ commodityId.charCodeAt(i)) * 16777619) | 0;
  }
  h ^= seed[0];
  h = ((h * 31) ^ seed[1]) | 0;
  h = ((h * 31) ^ seed[2]) | 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return ((h % 2001) - 1000) / 10000;     // -0.10 .. +0.10
}

/** Per-system price for a commodity. Always returns a positive integer. */
export function priceForSystem(commodity: Commodity, system: System): number {
  const econIdx = ECONOMY_INDEX[system.economy];
  // econMod: -1 (most industrial) .. +1 (most agricultural).
  const econMod = (econIdx - 3.5) / 3.5;
  const econFactor = 1 + 0.5 * commodity.gradient * econMod;
  const techFactor = 1 + commodity.techBias * (system.techLevel - 8) / 7;
  const flux = priceFlux(system.seed, commodity.id);
  const raw = commodity.basePrice * econFactor * techFactor * (1 + flux);
  return Math.max(1, Math.round(raw));
}

/* =========================================================================
   TRANSACTIONS
   -------------------------------------------------------------------------
   Pure gates and apply functions. The reducer / UI calls canBuy + applyBuy
   together. n is always a positive integer (caller's responsibility).
   ========================================================================= */

/** True if the player can afford and store n units of a commodity at `price`. */
export function canBuy(
  price: number,
  n: number,
  cargoTonnesUsed: number,
  capacity: number,
  credits: number,
  isTonne: boolean,
): boolean {
  if (n < 1) return false;
  if (credits < price * n - 1e-9) return false;
  if (isTonne && cargoTonnesUsed + n > capacity) return false;
  return true;
}

/** True if the player has at least n of the given commodity to sell. */
export function canSell(held: number, n: number): boolean {
  return n >= 1 && held >= n;
}

/** Apply a buy: returns the new (cargo, credits). Caller must gate via canBuy. */
export function applyBuy(
  cargo: Record<string, number>,
  credits: number,
  commodityId: string,
  n: number,
  price: number,
): { cargo: Record<string, number>; credits: number } {
  return {
    cargo: { ...cargo, [commodityId]: (cargo[commodityId] || 0) + n },
    credits: credits - price * n,
  };
}

/** Apply a sell: returns the new (cargo, credits). Caller must gate via canSell. */
export function applySell(
  cargo: Record<string, number>,
  credits: number,
  commodityId: string,
  n: number,
  price: number,
): { cargo: Record<string, number>; credits: number } {
  return {
    cargo: { ...cargo, [commodityId]: (cargo[commodityId] || 0) - n },
    credits: credits + price * n,
  };
}
