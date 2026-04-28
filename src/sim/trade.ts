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
}

/** Default cargo capacity for the starting ship (Cobra Mk III). */
export const CARGO_CAPACITY = 40;

/** Starting credits balance for a fresh game. */
export const INITIAL_CREDITS = 100;

export const COMMODITIES: readonly Commodity[] = [
  { id: 'food',         name: 'Food',          glyph: '[#]',   basePrice: 12,  unit: 't'  },
  { id: 'textiles',     name: 'Textiles',      glyph: '<~~>',  basePrice: 18,  unit: 't'  },
  { id: 'radioactives', name: 'Radioactives',  glyph: '<*>',   basePrice: 32,  unit: 't'  },
  { id: 'indentured',   name: 'Indentured',    glyph: '(o-o)', basePrice: 28,  unit: 't'  },
  { id: 'liquor',       name: 'Liquor & Wines',glyph: '[V]',   basePrice: 24,  unit: 't'  },
  { id: 'luxuries',     name: 'Luxuries',      glyph: '<*~*>', basePrice: 78,  unit: 't'  },
  { id: 'narcotics',    name: 'Narcotics',     glyph: '[?]',   basePrice: 95,  unit: 't'  },
  { id: 'computers',    name: 'Computers',     glyph: '[::]',  basePrice: 64,  unit: 't'  },
  { id: 'machinery',    name: 'Machinery',     glyph: '[#=]',  basePrice: 56,  unit: 't'  },
  { id: 'alloys',       name: 'Alloys',        glyph: '<==>',  basePrice: 32,  unit: 't'  },
  { id: 'firearms',     name: 'Firearms',      glyph: '<!>',   basePrice: 50,  unit: 't'  },
  { id: 'furs',         name: 'Furs',          glyph: '}~{',   basePrice: 28,  unit: 't'  },
  { id: 'minerals',     name: 'Minerals',      glyph: '<.>',   basePrice: 16,  unit: 't'  },
  { id: 'gold',         name: 'Gold',          glyph: '(Au)',  basePrice: 4,   unit: 'kg' },
  { id: 'platinum',     name: 'Platinum',      glyph: '(Pt)',  basePrice: 8,   unit: 'kg' },
  { id: 'gemstones',    name: 'Gem-Stones',    glyph: '<◇>',   basePrice: 12,  unit: 'kg' },
  { id: 'alien',        name: 'Alien Items',   glyph: '<?!>',  basePrice: 60,  unit: 't'  },
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
