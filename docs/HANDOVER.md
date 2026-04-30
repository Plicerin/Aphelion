# Aphelion — Handover Document

A briefing for picking up Aphelion development in a new session.

## Latest session update — 2026-04-30

**Main branch is pushed at:** `2cbfb2f Add glowing glyph planet renderer`

The major lesson from the glow investigation is settled: **glyph placement was not the hard problem; the Effulgence-like look comes from a broad coloured light field behind/around the glyphs.** Post-process bloom, raw per-glyph `shadowBlur`, WebGL bloom, and a WebGPU detour all produced either no visible glow, blinding white blobs, circular/square artifacts, or a too-geometric washed-out surface.

The useful prototype is `refs/glyph-lab.html` in the local worktree. It demonstrated the desired look by separating:

1. crisp/baked glyph sprites,
2. dense structured glyph placement for ocean/land/coast,
3. a low-resolution coloured surface-glow field that is upscaled and additively composited,
4. stable deterministic rotation rather than frame-dependent random motion.

That approach was integrated into the actual flight renderer in `index.html` behind:

```js
const NEW_PLANET_RENDERER = true;
```

The in-game path now projects the real system planet, preserves the existing planet occluder, skips the old grid planet when the flag is enabled, and draws the new canvas glyph/glow planet before the cockpit mask. The old sphere-projected grid renderer is still present as the fallback path if `NEW_PLANET_RENDERER` is flipped to `false`.

Performance note: the new planet renderer redraws the offscreen planet image at roughly 24 fps and composites the cached canvas every frame. This is a pragmatic bridge, not the final renderer. If performance is still low, the next improvement should be algorithmic/caching work on this canvas path, not another WebGPU rewrite.

Validation from this session:

- `npm run build` passes.
- `http://127.0.0.1:5173/` responded locally.
- Full `npm test` was not rerun after the final integration. Earlier in the glow-debug session it reported all 272 tests passing but then Vitest/Node crashed during teardown with `v8::ToLocalChecked Empty MaybeLocal`, so do not claim a clean test exit until rerun.

Local worktree after the commit/push:

```text
 M package-lock.json
?? refs/
```

Those were intentionally left out of the commit. `refs/` contains visual lab/reference work including `glyph-lab.html` and `glyph-lab-webgpu.html`; do not delete it casually. `glyph-lab-webgpu.html` is an experiment only and the user rejected its look.

### Current next step

Open the live game at `http://127.0.0.1:5173/` or `https://plicerin.github.io/Aphelion/` after GitHub Pages updates and judge the in-flight planet visually and by frame rate.

If the look is acceptable but performance is bad, optimize this renderer:

- cache full planet frames for more than one frame bucket,
- render the light field at even lower resolution,
- reduce glyph density based on projected radius,
- pre-bake glyph tiles without relying on `shadowBlur`,
- update the planet image only when rotation advances enough to matter visually.

If the look is still wrong, go back to `refs/glyph-lab.html`, not WebGPU. The lab is the closest known match.

## What Aphelion is

A glowing-ASCII space trading game inspired by Elite (1984) and Effulgence RPG (2025). Single-player, browser-based, ships as a single self-contained HTML file. Clean-room reimplementation — no copyrighted code from the original Elite, just inspiration and the publicly-released ship blueprint data.

The aesthetic conceit: you are receiving fragmented signals from a galaxy too far away to image directly, decoded into glowing characters.

## Where the project stands

**Pre-alpha. v0.2 combat is done; v0.1 game loop is fully working.** The full play loop now exists end-to-end:

