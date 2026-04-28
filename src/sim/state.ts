/**
 * Aphelion — game state
 *
 * The persistent state shared across screens. The screen manager owns one
 * of these; each screen reads what it needs and writes back through
 * dispatched actions rather than mutating directly. Pure-ish: we update
 * by replacing the whole struct each frame, but the renderer reads it
 * directly without re-allocating.
 */

import type { Ship } from './ship';
import type { SeedTriple } from '../types';

/** Which screen is currently active. */
export type ScreenId = 'chart' | 'hyperspace' | 'flight';

/**
 * The complete app state. Anything that needs to survive a screen change
 * lives here.
 */
export interface GameState {
  readonly screen: ScreenId;

  /** The galaxy index (0..7) the player is currently exploring. */
  readonly galaxyIdx: number;

  /** The system the player is currently parked in. Null at game start. */
  readonly currentSystemSeed: SeedTriple | null;

  /** The system the player has selected on the chart as a jump target. */
  readonly selectedSystemSeed: SeedTriple | null;

  /** The player's ship. */
  readonly ship: Ship;

  /**
   * Hyperspace progress, 0..1. Only meaningful when screen === 'hyperspace'.
   * 0 = just departed, 1 = arrived. The screen manager runs the timer and
   * advances this each frame; the tunnel renderer reads it.
   */
  readonly hyperspaceT: number;
}

/** Actions the screens can dispatch. The screen manager applies them. */
export type Action =
  | { type: 'select-system'; seed: SeedTriple }
  | { type: 'begin-hyperspace' }
  | { type: 'arrive-in-system' }
  | { type: 'open-chart' }
  | { type: 'set-galaxy'; galaxyIdx: number };

/**
 * Apply an action to a state, returning a new state. Pure function — no
 * side effects, no DOM, no audio. Side effects (sounds, screen transitions
 * with timing) live in the screen manager.
 */
export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'select-system':
      return { ...state, selectedSystemSeed: action.seed };

    case 'begin-hyperspace':
      // Only valid if a destination is selected. If not, no-op.
      if (!state.selectedSystemSeed) return state;
      return { ...state, screen: 'hyperspace', hyperspaceT: 0 };

    case 'arrive-in-system':
      return {
        ...state,
        screen: 'flight',
        currentSystemSeed: state.selectedSystemSeed,
        selectedSystemSeed: null,
        hyperspaceT: 1,
      };

    case 'open-chart':
      return { ...state, screen: 'chart' };

    case 'set-galaxy':
      return { ...state, galaxyIdx: action.galaxyIdx, selectedSystemSeed: null };
  }
}
