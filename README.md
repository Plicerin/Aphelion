# Aphelion

> *aphelion (n.) — the point in an orbit furthest from the sun*

A glowing-ASCII space trading and combat game. Inspired by the design of classic 8-bit space sims, built with a custom rendering pipeline that draws every ship, planet, and dashboard element from text symbols passed through a multi-pass bloom shader.

The aesthetic conceit: you are receiving fragmented signals from a galaxy too far away to image directly, decoded into glowing characters.

## Status

**Pre-alpha.** Galaxy generation works; chart visualization works. The flight, combat, and trading layers are not yet built. See `docs/roadmap.md` for the plan.

## What's here

- A procedural galaxy generator that produces 8 galaxies of 256 systems each, fully deterministic from a single seed triple. Pure functions, well tested.
- A glowing-ASCII renderer that draws the galactic chart with per-color bloom buckets and an interactive cursor.
- Two earlier prototype files (the Cobra Mk III renderer and a cockpit scene) that established the visual language.

## Running

```bash
npm install
npm test                 # run the test suite (17 tests)
npx tsx scripts/inspect.ts  # print a sample of the generated galaxy
```

To see the chart, open `chart.html` directly in a browser. It's a single self-contained HTML file with no build step.

## Project layout

```
src/
  types.ts                 — public type definitions
  galaxy/
    twist.ts               — seed-twist primitive + galaxy rotation
    names.ts               — system name generation
    generator.ts           — full galaxy assembly
test/
  galaxy.test.ts           — 17 tests covering determinism, distribution, names
scripts/
  inspect.ts               — dev-only: print sample systems
chart.html                 — standalone galactic chart visualization
```

## Tech

Plain TypeScript. Vitest for tests. Canvas2D for rendering. No frameworks, no heavy dependencies. The whole game is intended to ship as a single inlined HTML file, well under 200 KB gzipped — a small homage to the 22 KB original that fit the entire universe in a cassette tape.

## Inspiration and credit

The design space this project explores was opened up by Ian Bell and David Braben's Elite (1984) and given a fresh contemporary treatment by Andrei Fomin's Effulgence RPG. Everything in this repo is original work; the galaxy generation is a clean-room reimplementation written from conceptual descriptions rather than a port.

Specific debts:
- Mark Moxon's [bbcelite.com](https://elite.bbcelite.com) site, which documents the design of the original game in extraordinary depth.
- Andrei Fomin's Effulgence RPG, which proved that glowing ASCII could carry a modern game.

## License

MIT. See [LICENSE](LICENSE).
