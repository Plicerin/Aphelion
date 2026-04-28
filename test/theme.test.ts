/**
 * Theme system tests. The interesting properties to lock down:
 *   - Every theme has a hue for every role (no silent missing colors).
 *   - All theme ids are unique (so getTheme is well-defined).
 *   - Hues are valid (0..360).
 *   - Persistence is best-effort and never throws.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  THEMES,
  getTheme,
  loadSavedThemeId,
  saveThemeId,
  type Role,
} from '../src/theme';

const ALL_ROLES: Role[] = [
  'hull', 'cockpit', 'engine', 'laser',
  'planet', 'dust', 'frame', 'dash',
  'system', 'selected', 'grid', 'accent', 'warn',
];

describe('themes', () => {
  it('every theme defines every role', () => {
    for (const theme of THEMES) {
      for (const role of ALL_ROLES) {
        expect(theme.hues[role], `${theme.id} missing ${role}`).toBeDefined();
      }
    }
  });

  it('all hues are valid (0..360)', () => {
    for (const theme of THEMES) {
      for (const role of ALL_ROLES) {
        const h = theme.hues[role];
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThanOrEqual(360);
      }
    }
  });

  it('theme ids are unique', () => {
    const ids = new Set(THEMES.map((t) => t.id));
    expect(ids.size).toBe(THEMES.length);
  });

  it('getTheme returns the requested theme', () => {
    expect(getTheme('phosphor').id).toBe('phosphor');
    expect(getTheme('amber').name).toBe('Amber');
  });

  it('getTheme falls back to default for unknown ids', () => {
    expect(getTheme('not-a-real-theme')).toBe(THEMES[0]);
  });

  it('every theme has a name and description', () => {
    for (const theme of THEMES) {
      expect(theme.name.length).toBeGreaterThan(0);
      expect(theme.description.length).toBeGreaterThan(0);
    }
  });
});

describe('theme persistence', () => {
  // localStorage is provided by jsdom in vitest; if it's not available we
  // expect the load/save functions to no-op gracefully, which is also tested.
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });

  afterEach(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });

  it('returns default when nothing is saved', () => {
    expect(loadSavedThemeId()).toBe(THEMES[0]!.id);
  });

  it('round-trips a saved theme', () => {
    saveThemeId('phosphor');
    expect(loadSavedThemeId()).toBe('phosphor');
  });

  it('ignores invalid stored values', () => {
    try {
      localStorage.setItem('aphelion.theme', 'definitely-not-a-theme');
    } catch {
      return; // localStorage unavailable; test is moot
    }
    expect(loadSavedThemeId()).toBe(THEMES[0]!.id);
  });

  it('saveThemeId never throws', () => {
    expect(() => saveThemeId('any-string-at-all')).not.toThrow();
  });
});
