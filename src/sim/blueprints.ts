/**
 * Aphelion — ship blueprints
 *
 * Wireframe geometry + role/stats for every ship in the game. Blueprints
 * are pure data — the renderer in `src/render/` (or its inline mirror in
 * index.html) consumes them. Each ship is defined in its own local
 * coordinate system: +Z forward (nose), +Y up, +X right. Units are
 * arbitrary; the renderer scales by `defaultScale` to fit the world.
 *
 * Edge format: each edge is `[v1, v2, face1, face2]`. The two face
 * indices are used for back-face culling: the edge is visible if either
 * adjoining face's normal faces the camera. -1 in either slot means
 * "no adjoining face on that side" (the edge is always drawn).
 *
 * Face format: each face is its outward normal vector. Magnitudes are
 * arbitrary — the renderer compares signs after rotation, not lengths.
 *
 * The Cobra Mk III is our player's ship; everything else is built for
 * v0.2 combat as a starting NPC roster (fighter, pirate, police, freighter).
 */

import type { Vec3 } from './vec';

export type ShipRole = 'trader' | 'fighter' | 'pirate' | 'police' | 'freighter';

/** Edge: [vertexA, vertexB, faceA, faceB]. Face index can be -1 if none. */
export type Edge = readonly [number, number, number, number];

export interface ShipBlueprint {
  readonly id: string;
  readonly name: string;
  readonly role: ShipRole;
  /** Vertices in ship-local coordinates. +Z forward, +Y up, +X right. */
  readonly vertices: readonly Vec3[];
  /** Edges as [v1, v2, face1, face2] — face indices used for back-face cull. */
  readonly edges: readonly Edge[];
  /** Face outward normals; sign-only comparisons after rotation. */
  readonly faces: readonly Vec3[];
  /** Render scale to fit world units (Cobra at 0.0025 is the reference). */
  readonly defaultScale: number;
  /** Hit points before destruction. Higher = sturdier. */
  readonly maxHull: number;
  /** Maximum scalar speed (world units / sec). */
  readonly maxSpeed: number;
  /** Cargo capacity in tonnes. Player's Cobra defines CARGO_CAPACITY. */
  readonly cargoCapacity: number;
}

/* ===========================================================================
   COBRA MK III — the player's ship.
   Geometry from the publicly-released Elite ship blueprints (annotated by
   bbcelite.com). Vertex coordinates are facts about the model's geometry,
   not creative expression — which is why we feel comfortable reusing them.
   28 vertices, 38 edges, 13 faces.
   =========================================================================== */
const COBRA_VERTICES: readonly Vec3[] = [
  [  32,    0,   76], [ -32,    0,   76], [   0,   26,   24],
  [-120,   -3,   -8], [ 120,   -3,   -8], [ -88,   16,  -40],
  [  88,   16,  -40], [ 128,   -8,  -40], [-128,   -8,  -40],
  [   0,   26,  -40], [ -32,  -24,  -40], [  32,  -24,  -40],
  [ -36,    8,  -40], [  -8,   12,  -40], [   8,   12,  -40],
  [  36,    8,  -40], [  36,  -12,  -40], [   8,  -16,  -40],
  [  -8,  -16,  -40], [ -36,  -12,  -40], [   0,    0,   76],
  [   0,    0,   90], [ -80,   -6,  -40], [ -80,    6,  -40],
  [ -88,    0,  -40], [  80,    6,  -40], [  88,    0,  -40],
  [  80,   -6,  -40],
];
const COBRA_EDGES: readonly Edge[] = [
  [ 0, 1, 0,11], [ 0, 4, 4,12], [ 1, 3, 3,10], [ 3, 8, 7,10], [ 4, 7, 8,12],
  [ 6, 7, 8, 9], [ 6, 9, 6, 9], [ 5, 9, 5, 9], [ 5, 8, 7, 9], [ 2, 5, 1, 5],
  [ 2, 6, 2, 6], [ 3, 5, 3, 7], [ 4, 6, 4, 8], [ 1, 2, 0, 1], [ 0, 2, 0, 2],
  [ 8,10, 9,10], [10,11, 9,11], [ 7,11, 9,12], [ 1,10,10,11], [ 0,11,11,12],
  [ 1, 5, 1, 3], [ 0, 6, 2, 4], [12,13, 9, 9], [18,19, 9, 9], [14,15, 9, 9],
  [16,17, 9, 9], [15,16, 9, 9], [14,17, 9, 9], [13,18, 9, 9], [12,19, 9, 9],
  [ 2, 9, 5, 6], [22,24, 9, 9], [23,24, 9, 9], [22,23, 9, 9], [25,26, 9, 9],
  [26,27, 9, 9], [25,27, 9, 9],
];
const COBRA_FACES: readonly Vec3[] = [
  [   0,  62,  31], [ -18,  55,  16], [  18,  55,  16], [ -16,  52,  14], [  16,  52,  14],
  [ -14,  47,   0], [  14,  47,   0], [ -61, 102,   0], [  61, 102,   0], [   0,   0, -80],
  [  -7, -42,   9], [   0, -30,   6], [   7, -42,   9],
];

