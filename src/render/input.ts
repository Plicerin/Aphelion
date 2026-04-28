/**
 * Aphelion — keyboard input
 *
 * A small layer that tracks which keys are currently held and produces a
 * `Controls` object each frame. This is the only place in the codebase
 * that talks to the keyboard API; the simulation never sees raw events.
 *
 * The mapping is intentionally a table that can later be rebound by the
 * settings page. For now the defaults are:
 *
 *   W / S        — pitch nose down / up
 *   A / D        — yaw left / right
 *   Q / E        — roll left / right
 *   Shift        — throttle up
 *   Ctrl         — throttle down
 *   Arrow keys   — alternate pitch/yaw (for keyboards without WASD comfort)
 *
 * Why "W = nose down"? In flight games, pushing the stick forward dips
 * the nose. W is the "forward" key. This matches MS Flight Sim, Elite
 * Dangerous, and most arcade flight games.
 */

import type { Controls } from '../sim/ship';

/** Logical input axes the game reads. */
export type Axis = 'pitchDown' | 'pitchUp' | 'yawLeft' | 'yawRight'
                 | 'rollLeft' | 'rollRight' | 'throttleUp' | 'throttleDown';

/** Default keybinds. Each axis can have multiple keys mapped to it. */
export const DEFAULT_BINDS: Readonly<Record<Axis, readonly string[]>> = {
  pitchDown:  ['KeyW', 'ArrowUp'],
  pitchUp:    ['KeyS', 'ArrowDown'],
  yawLeft:    ['KeyA', 'ArrowLeft'],
  yawRight:   ['KeyD', 'ArrowRight'],
  rollLeft:   ['KeyQ'],
  rollRight:  ['KeyE'],
  throttleUp:   ['ShiftLeft', 'ShiftRight'],
  throttleDown: ['ControlLeft', 'ControlRight'],
};

/**
 * Tracks held keys and emits Controls. Construct one, attach listeners,
 * and call sample() each frame. Detach when done to avoid leaking.
 */
export class KeyboardInput {
  private held = new Set<string>();
  private binds: Readonly<Record<Axis, readonly string[]>>;

  constructor(binds = DEFAULT_BINDS) {
    this.binds = binds;
  }

  attach(target: Window | HTMLElement = window): () => void {
    const onDown = (e: Event) => {
      const ke = e as KeyboardEvent;
      // Don't intercept keys when the player is typing in an input/textarea.
      const t = ke.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      this.held.add(ke.code);
      // Prevent arrow keys from scrolling the page while we have focus.
      if (ke.code.startsWith('Arrow')) ke.preventDefault();
    };
    const onUp = (e: Event) => {
      const ke = e as KeyboardEvent;
      this.held.delete(ke.code);
    };
    const onBlur = () => this.held.clear();

    target.addEventListener('keydown', onDown);
    target.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      target.removeEventListener('keydown', onDown);
      target.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }

  /** Is any key bound to this axis currently held? */
  isHeld(axis: Axis): boolean {
    for (const code of this.binds[axis]) {
      if (this.held.has(code)) return true;
    }
    return false;
  }

  /** Compute current Controls from held keys. */
  sample(): Controls {
    const pitch = (this.isHeld('pitchUp')   ? 1 : 0) - (this.isHeld('pitchDown') ? 1 : 0);
    const yaw   = (this.isHeld('yawRight')  ? 1 : 0) - (this.isHeld('yawLeft')   ? 1 : 0);
    const roll  = (this.isHeld('rollRight') ? 1 : 0) - (this.isHeld('rollLeft')  ? 1 : 0);
    // Throttle is delta — held shift means "increase throttle".
    const throttleDelta =
      (this.isHeld('throttleUp')   ? 1 : 0) -
      (this.isHeld('throttleDown') ? 1 : 0);
    return { pitch, yaw, roll, throttleDelta };
  }
}
