/**
 * Tests for the game state reducer.
 *
 * Properties to verify:
 *   - reduce is pure (no mutation of input).
 *   - select-system stages a destination.
 *   - begin-hyperspace requires a selected system.
 *   - arrive-in-system promotes selected to current.
 *   - set-galaxy clears any pending selection.
 */

import { describe, it, expect } from 'vitest';
import { reduce, type GameState } from '../src/sim/state';
import { INITIAL_SHIP } from '../src/sim/ship';

const baseState: GameState = {
  screen: 'chart',
  galaxyIdx: 0,
  currentSystemSeed: null,
  selectedSystemSeed: null,
  ship: INITIAL_SHIP,
  hyperspaceT: 0,
};

describe('state reducer', () => {
  it('reduce is pure: input state is not mutated', () => {
    const before = { ...baseState };
    reduce(baseState, { type: 'select-system', seed: [1, 2, 3] });
    expect(baseState).toEqual(before);
  });

  it('select-system stages a destination', () => {
    const next = reduce(baseState, { type: 'select-system', seed: [10, 20, 30] });
    expect(next.selectedSystemSeed).toEqual([10, 20, 30]);
    expect(next.screen).toBe('chart'); // doesn't change screens
  });

  it('begin-hyperspace requires a selected system', () => {
    const noSelection = reduce(baseState, { type: 'begin-hyperspace' });
    expect(noSelection).toEqual(baseState); // no-op

    const withSelection = reduce(
      { ...baseState, selectedSystemSeed: [1, 2, 3] },
      { type: 'begin-hyperspace' },
    );
    expect(withSelection.screen).toBe('hyperspace');
    expect(withSelection.hyperspaceT).toBe(0);
  });

  it('arrive-in-system promotes selected to current', () => {
    const inHyperspace: GameState = {
      ...baseState,
      screen: 'hyperspace',
      selectedSystemSeed: [5, 6, 7],
      hyperspaceT: 0.95,
    };
    const arrived = reduce(inHyperspace, { type: 'arrive-in-system' });
    expect(arrived.screen).toBe('flight');
    expect(arrived.currentSystemSeed).toEqual([5, 6, 7]);
    expect(arrived.selectedSystemSeed).toBeNull();
    expect(arrived.hyperspaceT).toBe(1);
  });

  it('open-chart switches screen without losing system state', () => {
    const inFlight: GameState = {
      ...baseState,
      screen: 'flight',
      currentSystemSeed: [9, 9, 9],
    };
    const onChart = reduce(inFlight, { type: 'open-chart' });
    expect(onChart.screen).toBe('chart');
    expect(onChart.currentSystemSeed).toEqual([9, 9, 9]);
  });

  it('set-galaxy clears the pending selection', () => {
    const withSelection: GameState = {
      ...baseState,
      selectedSystemSeed: [1, 2, 3],
    };
    const switched = reduce(withSelection, { type: 'set-galaxy', galaxyIdx: 3 });
    expect(switched.galaxyIdx).toBe(3);
    expect(switched.selectedSystemSeed).toBeNull();
  });
});