export const COBRA_MK_III: ShipBlueprint = {
  id: 'cobra3',
  name: 'Cobra Mk III',
  role: 'trader',
  vertices: COBRA_VERTICES,
  edges: COBRA_EDGES,
  faces: COBRA_FACES,
  defaultScale: 0.0025,
  maxHull: 100,
  maxSpeed: 80,
  cargoCapacity: 40,
};

/* ===========================================================================
   SHRIKE — small fast fighter. Original Aphelion geometry: a diamond-section
   wedge with two short wings sweeping back. 8 vertices, 14 edges, 6 faces.
   =========================================================================== */
export const SHRIKE: ShipBlueprint = {
  id: 'shrike',
  name: 'Shrike',
  role: 'fighter',
  vertices: [
    [   0,   0,  60],   // 0: nose
    [ -16,   8, -20],   // 1: rear-top-left
    [  16,   8, -20],   // 2: rear-top-right
    [ -16,  -8, -20],   // 3: rear-bot-left
    [  16,  -8, -20],   // 4: rear-bot-right
    [ -48,   0, -16],   // 5: left wingtip
    [  48,   0, -16],   // 6: right wingtip
    [   0,   0, -28],   // 7: rear engine pinch
  ],
  edges: [
    [ 0, 1,  0,  4], [ 0, 2,  0,  1], [ 0, 3,  3,  4], [ 0, 4,  1,  3],
    [ 1, 2,  0, -1], [ 3, 4,  3, -1], [ 1, 3,  4, -1], [ 2, 4,  1, -1],
    [ 1, 5,  4,  0], [ 3, 5,  4,  3], [ 2, 6,  0,  1], [ 4, 6,  1,  3],
    [ 5, 7,  4,  3], [ 6, 7,  0,  1],
  ],
  faces: [
    [   0,  20,  10],   // 0: top-right
    [  20,   0,  10],   // 1: right
    [  20, -20,   5],   // 2: rear-right (placeholder)
    [   0, -20,  10],   // 3: bottom
    [ -20,   0,  10],   // 4: left
    [   0,   0, -30],   // 5: rear (placeholder)
  ],
  defaultScale: 0.0040,
  maxHull: 60,
  maxSpeed: 95,
  cargoCapacity: 5,
};

/* ===========================================================================
   WRAITH — wide, flat pirate. Manta-ray silhouette, original Aphelion
   geometry. 12 vertices, 18 edges, 8 faces.
   =========================================================================== */
export const WRAITH: ShipBlueprint = {
  id: 'wraith',
  name: 'Wraith',
  role: 'pirate',
  vertices: [
    [   0,   0,  64],   // 0: nose
    [ -56,   0,  -8],   // 1: left wingtip
    [  56,   0,  -8],   // 2: right wingtip
    [ -20,   8, -32],   // 3: rear-top-left
    [  20,   8, -32],   // 4: rear-top-right
    [ -20,  -8, -32],   // 5: rear-bot-left
    [  20,  -8, -32],   // 6: rear-bot-right
    [ -16,   0, -40],   // 7: left engine
    [  16,   0, -40],   // 8: right engine
    [   0,  10,   8],   // 9: dorsal hump
    [ -32,   2, -16],   // 10: left fin
    [  32,   2, -16],   // 11: right fin
  ],
  edges: [
    [ 0, 1,  0,  4], [ 0, 2,  1,  3], [ 0, 9,  0,  1], [ 9, 3,  0,  2],
    [ 9, 4,  1,  2], [ 1, 3,  4,  2], [ 2, 4,  3,  2], [ 3, 4,  2, -1],
    [ 1, 5,  4,  5], [ 2, 6,  3,  6], [ 5, 6,  5,  6], [ 5, 7,  5,  7],
    [ 6, 8,  6,  7], [ 7, 8,  7, -1], [10, 1,  4, -1], [10, 5,  5, -1],
    [11, 2,  3, -1], [11, 6,  6, -1],
  ],
  faces: [
    [ -20,  20,  20],   // 0: front-top-left
    [  20,  20,  20],   // 1: front-top-right
    [   0,  20, -10],   // 2: rear-top
    [  20, -20,  20],   // 3: front-bot-right
    [ -20, -20,  20],   // 4: front-bot-left
    [ -20, -20, -10],   // 5: rear-bot-left
    [  20, -20, -10],   // 6: rear-bot-right
    [   0,   0, -40],   // 7: rear
  ],
  defaultScale: 0.0035,
  maxHull: 80,
  maxSpeed: 90,
  cargoCapacity: 15,
};

