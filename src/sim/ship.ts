/**
 * Aphelion — ship state and flight model
 *
 * The ship is a simple struct: position, orientation (quaternion),
 * velocity (world-space), and a throttle (0..1). The flight model takes
 * a ship + control inputs + dt and returns a new ship state.
 *
 * Pure functions throughout. The simulation never reads from the DOM, the
 * canvas, or the renderer; it just transforms state. That makes it
 * trivially testable and lets us run it in headless contexts later (AI
 * pilots, save-game replays, multiplayer prediction, etc.).
 *
 * Flight feel notes:
 *   We use "forward-favored" physics, not pure Newtonian. Real Newtonian
 *   in a chase camera is miserable — you keep drifting sideways and have
 *   to constantly counter-thrust. Instead, velocity gradually aligns with
 *   the ship's forward vector (controlled by `velocityAlignRate`), and
 *   throttle controls forward speed directly. This is closer to how Elite
 *   itself flew, and how Star Wars dogfights look on screen.
 */

import {
  qFromAxisAngle,
  qMul,
  qNormalize,
  qRotate,
  Q_IDENTITY,
  vAdd,
  vScale,
  V_FORWARD,
  V_RIGHT,
  V_UP,
  V_ZERO,
  type Quat,
  type Vec3,
} from './vec';

/** The complete state of the player ship at one instant. */
export interface Ship {
  readonly position: Vec3;
  readonly orientation: Quat;
  readonly velocity: Vec3;
  readonly throttle: number;          // 0..1, where 1 is max speed
  readonly speed: number;             // current scalar forward speed
}

/** Per-frame control inputs, all in [-1, 1]. */
export interface Controls {
  readonly pitch: number;        // negative = nose up
  readonly yaw: number;          // negative = nose left
  readonly roll: number;         // negative = roll left
  readonly throttleDelta: number; // change to throttle this frame, e.g. +0.5 if shift held
}

export const NO_CONTROLS: Controls = {
  pitch: 0, yaw: 0, roll: 0, throttleDelta: 0,
};

/** Tunable flight model parameters. Centralized so we can tune feel. */
export interface FlightTuning {
  /** Maximum forward speed at full throttle, units/sec. */
  readonly maxSpeed: number;
  /** How fast the ship reaches its target speed (1/sec). */
  readonly throttleResponse: number;
  /** Maximum pitch/yaw rate, radians/sec. */
  readonly turnRate: number;
  /** Maximum roll rate, radians/sec. */
  readonly rollRate: number;
  /** How fast velocity aligns to the forward vector. Higher = more arcadey. */
  readonly velocityAlignRate: number;
}

export const DEFAULT_TUNING: FlightTuning = {
  maxSpeed: 80,
  throttleResponse: 1.5,
  turnRate: 1.2,
  rollRate: 2.0,
  velocityAlignRate: 4.0,
};

/** Initial ship state — at origin, facing +Z, stationary. */
export const INITIAL_SHIP: Ship = {
  position: V_ZERO,
  orientation: Q_IDENTITY,
  velocity: V_ZERO,
  throttle: 0,
  speed: 0,
};

/**
 * Advance the ship by dt seconds given current controls.
 *
 * Order of operations matters and is chosen to feel right rather than be
 * physically rigorous:
 *   1. Adjust throttle from input (clamp 0..1).
 *   2. Rotate the orientation by per-axis angular velocities.
 *   3. Move speed toward target (throttle * maxSpeed).
 *   4. Bend velocity toward the new forward vector (the "forward-favored"
 *      bit).
 *   5. Translate position by velocity.
 *
 * The angular update applies pitch and yaw in the ship's local frame —
 * pitching always tilts the nose relative to its current "up", so the
 * controls feel intuitive at any orientation. Roll likewise.
 */
export function stepShip(
  ship: Ship,
  controls: Controls,
  dt: number,
  tuning: FlightTuning = DEFAULT_TUNING,
): Ship {
  // 1. Throttle. Clamp to [0, 1].
  const throttle = Math.max(0, Math.min(1, ship.throttle + controls.throttleDelta * dt));

  // 2. Orientation. Each input becomes an axis-angle rotation in the ship's
  //    local frame, then we compose them onto the existing orientation.
  //    Sign convention: negative pitch tips the nose up (+Y forward),
  //    negative yaw swings the nose left (-X forward), negative roll
  //    banks left. This matches typical flight-stick semantics.
  const pitchQ = qFromAxisAngle(V_RIGHT,   controls.pitch * tuning.turnRate * dt);
  const yawQ   = qFromAxisAngle(V_UP,      controls.yaw   * tuning.turnRate * dt);
  const rollQ  = qFromAxisAngle(V_FORWARD, controls.roll  * tuning.rollRate * dt);

  // Compose: world * (yaw * pitch * roll)  — local rotations apply on the right.
  let orientation = qMul(ship.orientation, qMul(yawQ, qMul(pitchQ, rollQ)));
  orientation = qNormalize(orientation);

  // 3. Speed: ease toward (throttle * maxSpeed) at throttleResponse rate.
  const targetSpeed = throttle * tuning.maxSpeed;
  const speedAlpha = 1 - Math.exp(-tuning.throttleResponse * dt);
  const speed = ship.speed + (targetSpeed - ship.speed) * speedAlpha;

  // 4. Velocity: bend toward the ship's forward direction at velocityAlignRate.
  //    This is what gives the ship its arcadey feel — without it you'd keep
  //    sliding in your old direction after turning.
  const forward = qRotate(orientation, V_FORWARD);
  const targetVel = vScale(forward, speed);
  const alignAlpha = 1 - Math.exp(-tuning.velocityAlignRate * dt);
  const velocity: Vec3 = [
    ship.velocity[0] + (targetVel[0] - ship.velocity[0]) * alignAlpha,
    ship.velocity[1] + (targetVel[1] - ship.velocity[1]) * alignAlpha,
    ship.velocity[2] + (targetVel[2] - ship.velocity[2]) * alignAlpha,
  ];

  // 5. Position: integrate velocity.
  const position = vAdd(ship.position, vScale(velocity, dt));

  return { position, orientation, velocity, throttle, speed };
}
