# Aphelion — Handover Document

A briefing for picking up Aphelion development in a new session (Claude Code, Claude Desktop with filesystem MCP, or future you).

## What Aphelion is

A glowing-ASCII space trading game inspired by Elite (1984) and Effulgence RPG (2025). Single-player, browser-based, ships as a single self-contained HTML file. Clean-room reimplementation — no copyrighted code from the original Elite, just inspiration and the publicly-released ship blueprint data (vertex coordinates, which aren't copyrightable).

The aesthetic conceit: you are receiving fragmented signals from a galaxy too far away to image directly, decoded into glowing characters.

## Where the project stands

**Pre-alpha. The chart-to-flight game loop works end to end:** explore eight procedural galaxies on a glowing-ASCII chart, click to lock a system as a jump target, see a flyout with the system name and distance, click engage, watch a 3-second countdown, then a hyperspace tunnel transition, then arrive at the destination's sun and planet. Fly around in 6DOF with WASD/QE/Shift. Switch between six visual themes. Save persists across reloads.

**23 commits on `main`. 78 tests passing across 7 test files.**

## Architecture

```
src/
  types.ts                 — public types (System, Galaxy, SeedTriple, Economy, Government)
  theme.ts                 — palette system + persistence
  galaxy/
    twist.ts               — Fibonacci-style seed twist + galaxy rotation
    names.ts               — system + galaxy name generation
    generator.ts           — 256-system galaxy assembly with property derivation
    describe.ts            — recursive grammar for 1-2 sentence flavor text
  sim/
    vec.ts                 — vector / quaternion math (right-handed, +Z forward)
    ship.ts                — flight model (forward-favored, not strict Newtonian)
    state.ts               — game state reducer for screen transitions
    save.ts                — localStorage save/load with strict validation
  render/
    input.ts               — keyboard input layer (rebindable)
test/
  *.test.ts                — 78 tests
index.html                 — the game (single-file app, mirrors src/ inline)
```

The TS source under `src/` is the canonical version of every module. `index.html` mirrors them inline so the game runs without a build step. When we move to a build pipeline, `index.html` becomes the entry point that imports from `src/`.

## Key design decisions worth preserving

**Single-file delivery.** Target: under 200 KB gzipped, ideally under 100 KB. A small homage to the 22 KB original. This means no React, no game engine, no heavy dependencies. Every dependency added needs to justify itself against this constraint.

**Clean-room implementation.** The ship blueprint vertex data is from `bbcelite.com`'s annotated source — that's facts about geometry, not creative expression. Everything else (galaxy generation, descriptions, theme system, flight model, render pipeline) was written from conceptual descriptions, not ported from any specific implementation. Original syllable tables, original grammar productions, original bit-extraction layout for system properties.

**Pure simulation, dumb renderer.** The sim layer (`src/sim/`) is pure functions on plain data. No DOM access, no canvas access, no audio. Renderer reads from state and draws. This keeps testing trivial and lets us add things like AI pilots or save replays later without restructuring.

**Glowing ASCII pipeline.** Every visible glyph belongs to a "role" (hull, dust, planet, dash, etc.). Themes map roles to colors. The renderer:
1. Builds an intensity grid per color bucket
2. For each cell, picks the brightest contributing layer
3. Draws the glyph at sharp intensity to main canvas + offscreen
4. Stamps the offscreen back over the canvas with progressive blur in `lighter` blend mode (4 passes: blur 2, 6, 16, 36px)

**Per-color bloom buckets** are critical. Without them, orange engine glow + cyan hull glow average to muddy beige in the blur. Each color renders to its own offscreen canvas and blooms independently before compositing.

**Brightest-wins per cell.** When two roles try to write to the same cell, keep the brighter one's color rather than blending. Blending hues in ASCII produces unreadable in-betweens.

**Forward-favored flight model.** Velocity bends toward the ship's forward vector at `velocityAlignRate: 4.0`. Strict Newtonian physics in a chase camera is miserable; this gives Elite-style feel without inertial drift.

**Quaternions for orientation.** Avoids gimbal lock, composes cleanly. Renormalize every frame.

**Deterministic everything.** Same seed → same galaxy → same names → same descriptions → same planet visuals → same arrival positioning. Two players who launch Aphelion fresh see the same starting system (Geka, in galaxy Meris). Save format only stores the seeds, not derived data.

**Strict save validation.** Saves are best-effort and never throw. Malformed JSON, wrong shape, out-of-range values, future versions all fall back to a fresh start. Half-loading a corrupted save is the kind of bug that wastes hours later.

## v0.1 status

Done:
- Galaxy generator (8 × 256 systems, deterministic)
- Galactic chart with click-to-lock + countdown + flyout
- Goat-soup-style description generator (recursive grammar with weighted templates)
- Hyperspace tunnel transition
- First-person cockpit flight (WASD/QE/Shift, dust streaks, cockpit frame, crosshair)
- Sun and planet rendered in flight on arrival
- Six themes with persistence (Cyan, Green Phosphor, Amber Monochrome, Cyan & Amber, Magenta Synthwave, Full Color)
- Save game in localStorage

Remaining for v0.1:
- **Coriolis station** — rotating wireframe octagon with docking slot. Visually iconic, gives flight somewhere to go, prerequisite for trade.
- **Trade screen** — 17 commodities with supply/demand price model. Buy at one station, sell at another based on economy mismatch. Market screen rendered in glowing ASCII.
- **More ship blueprints** — currently only the Cobra Mk III. Need at least Sidewinder, Mamba, Viper, Python for v0.2 combat.

After v0.1, roadmap progression is in `docs/roadmap.md`.

## Things to push to GitHub when set up

The repo is ready to push. The MIT license has a placeholder copyright holder ("Aphelion contributors") that should be replaced with the real author's name.

Recommended first repo settings after creation:
- Enable GitHub Pages (source: `main`, root folder) for a live `https://USER.github.io/aphelion/` URL
- Add topics: `ascii`, `space-game`, `typescript`, `canvas`, `elite`, `effulgence`
- Description: "A glowing-ASCII space trading game"

## Things deliberately NOT done

- Multiplayer — would change everything; v2 territory
- 3D solid-shaded ships — the wireframe glow IS the aesthetic
- Fixed campaign / story — procedural emergent narrative is the point
- Real-name copyrighted material from Elite (Lave, Diso, Coriolis-the-trademark, etc.)
- Microtransactions or unlockables — it's a game, not a service

## Open questions for the next session

- **Settings page.** Theme picker currently lives top-left on every screen. Should move to a dedicated settings overlay along with future controls (UI scale, sound volume, key rebinding, save management). Started discussing this; deferred.
- **Distance scale.** Set at 0.5 LY per chart unit, gives 4-8 LY for typical neighbor jumps. Will need adjustment when fuel costs are added.
- **Planet projection in flight.** Current implementation uses camera-aligned axes for surface speckles rather than a properly rotated sphere. Looks fine for distant planets but breaks down close. Polish-pass item.
- **Dashboard scanner.** The flight cockpit has empty space at the bottom where the elliptical 3D scanner should go. Iconic Elite UI. Should add when there are NPCs to track.

## Useful references

- `bbcelite.com` — Mark Moxon's annotated 6502 source for every Elite version. Deep-dive articles on the design decisions, especially `/deep_dives/ship_blueprints.html` and `/deep_dives/drawing_ships.html`.
- Effulgence RPG on Steam — proves glowing ASCII can carry a modern game. Worth playing for inspiration.
- The original Cobra Mk III blueprint (28 vertices, 38 edges, 13 faces) is in `index.html` as the canonical reference shape.

## How to continue

To pick up where we left off, the natural next move is the **Coriolis station**. Suggested approach:

1. Add a `Station` type to `types.ts` (position, orientation, rotation rate, has-dock flag)
2. Place one station per system, position derived from system seed (deterministic)
3. Render in flight as a wireframe octagon — 8 vertices forming a regular octagonal cross-section, two of those rings stacked along the rotation axis
4. The whole structure rotates slowly around its main axis (the "Coriolis spin" that gives passengers gravity in the original Elite lore)
5. One face has the docking slot — a hole through which the ship enters
6. Docking detection: if ship is inside a small volume on the docking-face axis with low velocity and aligned orientation, dock successfully. Otherwise crash.

After that, the trade screen, then the rest of the ship roster.