/* ===========================================================================
   SENTINEL — police interceptor. Long thin dart with rear stabilisers.
   Original Aphelion geometry. 10 vertices, 16 edges, 7 faces.
   =========================================================================== */
export const SENTINEL: ShipBlueprint = {
  id: 'sentinel',
  name: 'Sentinel',
  role: 'police',
  vertices: [
    [   0,   0,  72],   // 0: nose
    [ -10,   6, -16],   // 1: rear-top-left
    [  10,   6, -16],   // 2: rear-top-right
    [ -10,  -6, -16],   // 3: rear-bot-left
    [  10,  -6, -16],   // 4: rear-bot-right
    [ -28,   0, -28],   // 5: left wingtip rear
    [  28,   0, -28],   // 6: right wingtip rear
    [   0,  20, -20],   // 7: top stabiliser tip
    [   0, -20, -20],   // 8: bottom stabiliser tip
    [   0,   0, -32],   // 9: engine
  ],
  edges: [
    [ 0, 1,  0,  4], [ 0, 2,  0,  1], [ 0, 3,  3,  4], [ 0, 4,  1,  3],
    [ 1, 2,  0, -1], [ 3, 4,  3, -1], [ 1, 3,  4, -1], [ 2, 4,  1, -1],
    [ 1, 5,  4,  6], [ 3, 5,  4,  6], [ 2, 6,  1,  5], [ 4, 6,  3,  5],
    [ 1, 7,  0, -1], [ 2, 7,  0, -1], [ 3, 8,  3, -1], [ 4, 8,  3, -1],
  ],
  faces: [
    [   0,  20,  20],   // 0: top
    [  20,   0,  20],   // 1: front-right
    [  10,   0, -20],   // 2: rear-right (unused, placeholder)
    [   0, -20,  20],   // 3: bottom
    [ -20,   0,  20],   // 4: front-left
    [  10, -20, -10],   // 5: rear-bot-right
    [ -10, -20, -10],   // 6: rear-bot-left
  ],
  defaultScale: 0.0030,
  maxHull: 75,
  maxSpeed: 100,
  cargoCapacity: 5,
};

/* ===========================================================================
   HAULER — bulk freighter. Long boxy hull, two engine pods at the rear.
   Original Aphelion geometry. 12 vertices, 18 edges, 6 faces.
   =========================================================================== */
export const HAULER: ShipBlueprint = {
  id: 'hauler',
  name: 'Hauler',
  role: 'freighter',
  vertices: [
    [ -28,  -10,  56],  // 0: front-bot-left
    [  28,  -10,  56],  // 1: front-bot-right
    [ -28,   10,  56],  // 2: front-top-left
    [  28,   10,  56],  // 3: front-top-right
    [ -28,  -10, -48],  // 4: rear-bot-left
    [  28,  -10, -48],  // 5: rear-bot-right
    [ -28,   10, -48],  // 6: rear-top-left
    [  28,   10, -48],  // 7: rear-top-right
    [ -20,    0, -64],  // 8: left engine
    [  20,    0, -64],  // 9: right engine
    [   0,   16,   0],  // 10: dorsal ridge
    [   0,  -16,   0],  // 11: ventral ridge
  ],
  edges: [
    [ 0, 1,  3, -1], [ 1, 3,  1, -1], [ 3, 2,  0, -1], [ 2, 0,  4, -1],
    [ 4, 5,  3,  5], [ 5, 7,  1,  5], [ 7, 6,  0,  5], [ 6, 4,  4,  5],
    [ 0, 4,  3,  4], [ 1, 5,  1,  3], [ 2, 6,  0,  4], [ 3, 7,  0,  1],
    [ 4, 8,  5,  3], [ 6, 8,  5,  4], [ 5, 9,  5,  3], [ 7, 9,  5,  1],
    [ 8, 9,  5, -1], [10,11,  0, -1],
  ],
  faces: [
    [   0,  20,   0],   // 0: top
    [  20,   0,   0],   // 1: right
    [   0,   0,  20],   // 2: front (unused, placeholder)
    [   0, -20,   0],   // 3: bottom
    [ -20,   0,   0],   // 4: left
    [   0,   0, -20],   // 5: rear
  ],
  defaultScale: 0.0025,
  maxHull: 200,
  maxSpeed: 50,
  cargoCapacity: 100,
};

export const SHIPS: readonly ShipBlueprint[] = [
  COBRA_MK_III,
  SHRIKE,
  WRAITH,
  SENTINEL,
  HAULER,
];

/** Look up a ship blueprint by id. */
export function findShip(id: string): ShipBlueprint | undefined {
  return SHIPS.find(s => s.id === id);
}
