/**
 * Tests for the small vector / quaternion library.
 *
 * The properties that matter:
 *   - Basic vector operations are correct.
 *   - Quaternion rotation matches axis-angle expectation.
 *   - Quaternion composition is order-sensitive (this is intentional).
 *   - Normalization keeps unit length stable through many compositions.
 */

import { describe, it, expect } from 'vitest';
import {
  Q_IDENTITY,
  V_FORWARD,
  V_RIGHT,
  V_UP,
  qFromAxisAngle,
  qMul,
  qNormalize,
  qRotate,
  vAdd,
  vCross,
  vDot,
  vLength,
  vNormalize,
  vScale,
  vSub,
} from '../src/sim/vec';

const EPS = 1e-6;

function vClose(a: readonly number[], b: readonly number[]) {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) {
    expect(Math.abs(a[i]! - b[i]!)).toBeLessThan(EPS);
  }
}

describe('vec3', () => {
  it('add and sub', () => {
    vClose(vAdd([1, 2, 3], [4, 5, 6]), [5, 7, 9]);
    vClose(vSub([4, 5, 6], [1, 2, 3]), [3, 3, 3]);
  });

  it('scale', () => {
    vClose(vScale([1, 2, 3], 2), [2, 4, 6]);
  });

  it('dot product', () => {
    expect(vDot([1, 0, 0], [0, 1, 0])).toBe(0);     // orthogonal
    expect(vDot([1, 2, 3], [1, 2, 3])).toBe(14);    // length squared
  });

  it('cross product follows right-hand rule', () => {
    vClose(vCross(V_RIGHT, V_UP), V_FORWARD);
    vClose(vCross(V_UP, V_FORWARD), V_RIGHT);
    vClose(vCross(V_FORWARD, V_RIGHT), V_UP);
  });

  it('length and normalize', () => {
    expect(vLength([3, 4, 0])).toBe(5);
    vClose(vNormalize([3, 4, 0]), [0.6, 0.8, 0]);
    vClose(vNormalize([0, 0, 0]), [0, 0, 0]);   // safe on zero
  });
});

describe('quat rotation', () => {
  it('identity leaves vectors unchanged', () => {
    vClose(qRotate(Q_IDENTITY, [1, 2, 3]), [1, 2, 3]);
  });

  it('90° around Y rotates +X to -Z', () => {
    // In a right-handed system, rotating +X by 90° around +Y goes to -Z.
    const q = qFromAxisAngle(V_UP, Math.PI / 2);
    vClose(qRotate(q, V_RIGHT), [0, 0, -1]);
  });

  it('90° around X rotates +Z to -Y', () => {
    const q = qFromAxisAngle(V_RIGHT, Math.PI / 2);
    vClose(qRotate(q, V_FORWARD), [0, -1, 0]);
  });

  it('180° rotation flips a vector', () => {
    const q = qFromAxisAngle(V_UP, Math.PI);
    vClose(qRotate(q, V_FORWARD), [0, 0, -1]);
  });
});

describe('quat composition', () => {
  it('composing identity is identity', () => {
    const q = qFromAxisAngle(V_UP, 0.7);
    vClose(qMul(Q_IDENTITY, q), q);
    vClose(qMul(q, Q_IDENTITY), q);
  });

  it('composition is order-sensitive', () => {
    // Rotating yaw-then-pitch is not the same as pitch-then-yaw.
    const yaw   = qFromAxisAngle(V_UP,    1.0);
    const pitch = qFromAxisAngle(V_RIGHT, 1.0);
    const a = qRotate(qMul(yaw, pitch), V_FORWARD);
    const b = qRotate(qMul(pitch, yaw), V_FORWARD);
    // They should differ — gimbal lock is not at play here, just non-commutativity.
    let differ = false;
    for (let i = 0; i < 3; i++) if (Math.abs(a[i]! - b[i]!) > 1e-3) differ = true;
    expect(differ).toBe(true);
  });

  it('normalize keeps unit length under repeated composition', () => {
    let q = Q_IDENTITY;
    const small = qFromAxisAngle(V_UP, 0.01);
    for (let i = 0; i < 10000; i++) q = qNormalize(qMul(q, small));
    const len = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
    expect(Math.abs(len - 1)).toBeLessThan(1e-9);
  });
});
