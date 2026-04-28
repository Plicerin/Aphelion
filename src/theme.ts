/**
 * Aphelion — themes
 *
 * Every visible glyph in Aphelion belongs to a "role" — hull, dust, planet,
 * frame, dash, accent, warn, etc. — and a theme maps each role to a hue.
 * The renderer's per-color bloom buckets work off these role names, so
 * adding a new theme is just a matter of adding a new entry below.
 *
 * Hues are HSL hue values (0..360). Saturation and lightness are kept
 * mostly fixed in the renderer; the theme decides only color identity.
 *
 * Design rationale: themes are tables, not code. We never want a theme to
 * override how something is drawn, only what color it's drawn in. That
 * keeps the rendering layer dumb and the styling layer flexible.
 */

export type Role =
  | 'hull'      // ship wireframes, cobra outline
  | 'cockpit'   // canopy, viewport edges
  | 'engine'    // thruster glow
  | 'laser'     // weapon fire
  | 'planet'    // limb arcs and surface features
  | 'dust'      // foreground stardust streaks
  | 'frame'     // cockpit window frame, crosshair
  | 'dash'      // dashboard text and gauges
  | 'system'    // chart system markers (default)
  | 'selected'  // chart cursor target / highlighted UI element
  | 'grid'      // background reference grid
  | 'accent'    // primary HUD accent / "your" color
  | 'warn';     // alerts, low-tech systems, danger

/**
 * A color in a theme. The minimal form is just a hue (a number); for themes
 * that want more control we accept a full HSL triple. The renderer treats
 * a bare number as `{ h: n, s: 90, l: 60 }` — matching how all themes
 * looked before this option existed.
 *
 * This keeps all the existing single-hue themes one-line entries while
 * allowing the realistic theme to vary saturation and lightness per role.
 */
export type ThemeColor = number | { h: number; s: number; l: number };

/** A theme is just a map from role to color. */
export type Theme = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly hues: Readonly<Record<Role, ThemeColor>>;
};

/** Resolve a ThemeColor to a full HSL triple, applying defaults. */
export function resolveColor(c: ThemeColor): { h: number; s: number; l: number } {
  return typeof c === 'number' ? { h: c, s: 90, l: 60 } : c;
}

/**
 * The five built-in themes. Order matters — this is the order they appear
 * in the picker.
 */
export const THEMES: readonly Theme[] = [
  {
    id: 'cyan',
    name: 'Cyan',
    description: 'The default. Cool blues with subtle amber accents.',
    hues: {
      hull: 195, cockpit: 38, engine: 12, laser: 320,
      planet: 195, dust: 200, frame: 195, dash: 38,
      system: 195, selected: 38, grid: 195,
      accent: 195, warn: 12,
    },
  },
  {
    id: 'phosphor',
    name: 'Green Phosphor',
    description: 'Green CRT — the look of the original 8-bit space sims.',
    hues: {
      hull: 110, cockpit: 75, engine: 50, laser: 140,
      planet: 110, dust: 100, frame: 110, dash: 75,
      system: 110, selected: 75, grid: 110,
      accent: 110, warn: 50,
    },
  },
  {
    id: 'amber',
    name: 'Amber Monochrome',
    description: 'Warm single-hue, like an old monitor at 3 AM.',
    hues: {
      hull: 38, cockpit: 30, engine: 12, laser: 50,
      planet: 38, dust: 45, frame: 38, dash: 30,
      system: 38, selected: 30, grid: 38,
      accent: 38, warn: 12,
    },
  },
  {
    id: 'ember',
    name: 'Cyan & Amber',
    description: 'Cyan ship, warm amber HUD. The classic cockpit look.',
    hues: {
      hull: 195, cockpit: 195, engine: 18, laser: 0,
      planet: 28, dust: 210, frame: 195, dash: 28,
      system: 195, selected: 28, grid: 200,
      accent: 28, warn: 0,
    },
  },
  {
    id: 'plasma',
    name: 'Magenta Synthwave',
    description: 'Synthwave magentas and violets. Use sparingly.',
    hues: {
      hull: 290, cockpit: 320, engine: 280, laser: 60,
      planet: 290, dust: 270, frame: 290, dash: 320,
      system: 290, selected: 320, grid: 280,
      accent: 320, warn: 60,
    },
  },
  {
    id: 'spectrum',
    name: 'Full Color',
    description: 'Every role rendered in its natural hue.',
    hues: {
      hull:     { h: 210, s: 25, l: 75 },
      cockpit:  { h: 175, s: 40, l: 70 },
      engine:   { h:  18, s: 95, l: 60 },
      laser:    { h: 340, s: 95, l: 65 },
      planet:   { h: 195, s: 55, l: 60 },
      dust:     { h: 210, s: 15, l: 88 },
      frame:    { h:  30, s: 20, l: 60 },
      dash:     { h: 130, s: 75, l: 60 },
      system:   { h:  50, s: 25, l: 85 },
      selected: { h:  38, s: 95, l: 65 },
      grid:     { h: 210, s: 30, l: 50 },
      accent:   { h:  38, s: 90, l: 65 },
      warn:     { h:   0, s: 95, l: 60 },
    },
  },
];

const STORAGE_KEY = 'aphelion.theme';

/** Look up a theme by id, falling back to the default. */
export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!;
}

/**
 * Read the saved theme id from localStorage. Returns the default theme id
 * if nothing is stored or storage is unavailable (private browsing, etc).
 */
export function loadSavedThemeId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && THEMES.some((t) => t.id === stored)) return stored;
  } catch {
    // localStorage may throw in some contexts (private mode, sandboxed iframe).
    // We don't care — just fall through to the default.
  }
  return THEMES[0]!.id;
}

/** Persist the player's theme choice. Silently no-ops if storage is unavailable. */
export function saveThemeId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Same reasoning as loadSavedThemeId — best effort, never throws.
  }
}
