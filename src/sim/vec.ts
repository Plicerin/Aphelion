/**
 * Aphelion — vector math
 *
 * Tiny 3D vector / quaternion primitives, just enough for the flight model.
 * We avoid pulling in gl-matrix or three.js because the surface area we
 * actually use is small (a dozen functions) and a hand-rolled module is
 * easier to read, test, and reason about.
 *
 * Conventions:
 *   - Right-handed coordinate system.
 *   - +X right, +Y up, +Z forward (toward the viewer).
 *   - All functions are pure: they return new values rather than mutating.
 *   - Quaternions are [x, y, z, w]; identity is [0, 0, 0, 1].
 */

export type Vec3 = readonly [number, number, number];
export type Quat = readonly [number, number, number, number];

export const V_ZERO: Vec3 = [0, 0, 0];
export const V_FORWARD: Vec3 = [0, 0, 1];
export const V_UP: Vec3 = [0, 1, 0];
export const V_RIGHT: Vec3 = [1, 0, 0];
export const Q_IDENTITY: Quat = [0, 0, 0, 1];

/* ---------- Vec3 ---------- */

export function vAdd(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
export function vSub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
export function vScale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}
export function vDot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
export function vCross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
export function vLength(a: Vec3): number {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
}
export function vNormalize(a: Vec3): Vec3 {
  const len = vLength(a);
  if (len < 1e-9) return V_ZERO;
  return [a[0] / len, a[1] / len, a[2] / len];
}

/* ---------- Quat ----------
   We use quaternions for ship orientation because they avoid gimbal lock
   and compose cleanly. Most flight games run into trouble using Euler
   angles directly: pitch + yaw + roll combined produce a rotation that
   depends on application order, and pitching past 90° flips the world.
   Quaternions sidestep both issues.                                      */

/** Rotate vector v by quaternion q. */
export function qRotate(q: Quat, v: Vec3): Vec3 {
  // Standard formula: q * v * q^-1, expanded for performance.
  const [x, y, z, w] = q;
  const [vx, vy, vz] = v;
  // t = 2 * (q.xyz × v)
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  // result = v + w*t + q.xyz × t
  return [
    vx + w * tx + (y * tz - z * ty),
    vy + w * ty + (z * tx - x * tz),
    vz + w * tz + (x * ty - y * tx),
  ];
}

/** Multiply two quaternions: result = a * b (apply b first, then a). */
export function qMul(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

/** Quaternion representing rotation by `angle` radians around `axis`. */
export function qFromAxisAngle(axis: Vec3, angle: number): Quat {
  const half = angle * 0.5;
  const s = Math.sin(half);
  const n = vNormalize(axis);
  return [n[0] * s, n[1] * s, n[2] * s, Math.cos(half)];
}

/** Renormalize a quaternion to unit length. Numerical drift accumulates
 *  after many compositions, so we do this every frame on ship orientation. */
export function qNormalize(q: Quat): Quat {
  const len = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
  if (len < 1e-9) return Q_IDENTITY;
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}
