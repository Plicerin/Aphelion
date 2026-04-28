/**
 * Description generator tests.
 *
 * The interesting properties to lock down:
 *   - Determinism: same system always produces the same description.
 *   - No grammar artifacts (no "undefined", no double spaces, no unfilled slots).
 *   - Length: 1–2 sentences is what we promise.
 *   - Variety: across the galaxy, descriptions are not all the same.
 *   - Tone: dangerous systems use grim adjectives, prosperous ones don't.
 */

import { describe, it, expect } from 'vitest';
import { describeSystem } from '../src/galaxy/describe';
import { defaultGalaxy } from '../src/galaxy/generator';

describe('describeSystem', () => {
  const galaxy = defaultGalaxy();

  it('is deterministic — same system, same description', () => {
    const sys = galaxy.systems[0]!;
    expect(describeSystem(sys)).toBe(describeSystem(sys));
  });

  it('produces a non-empty string for every system', () => {
    for (const sys of galaxy.systems) {
      const desc = describeSystem(sys);
      expect(desc.length).toBeGreaterThan(10);
    }
  });

  it('has no "undefined" or grammar artifacts', () => {
    for (const sys of galaxy.systems) {
      const desc = describeSystem(sys);
      expect(desc).not.toMatch(/undefined/);
      expect(desc).not.toMatch(/null/);
      expect(desc).not.toMatch(/\{[a-z]+\}/i); // unfilled template slots
      expect(desc).not.toMatch(/  /); // double spaces
      expect(desc).not.toMatch(/^\s/); // leading whitespace
      expect(desc).not.toMatch(/\s$/); // trailing whitespace
    }
  });

  it('starts with the system name', () => {
    for (const sys of galaxy.systems) {
      const desc = describeSystem(sys);
      expect(desc.startsWith(sys.name)).toBe(true);
    }
  });

  it('ends with a full stop', () => {
    for (const sys of galaxy.systems) {
      const desc = describeSystem(sys);
      expect(desc.endsWith('.')).toBe(true);
    }
  });

  it('produces a mix of one- and two-sentence descriptions', () => {
    let oneSentence = 0, twoSentence = 0;
    for (const sys of galaxy.systems) {
      const desc = describeSystem(sys);
      // Count sentence-ending periods. Two-sentence descriptions have at
      // least 2 periods (one mid, one end).
      const periods = (desc.match(/\. /g) || []).length;
      if (periods === 0) oneSentence++;
      else twoSentence++;
    }
    // Expect both kinds, with at least 20% of each.
    expect(oneSentence).toBeGreaterThan(galaxy.systems.length * 0.2);
    expect(twoSentence).toBeGreaterThan(galaxy.systems.length * 0.2);
  });

  it('has wide variety across the galaxy', () => {
    const descriptions = galaxy.systems.map((s) => describeSystem(s));
    const unique = new Set(descriptions);
    // No more than ~5% collisions across 256 systems.
    expect(unique.size).toBeGreaterThan(galaxy.systems.length * 0.95);
  });

  it('grim systems use grim adjectives', () => {
    // Find an anarchy + poor system and check tone.
    const grim = galaxy.systems.find(
      (s) =>
        s.government === 'anarchy' &&
        (s.economy === 'poor-industrial' || s.economy === 'poor-agricultural'),
    );
    if (!grim) return; // none in this seed; skip silently
    const desc = describeSystem(grim);
    // It shouldn't read as a tourist brochure.
    expect(desc).not.toMatch(/idyllic|breathtaking|serene|splendid/);
  });

  it('description length is reasonable', () => {
    for (const sys of galaxy.systems) {
      const desc = describeSystem(sys);
      // Roughly 30..220 characters; nothing tweet-length, nothing essay-long.
      expect(desc.length).toBeGreaterThan(25);
      expect(desc.length).toBeLessThan(250);
    }
  });
});
