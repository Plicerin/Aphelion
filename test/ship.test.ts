/**
 * Tests for the flight model.
 *
 * Properties to verify:
 *   - A stationary ship with no input stays stationary.
 *   - Throttle increases speed asymptotically toward maxSpeed.
 *   - Pitch input rotates the forward vector toward +Y or -Y.
 *   - Yaw input rotates the forward vector toward ±X.
 *   - After turning, velocity gradually realigns with the new forward.
 *   - Repeated stepping doesn't blow up numerically.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TUNING,
  INITIAL_SHIP,
  NO_CONTROLS,
  stepShip,
  type Controls,
} from '../src/sim/ship';
import { qRotate, V_FORWARD } from '../src/sim/vec';

describe('ship flight model', () => {
  it('a stationary ship with no input stays stationary', () => {
    let ship = INITIAL_SHIP;
    for (let i = 0; i < 100; i++) ship = stepShip(ship, NO_CONTROLS, 0.016);
    expect(ship.position).toEqual([0, 0, 0]);
    expect(ship.speed).toBe(0);
  });

  it('throttle increases speed toward maxSpeed', () => {
    let ship = { ...INITIAL_SHIP, throttle: 1.0 };
    // After 5 seconds of full throttle, speed should be near maxSpeed.
    for (let i = 0; i < 300; i++) ship = stepShip(ship, NO_CONTROLS, 1 / 60);
    expect(ship.speed).toBeGreaterThan(DEFAULT_TUNING.maxSpeed * 0.95);
    expect(ship.speed).toBeLessThanOrEqual(DEFAULT_TUNING.maxSpeed);
  });

  it('zero throttle decays speed toward zero', () => {
    let ship = { ...INITIAL_SHIP, throttle: 0, speed: DEFAULT_TUNING.maxSpeed };
    for (let i = 0; i < 600; i++) ship = stepShip(ship, NO_CONTROLS, 1 / 60);
    expect(ship.speed).toBeLessThan(0.5);
  });

  it('pitch input rotates the nose up or down', () => {
    // Negative pitch = nose up. After half a second, forward should have +Y.
    let ship = INITIAL_SHIP;
    const c: Controls = { ...NO_CONTROLS, pitch: -1 };
    for (let i = 0; i < 30; i++) ship = stepShip(ship, c, 1 / 60);
    const fwd = qRotate(ship.orientation, V_FORWARD);
    expect(fwd[1]).toBeGreaterThan(0.3);   // nose tipped up
  });

  it('yaw input rotates the nose left or right', () => {
    // Negative yaw = nose left. After half a second, forward should have -X.
    let ship = INITIAL_SHIP;
    const c: Controls = { ...NO_CONTROLS, yaw: -1 };
    for (let i = 0; i < 30; i++) ship = stepShip(ship, c, 1 / 60);
    const fwd = qRotate(ship.orientation, V_FORWARD);
    expect(fwd[0]).toBeLessThan(-0.3);    // nose swung left
  });

  it('velocity realigns with forward after a turn', () => {
    // Fly forward, then yaw, then fly forward again. Velocity should
    // eventually point in the new forward direction.
    let ship = { ...INITIAL_SHIP, throttle: 1 };
    for (let i = 0; i < 60; i++) ship = stepShip(ship, NO_CONTROLS, 1 / 60);
    // Yaw 90° left
    const yawing: Controls = { ...NO_CONTROLS, yaw: -1 };
    for (let i = 0; i < 90; i++) ship = stepShip(ship, yawing, 1 / 60);
    // Fly forward in new direction for a while
    for (let i = 0; i < 120; i++) ship = stepShip(ship, NO_CONTROLS, 1 / 60);

    const fwd = qRotate(ship.orientation, V_FORWARD);
    // Velocity direction should be close to forward direction.
    const vMag = Math.hypot(ship.velocity[0], ship.velocity[1], ship.velocity[2]);
    if (vMag > 0.1) {
      const vDir = [ship.velocity[0] / vMag, ship.velocity[1] / vMag, ship.velocity[2] / vMag];
      const dot = fwd[0] * vDir[0] + fwd[1] * vDir[1] + fwd[2] * vDir[2];
      expect(dot).toBeGreaterThan(0.9);
    }
  });

  it('repeated stepping does not produce NaN', () => {
    let ship = { ...INITIAL_SHIP, throttle: 1 };
    const tumble: Controls = { pitch: 0.7, yaw: 0.5, roll: 0.3, throttleDelta: 0 };
    for (let i = 0; i < 10000; i++) ship = stepShip(ship, tumble, 1 / 60);
    for (const v of [...ship.position, ...ship.orientation, ...ship.velocity]) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});
