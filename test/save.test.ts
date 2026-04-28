/**
 * Save/load tests.
 *
 * Properties that matter:
 *   - Round trip: save then load returns the same data.
 *   - Empty storage returns null (not undefined, not throw).
 *   - Malformed JSON returns null.
 *   - Wrong shape returns null (no partial application).
 *   - Future versions are rejected.
 *   - Storage failures are non-fatal.
 *   - clearSave actually clears.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { saveGame, loadGame, clearSave } from '../src/sim/save';

const STORAGE_KEY = 'aphelion.save';

describe('save / load', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
  });

  it('returns null when nothing has been saved', () => {
    expect(loadGame()).toBeNull();
  });

  it('round-trips a valid save', () => {
    const ok = saveGame({ galaxyIdx: 3, currentSystemSeed: [0x1234, 0x5678, 0x9abc] });
    expect(ok).toBe(true);
    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.galaxyIdx).toBe(3);
    expect(loaded!.currentSystemSeed).toEqual([0x1234, 0x5678, 0x9abc]);
    expect(loaded!.version).toBe(1);
  });

  it('clearSave removes the save', () => {
    saveGame({ galaxyIdx: 0, currentSystemSeed: [1, 2, 3] });
    expect(loadGame()).not.toBeNull();
    clearSave();
    expect(loadGame()).toBeNull();
  });

  it('rejects malformed JSON', () => {
    try {
      localStorage.setItem(STORAGE_KEY, '{ this is not json }');
    } catch { return; }
    expect(loadGame()).toBeNull();
  });

  it('rejects a save with the wrong shape', () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ hello: 'world' }));
    } catch { return; }
    expect(loadGame()).toBeNull();
  });

  it('rejects a save with out-of-range galaxyIdx', () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1, galaxyIdx: 99, currentSystemSeed: [0, 0, 0],
      }));
    } catch { return; }
    expect(loadGame()).toBeNull();
  });

  it('rejects a save with a malformed seed triple', () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1, galaxyIdx: 0, currentSystemSeed: [0, 0],   // wrong length
      }));
    } catch { return; }
    expect(loadGame()).toBeNull();
  });

  it('rejects a save with seed values out of 16-bit range', () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1, galaxyIdx: 0, currentSystemSeed: [0, 0, 99999],
      }));
    } catch { return; }
    expect(loadGame()).toBeNull();
  });

  it('rejects a save from a newer version', () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 999, galaxyIdx: 0, currentSystemSeed: [0, 0, 0],
      }));
    } catch { return; }
    expect(loadGame()).toBeNull();
  });

  it('save and clear are best-effort and never throw', () => {
    expect(() => saveGame({ galaxyIdx: 0, currentSystemSeed: [0, 0, 0] })).not.toThrow();
    expect(() => clearSave()).not.toThrow();
  });
});
