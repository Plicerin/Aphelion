/**
 * Aphelion — save / load
 *
 * Persists a minimal slice of game state to localStorage so progress
 * survives reloads. The saved shape is intentionally narrow: only things
 * the player has *earned* or *chosen* go in. Everything that's a function
 * of the seed (galaxies, descriptions, planet visuals) regenerates;
 * everything that's transient (hyperspace timer, ship velocity, screen)
 * resets to a sensible default.
 *
 * Forward compatibility:
 *   The save format includes a `version` integer. When we add new fields
 *   we bump it and migrate old saves in `loadGame`. Saves from a newer
 *   version than we know about are discarded — better to start fresh
 *   than to half-load a save we can't fully understand. Saves from older
 *   versions are migrated forward by filling missing fields with the
 *   defaults below.
 *
 * Privacy:
 *   localStorage is per-origin. Anything we save is visible only to the
 *   site that created it. The storage layer is best-effort: every read
 *   and write is wrapped in try/catch so private-mode browsers just
 *   don't persist, rather than crashing.
 */

import type { SeedTriple } from '../types';

const STORAGE_KEY = 'aphelion.save';
const SAVE_VERSION = 2;

/** Default values for v2 fields when migrating from v1. */
const DEFAULT_CREDITS = 100;
const DEFAULT_FUEL = 7;

/**
 * The persistent slice of game state. Anything not in this struct does
 * not survive a reload and starts fresh.
 */
export interface SaveData {
  readonly version: number;
  readonly galaxyIdx: number;
  readonly currentSystemSeed: SeedTriple;
  /** Per-commodity holdings keyed by commodity id. v2+. */
  readonly cargo: Readonly<Record<string, number>>;
  /** Currency balance. v2+. */
  readonly credits: number;
  /** Fuel in light-years. v2+. */
  readonly fuel: number;
}

/** Write a save. Returns true on success, false if storage is unavailable. */
export function saveGame(data: Omit<SaveData, 'version'>): boolean {
  try {
    const payload: SaveData = { version: SAVE_VERSION, ...data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * Read a save. Returns SaveData or null if the save is missing, malformed,
 * or from a future version. Older versions are migrated forward.
 */
export function loadGame(): SaveData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return validateAndMigrate(parsed);
  } catch {
    return null;
  }
}

/** Delete the save. Best-effort. */
export function clearSave(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */

function validateAndMigrate(x: unknown): SaveData | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (typeof o.version !== 'number') return null;
  if (o.version > SAVE_VERSION) return null;

  // Common v1+ fields
  if (typeof o.galaxyIdx !== 'number' || o.galaxyIdx < 0 || o.galaxyIdx > 7) return null;
  if (!Array.isArray(o.currentSystemSeed) || o.currentSystemSeed.length !== 3) return null;
  for (const v of o.currentSystemSeed) {
    if (typeof v !== 'number' || v < 0 || v > 0xffff) return null;
  }

  // v2+ fields. For v1 saves we apply defaults.
  let cargo: Record<string, number> = {};
  let credits: number = DEFAULT_CREDITS;
  let fuel: number = DEFAULT_FUEL;

  if (o.version >= 2) {
    if (!o.cargo || typeof o.cargo !== 'object' || Array.isArray(o.cargo)) return null;
    const cargoObj = o.cargo as Record<string, unknown>;
    for (const k of Object.keys(cargoObj)) {
      const v = cargoObj[k];
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null;
    }
    cargo = { ...(cargoObj as Record<string, number>) };

    if (typeof o.credits !== 'number' || !Number.isFinite(o.credits) || o.credits < 0) return null;
    credits = o.credits;

    if (typeof o.fuel !== 'number' || !Number.isFinite(o.fuel) || o.fuel < 0) return null;
    fuel = o.fuel;
  }

  return {
    version: SAVE_VERSION,
    galaxyIdx: o.galaxyIdx,
    currentSystemSeed: o.currentSystemSeed as unknown as SeedTriple,
    cargo, credits, fuel,
  };
}
