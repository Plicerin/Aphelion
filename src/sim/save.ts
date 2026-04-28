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
 *   version than we know about are discarded (with a warning) — better
 *   to start fresh than to half-load a save we can't fully understand.
 *
 * Privacy:
 *   localStorage is per-origin. Anything we save is visible only to the
 *   site that created it. We never serialize anything sensitive (there
 *   isn't anything sensitive to save), and the storage layer is best-
 *   effort: every read/write is wrapped in try/catch so private-mode
 *   browsers just don't persist, rather than crashing.
 */

import type { SeedTriple } from '../types';

const STORAGE_KEY = 'aphelion.save';
const SAVE_VERSION = 1;

/**
 * The persistent slice of game state. Anything not in this struct does
 * not survive a reload and starts fresh.
 *
 * Keep this struct small and explicit. When we add new persistent fields
 * (credits, cargo, kills, etc.) they go here; transient fields like
 * `hyperspaceT` or `selectedSystemSeed` deliberately don't.
 */
export interface SaveData {
  /** Save format version. Bump on breaking schema changes. */
  readonly version: number;

  /** Which galaxy the player was last exploring on the chart. */
  readonly galaxyIdx: number;

  /** Which system the player is currently parked at. */
  readonly currentSystemSeed: SeedTriple;
}

/**
 * Write a save to localStorage. Returns true on success, false if storage
 * is unavailable. Never throws.
 */
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
 * Read a save from localStorage. Returns the SaveData or null if there's
 * no save, the save is malformed, or the version is unknown. Never throws.
 *
 * Validation is strict: any field missing or of the wrong type means we
 * treat the save as missing rather than partially apply it. Half-applying
 * a corrupted save is the kind of bug that wastes hours later.
 */
export function loadGame(): SaveData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidSave(parsed)) return null;
    if (parsed.version > SAVE_VERSION) {
      // Save is from a newer version than we know how to read. Discard.
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Delete the save. Useful for "new game" actions or for users who want
 * a clean slate. Best-effort.
 */
export function clearSave(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Strict shape check. We do this rather than trust JSON.parse because a
 * malformed save (truncated, hand-edited, from a different game on the
 * same key) would otherwise produce silent runtime errors deep in the
 * renderer. Better to detect and start fresh.
 */
function isValidSave(x: unknown): x is SaveData {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (typeof o.version !== 'number') return false;
  if (typeof o.galaxyIdx !== 'number') return false;
  if (o.galaxyIdx < 0 || o.galaxyIdx > 7) return false;
  if (!Array.isArray(o.currentSystemSeed)) return false;
  if (o.currentSystemSeed.length !== 3) return false;
  for (const v of o.currentSystemSeed) {
    if (typeof v !== 'number') return false;
    if (v < 0 || v > 0xffff) return false;
  }
  return true;
}
