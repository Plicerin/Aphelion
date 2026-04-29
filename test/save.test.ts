/**
 * Save/load tests.
 *
 * Properties that matter:
 *   - Round trip: save then load returns the same data (cargo, credits,
 *     fuel preserved exactly).
 *   - Empty storage returns null.
 *   - Malformed JSON returns null.
 *   - Wrong shape returns null (no partial application).
 *   - Future versions are rejected.
 *   - Older versions are migrated forward with sensible defaults.
 *   - Storage failures are non-fatal.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { saveGame, loadGame, clearSave } from '../src/sim/save';

const STORAGE_KEY = 'aphelion.save';

const sampleSave = {
  galaxyIdx: 3,
  currentSystemSeed: [0x1234, 0x5678, 0x9abc] as [number, number, number],
  cargo: { food: 5, computers: 2 },
  credits: 4250,
  fuel: 3.5,
  shipHp: 75,
};

describe('save / load', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
  });

  it('returns null when nothing has been saved', () => {
    expect(loadGame()).toBeNull();
  });

  it('round-trips a valid save (cargo, credits, fuel, shipHp preserved)', () => {
    const ok = saveGame(sampleSave);
    expect(ok).toBe(true);
    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.galaxyIdx).toBe(3);
    expect(loaded!.currentSystemSeed).toEqual([0x1234, 0x5678, 0x9abc]);
    expect(loaded!.cargo).toEqual({ food: 5, computers: 2 });
    expect(loaded!.credits).toBe(4250);
    expect(loaded!.fuel).toBe(3.5);
    expect(loaded!.shipHp).toBe(75);
    expect(loaded!.version).toBe(3);
  });

  it('clearSave removes the save', () => {
    saveGame(sampleSave);
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
        version: 2, galaxyIdx: 99, currentSystemSeed: [0, 0, 0],
        cargo: {}, credits: 0, fuel: 0,
      }));
    } catch { return; }
    expect(loadGame()).toBeNull();
  });

  it('rejects a save with a malformed seed triple', () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 2, galaxyIdx: 0, currentSystemSeed: [0, 0],
        cargo: {}, credits: 0, fuel: 0,
      }));
    } catch { return; }
    expect(loadGame()).toBeNull();
  });

  it('rejects a save with seed values out of 16-bit range', () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 2, galaxyIdx: 0, currentSystemSeed: [0, 0, 99999],
        cargo: {}, credits: 0, fuel: 0,
      }));
    } catch { return; }
    expect(loadGame()).toBeNull();
  });

  it('rejects a save from a newer version', () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 999, galaxyIdx: 0, currentSystemSeed: [0, 0, 0],
        cargo: {}, credits: 0, fuel: 0,
      }));
    } catch { return; }
    expect(loadGame()).toBeNull();
  });

  it('migrates a v1 save: applies defaults for cargo / credits / fuel / shipHp', () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1, galaxyIdx: 2, currentSystemSeed: [1, 2, 3],
      }));
    } catch { return; }
    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.galaxyIdx).toBe(2);
    expect(loaded!.cargo).toEqual({});
    expect(loaded!.credits).toBe(100);
    expect(loaded!.fuel).toBe(7);
    expect(loaded!.shipHp).toBe(100);
    expect(loaded!.version).toBe(3);
  });

  it('migrates a v2 save: preserves cargo/credits/fuel and defaults shipHp to 100', () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 2, galaxyIdx: 0, currentSystemSeed: [1, 2, 3],
        cargo: { food: 3 }, credits: 200, fuel: 5,
      }));
    } catch { return; }
    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.cargo).toEqual({ food: 3 });
    expect(loaded!.credits).toBe(200);
    expect(loaded!.fuel).toBe(5);
    expect(loaded!.shipHp).toBe(100);
    expect(loaded!.version).toBe(3);
  });

  it('rejects v3 save with negative shipHp', () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 3, galaxyIdx: 0, currentSystemSeed: [0, 0, 0],
        cargo: {}, credits: 0, fuel: 0, shipHp: -10,
      }));
    } catch { return; }
    expect(loadGame()).toBeNull();
  });

  it('rejects v2+ save with non-object cargo', () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 2, galaxyIdx: 0, currentSystemSeed: [0, 0, 0],
        cargo: 'food', credits: 0, fuel: 0,
      }));
    } catch { return; }
    expect(loadGame()).toBeNull();
  });

  it('rejects v2+ save with array cargo', () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 2, galaxyIdx: 0, currentSystemSeed: [0, 0, 0],
        cargo: [1, 2, 3], credits: 0, fuel: 0,
      }));
    } catch { return; }
    expect(loadGame()).toBeNull();
  });

  it('rejects v2+ save with negative cargo value', () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 2, galaxyIdx: 0, currentSystemSeed: [0, 0, 0],
        cargo: { food: -1 }, credits: 0, fuel: 0,
      }));
    } catch { return; }
    expect(loadGame()).toBeNull();
  });

  it('rejects v2+ save with non-numeric cargo value', () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 2, galaxyIdx: 0, currentSystemSeed: [0, 0, 0],
        cargo: { food: 'lots' }, credits: 0, fuel: 0,
      }));
    } catch { return; }
    expect(loadGame()).toBeNull();
  });

  it('rejects v2+ save with negative credits', () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 2, galaxyIdx: 0, currentSystemSeed: [0, 0, 0],
        cargo: {}, credits: -5, fuel: 0,
      }));
    } catch { return; }
    expect(loadGame()).toBeNull();
  });

  it('rejects v2+ save with infinite credits', () => {
    // JSON.stringify converts Infinity to null, so we have to write the
    // value manually to ensure it's actually infinite when parsed.
    try {
      localStorage.setItem(STORAGE_KEY,
        '{"version":2,"galaxyIdx":0,"currentSystemSeed":[0,0,0],"cargo":{},"credits":1e500,"fuel":0}');
    } catch { return; }
    expect(loadGame()).toBeNull();
  });

  it('rejects v2+ save with negative fuel', () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 2, galaxyIdx: 0, currentSystemSeed: [0, 0, 0],
        cargo: {}, credits: 0, fuel: -2,
      }));
    } catch { return; }
    expect(loadGame()).toBeNull();
  });

  it('save and clear are best-effort and never throw', () => {
    expect(() => saveGame(sampleSave)).not.toThrow();
    expect(() => clearSave()).not.toThrow();
  });
});