1. Galactic chart → click a system → engage → hyperspace tunnel → arrive at destination
2. Fly the cockpit, find the trade anchor (replaces Coriolis station — see design notes), hold inside the docking radius
3. Trade screen: buy/sell 17 commodities, refuel at 5 cr/LY, launch
4. NPCs in flight: pirates pursue, traders flee, police idle (or pursue if you're wanted)
5. Combat: SPACE to fire front laser, ships explode, hp drains
6. Combat rank tracked across reloads (Harmless → Elite, 9 ranks)

**Live at:** `https://plicerin.github.io/Aphelion/`

**272 tests passing across 15 test files. ~50 commits on `main`.**

**Known bugs / active risks are open** — see "Open bugs" section below.

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
    save.ts                — localStorage save/load (currently v4)
    cockpit.ts             — compass / fuel / cabin heat / mass-lock / dockingT
    anchor.ts              — trade-anchor placement and stage classification
    trade.ts               — 17 commodities + price model + buy/sell helpers
    refuel.ts              — refuel pricing + cap (5 cr/LY, whole LY only)
    blueprints.ts          — 5 ship blueprints (Cobra + 4 NPC types)
    npc.ts                 — spawnNpcs, stepNpc (pirate pursue / trader flee / police)
    combat.ts              — laser hit detection, damage, explosions, pirate fire-back, combat rank
    planetSurface.ts       — biome glyph palettes + per-planet hue jitter
test/
  *.test.ts                — 272 tests
docs/
  HANDOVER.md              — this file
  roadmap.md               — v0.1 → v1.0 milestones
  bugs.md                  — open bug entries with attempt log
index.html                 — the game (single-file app, mirrors src/ inline)
```

Pure-sim modules under `src/` are the canonical version of every behaviour. `index.html` mirrors them inline so the game runs without a build step. When we move to a build pipeline, `index.html` becomes the entry point that imports from `src/`.

## v0.2 work done in this session

### NPC roles + behaviours (`src/sim/npc.ts`)

`NpcShip` now carries a `role` (`pirate | police | trader`), `hp`, and `explodingT`. `spawnNpcs(system)` returns 3–5 ships per system with role distribution biased by government:

```
anarchy        70/00/30  (pirate / police / trader)
feudal         50/05/45
multi-gov      30/15/55
dictatorship   30/20/50
communist      20/30/50
confederacy    15/35/50
democracy      10/35/55
corporate      05/50/45
```

`stepNpc(npc, ctx, dt)` is pure — takes `{ playerPos, npcs, playerWanted }`. Pirates yaw toward player and throttle in. Traders find the closest pirate within `TRADER_FLEE_RADIUS=30` and flee opposite. Police pursue + fire when `playerWanted`, otherwise idle. Exploding NPCs return unchanged (no movement during death animation).

Tunables (currently dialed down for playability):
```
PIRATE_SPEED       5    (vs player max 80)
PIRATE_TURN_RATE   0.45 (vs player 1.2)
PIRATE_STAND_OFF   14   (close enough → pirate stops, doesn't ram)
TRADER_SPEED       7
TRADER_TURN_RATE   0.4
```

### Combat (`src/sim/combat.ts`)

Pure functions:
- `laserTarget(shipPos, shipForward, npcs)` — ray-vs-sphere, returns nearest non-exploding NPC index
- `applyLaserDamage(npcs, index, dps, dt)` — copy-on-write hp drain; triggers `explodingT` at 0
- `advanceExplosions(npcs, dt)` — ticks the timer, removes finished ones
- `pirateIsFiring(npc, playerPos)` — geometry test for pirate firing decision
- `npcIsFiringOnPlayer(npc, playerPos, playerWanted)` — generalises to police-when-wanted
- `applyHostileFire(playerHp, npcs, playerPos, playerWanted, dt)` — sums DPS across all firing NPCs
- `rankForKills(kills)` — maps kill count to rank index 0..8

Constants:
```
LASER_RANGE         80    (player)
LASER_DPS           80    (player ttk on 100hp NPC ≈ 1.25s)
NPC_HIT_RADIUS      2.5
EXPLOSION_DURATION  1.0s
PLAYER_MAX_HP       100
NPC_MAX_HP          100
NPC_PIRATE_DPS      22    (ttk on player ≈ 4.5s solo)
NPC_LASER_RANGE     50
NPC_FIRING_CONE_DOT 0.95  (~18° half-angle)
WANTED_DURATION     30s

COMBAT_RANK_THRESHOLDS = [0, 1, 8, 16, 32, 64, 128, 256, 512]
COMBAT_RANK_NAMES      = [Harmless, Mostly Harmless, Poor, Average, Above Average,
                          Competent, Dangerous, Deadly, Elite]
```

### Refuel (`src/sim/refuel.ts`)

`applyRefuel(fuel, credits, maxFuel)` — buys whole LY up to a full tank or up to what credits afford, returns `{ newFuel, newCredits, bought }`. `refuelCost` previews the cost. `FUEL_PRICE_PER_LY = 5`.

### Save format (`src/sim/save.ts`)

Bumped to v4. Fields:
```
v1: galaxyIdx, currentSystemSeed
v2: + cargo, credits, fuel
v3: + shipHp
v4: + kills
```

Older versions migrate forward with sensible defaults (full hull, zero kills). Validation rejects negative / non-finite numbers.

### UI / render additions (in `index.html`)

- **HUD bottom-right**: SYSTEM, PITCH, YAW, RANK, KILLS, MASS-LOCKED, WANTED, POD (post-respawn invuln countdown).
- **Mini-bars below scanner**: SPD / ENG / HULL / HEAT. HULL drains in real time, flips to warn colour < 25%.
- **Radar blips on the scanner ellipse**: `@` for pirates (warn hue + 4-direction halo), `+` for police (status hue + halo), `o` for traders (status hue), `·` for off-range contacts pinned to the edge.
- **Target disk wireframe + HP bar** on the left holo-disk: when a Wraith is on or near the crosshair, draws the ship blueprint inside the disk + an HP bar that drains as you fire.
- **Fire flash** at the crosshair while SPACE is held (warm + atmospheric bloom).
- **Explosion render** — `drawExplosion` paints a hot-core flash + expanding debris ring + ember halo into the new `lExplosion` layer.
- **Incoming-fire indicators** — every firing NPC puts a `!` on a centred ellipse around the canopy at its player-local bearing.
- **WebGL diagnostics panel** (cockpit only, left of the reticle) — shows GPU vendor / renderer / extension support; intended for diagnosing the parked glow bug.
- **Bake-test diagnostic** — three buttons that open per-profile glow-tile PNGs in new tabs (workaround for browsers blocking `data:` URL navigation: `window.open` with HTML wrapper containing `<img>`).
- **Refuel button** on the docked overlay — disabled when tank's full or you can't afford 1 LY.

### Render pipeline rewrite (current state)

The renderer went through several iterations this session as the parked glow bug got debugged. **Current pipeline:**

1. Per-character glyph atlas (`glyphAtlas` in `index.html`):
   - **Neutral cache** keyed by `(char, cell, profile)` — one tile per glyph, baked in light gray (#cccccc) for the halo (stacked `shadowBlur` passes under `'lighter'`) + pure white hot-core (no shadow). Used as the source for the tint pipeline.
   - **Tinted cache** keyed by `(char, hue, sat, lightnessBucket, cell, profile)`, LRU-capped at 1536 entries (~50 MB at normal profile). Each tile is the neutral source run through a multiply + destination-in tint pipeline once, then drawn once per frame.
2. `renderLayers` per cell: pick the brightest layer's character + tint, look up the tinted tile, single `drawImage` at `'lighter'` compositing. Overlapping halos stack additively → fills gaps between adjacent characters.
3. `bloomDOM` (CSS-filter post-process canvas) is currently disabled — the per-glyph atlas now bakes halos directly into each tile, so post-process bloom on top would double-glow.

Profiles select halo blur radii + tile padding:
```
tight   2/6/14 px      pad 20    halo radius ~14
normal  4/12/28 px     pad 40    halo radius ~28  (default)
wide    4/12/28/60 px  pad 80    halo radius ~60
```

The tint recipe is `glow-atlas.js` — the user dropped a complete drop-in mid-session and we wired it in with the LRU cache on top.

## Open bugs

### 1. Effulgence-style glow is only solved for the planet prototype/integration

The general per-glyph atlas/post-process approach did not reproduce the Effulgence look in the full game. The successful direction is the `refs/glyph-lab.html` approach now partially integrated into flight: crisp glyphs plus a separate low-resolution coloured surface-light field. This currently applies to the planet renderer only.

What failed or was rejected:

1. Bucket bloom (per-layer offscreen canvas + progressive `ctx.filter = 'blur(...)'`)
2. Per-glyph atlas with `ctx.filter` blur
3. Per-glyph atlas with `shadowBlur` + neon colour ramp
4. Direct per-cell `shadowBlur` on the visible canvas
5. Stacked per-cell `shadowBlur` (3–5 fillText calls per cell)
6. WebGL bloom postprocess (full GPU pipeline: half-res H+V blur, quarter-res H+V, additive composite)
7. CSS `filter: blur()` on a stacked DOM canvas with `mix-blend-mode: screen`
8. Per-glyph atlas with multiply-tint
9. WebGPU surface blur prototype (`refs/glyph-lab-webgpu.html`) — too geometric, washed out, and visually worse than the canvas lab
10. WebGPU-accelerated canvas experiment — lost the glow and introduced inconsistent motion

The WebGL attempt failed identically across Chrome / Edge / Firefox, which may indicate a fallback GPU backend on the user's machine, but do not assume that is the root cause. The latest browser question was whether Chrome has GPU acceleration enabled; the recommended checks are `chrome://gpu` and `chrome://version`.

For the next session: **do not start by trying another graphics API.** Start by visually evaluating the committed `NEW_PLANET_RENDERER` path. If it is close enough but slow, optimize the canvas algorithm/caches. If it is not close enough, return to `refs/glyph-lab.html`, which is the best-known visual match.

`docs/bugs.md` has the full failed-attempts log.

### 2. Player gets destroyed instantly on respawn (open, currently masked by disabling enemy fire)

Symptom: when the player's HP reaches 0, the `'destroyed'` reducer fires (resets HP to full, fuel to full, halves cargo, moves player to a safe respawn point, sets `respawnInvulnT = 8.0`, bumps `respawnGen`), but reportedly the player's HULL bar is shown going to zero again *immediately* on the next frame.

Tried (all live):
- Bumped invuln window 3s → 5s → 8s
- Pushed respawn position back to z=-200 (closest NPC ~225u away, well outside `NPC_LASER_RANGE=50`)
- Bumped systemBodies rebuild key with `respawnGen` so NPCs reset to deterministic spawn positions instead of staying parked on the wreckage
- Pirate aggression dialled way down (DPS 40→22, speed 8→5, turn rate 0.6→0.45, stand-off 8→14, range 60→50, cone 0.92→0.95)

Even with all of these, the user reports getting destroyed immediately on respawn. **There must be a damage source other than `applyHostileFire` that I haven't identified, or the dispatched state isn't actually landing.**

**Currently masked** by an `ENEMY_FIRE_ENABLED = false` flag wrapping the `applyHostileFire` call in the flight tick (in `index.html`). Visuals stay honest — radar blips and incoming-fire `!` markers still show what *would* be firing — but no hp drain reaches the player.

**To re-engage:** flip the flag back to `true`. To debug the underlying issue, suggested first steps:

1. Add a `console.log('respawn: hp=' + game.shipHp + ' invulnT=' + game.respawnInvulnT + ' pos=' + game.ship.position)` in the `'destroyed'` reducer return path — confirm the dispatch is landing with the expected values.
2. `grep -rn 'shipHp' index.html` and audit every assignment site. Currently only the `applyHostileFire` block writes `shipHp`, but there might be another path I missed.
3. Add a frame-by-frame log of `game.shipHp` and `game.respawnInvulnT` to see when/how hp actually drops.

## Recent file-by-file changelog

### Sim layer
- `src/sim/npc.ts` — added `role`, `hp`, `explodingT` to `NpcShip`; expanded `spawnNpcs` to 3–5 with role distribution; added `stepNpc` with pirate pursuit + trader flee + police-when-wanted.
- `src/sim/combat.ts` — new module. Hit detection, damage, explosion lifecycle, pirate fire-back, combat rank table.
- `src/sim/refuel.ts` — new module. `applyRefuel` + `refuelCost`.
- `src/sim/save.ts` — bumped to v4. Adds `shipHp` + `kills` migration.
- `src/sim/planetSurface.ts` — biome palettes are now seed-derived (Fisher-Yates over a per-biome glyph pool) + per-biome hue jitter.

### Tests
- `test/npc.test.ts` — 26 tests (spawn count, role distribution, pirate pursuit math, trader flee, police pursue/idle, exploding noop).
- `test/combat.test.ts` — 38 tests (laser hit/miss, damage clamp, explosion lifecycle, pirate firing predicate, multi-pirate stacking, police-only-when-wanted, rank thresholds and edges).
- `test/refuel.test.ts` — 11 tests (full tank no-op, partial credits, whole-LY rounding, top-up, fractional starting fuel).
- `test/save.test.ts` — 20 tests (round trip, migration v1→v3 / v2→v3, negative-shipHp rejection, etc.).
- `test/planetSurface.test.ts` — 17 tests including seed-derived palette determinism.

### Render layer (`index.html`)
- `NEW_PLANET_RENDERER = true` now routes the in-flight planet through `planetGlyphRenderer`, the lab-derived canvas renderer with dense ocean glyphs, coloured biome clusters, separate low-resolution surface glow, deterministic rotation, and a 24 fps offscreen render cache.
- The old world-cell planet renderer remains in place behind the `NEW_PLANET_RENDERER` fallback branch.
- `glyphAtlas` rewritten ~6 times. Current version: neutral cache + tinted LRU cache + multiply+destination-in tint pipeline. Tinted-cache cap = 1536 to avoid thrashing on planet views.
- `renderLayers` reduced to a single `drawImage` per cell at `'lighter'`.
- `bloomDOM` (CSS filter overlay) currently disabled.
- New layers: `lExplosion` (warn / atmospheric), `lBlipHostile` (warn / tight), `lBlipFriend` (status / tight).
- `renderFlight` got radar-blip rendering, target-disk wireframe + HP bar, fire-flash, explosion rendering, incoming-fire bearing markers, mini-bar HULL row, RANK/KILLS HUD readouts, WANTED/POD indicators.
- WebGL diagnostic panel (`#webgl-diag`) and bake-test "Open in new tab" buttons remain in place as live diagnostics for the parked glow bug.

## Conventions worth preserving

- **Pure simulation, dumb renderer.** Every behaviour goes in `src/sim/` as pure functions. `index.html` mirrors them inline. Tests target the pure layer.
- **Deterministic everything.** Seed → galaxy → system → NPCs → biome palettes → planet hue jitter. Two players who launch see the same starting state. Save format only stores seeds + earned/chosen state, never derived data.
- **Strict save validation.** Saves are best-effort and never throw. Future versions, malformed JSON, wrong shapes, out-of-range values all fall back to a fresh start.
- **Forward-favoured flight.** Velocity bends toward heading at `velocityAlignRate: 4.0`. Strict Newtonian in a chase camera is miserable.
- **Quaternions.** No gimbal lock, compose cleanly, renormalize every frame.
- **`role` over hard-coded behaviour.** Adding a new NPC role is editing `ROLE_WEIGHTS` + adding a `step*` branch in `stepNpc` + (if relevant) adding a firing predicate. Same pattern for everything else.
- **`!important` for `.show-{screen}` visibility classes.** Several elements (`#info`, `#galaxy-tabs`, `#countdown`, `#webgl-diag`, etc.) set `display: grid|flex` on their own ID rules; the data-screen toggle has lower specificity and would silently leak across screen transitions without the bang.

## How to continue

When you pick this up, the natural next moves depend on whether the death-loop bug is solved.

**If you can spend an hour on the death loop**, do that first — the game ships fine without enemy fire as a "peaceful mode" but combat is the v0.2 line item and the bug is presumably small.

**If not, the next roadmap item is v0.2 final piece: Equipment upgrades** (better lasers / shields / ECM / fuel scoop / docking computer). That needs:
1. Outfitter UI on the docked screen (parallel to the trade screen)
2. Per-equipment effect plumbed through the sim — better laser = higher `LASER_DPS`, shields = extra hp layer that absorbs first, fuel scoop = passive fuel regen near the sun, docking computer = auto-dock (already-trivial since docking has no skill check), ECM = cancels pirate fire briefly (could trigger temporary invuln window from a held key)
3. Save format v5 with installed-equipment list

**Or move to v0.3** if you want a change of pace: missions, asteroid mining, sound (procedural blips + engine drone via Web Audio).

**Always-relevant follow-ups:**
- Trade screen visual polish (the Effulgence inventory reference the user posted — ASCII tile-art per commodity, bracket-frame buttons, top tab bar). Filed for v1.0 polish; could land sooner.
- Per-blueprint NPC differentiation. Currently all NPCs are Wraiths. Pirates could be Wraiths (fast/aggressive), traders Haulers (slow/passive), police Sentinels (mid-tier). Already have the 5 blueprints in `blueprints.ts`; just needs `spawnNpcs` to pick by role.
- Glow bug. If you have access to a high-end GPU machine, just confirm the WebGL backend in the diag panel before assuming a fallback. The bake-test buttons in the cockpit will tell you in seconds whether `shadowBlur` is actually spreading.

## Useful references

- `bbcelite.com` — Mark Moxon's annotated 6502 source for every Elite version. Especially `/deep_dives/ship_blueprints.html` and `/deep_dives/drawing_ships.html`.
- Effulgence RPG on Steam — proves glowing ASCII can carry a modern game.
- The Cobra Mk III blueprint (28 vertices, 38 edges, 13 faces) is in `index.html` as the canonical reference shape.
- W3Schools `text-shadow` neon glow recipe — what the user kept pointing at when debugging glow. The current atlas implements this idea (white inner / saturated outer) baked into per-glyph tiles.

## Things deliberately NOT done

- Multiplayer — would change everything; v2 territory.
- 3D solid-shaded ships — the wireframe glow IS the aesthetic.
- Fixed campaign / story — procedural emergent narrative is the point.
- Real-name copyrighted material from Elite (Lave, Diso, Coriolis-the-trademark, etc.). The "trade anchor" replaced Coriolis station for this reason — and to keep the glowing-ASCII signal-resolution conceit central to docking instead of an alignment puzzle.
- Microtransactions or unlockables — it's a game, not a service.
