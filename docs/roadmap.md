# Aphelion Roadmap

## v0.1 — playable slice

Goal: someone can launch the game, hyperspace between two systems, dock at a station, buy something cheap, sell it for a profit somewhere else, and feel pleased about it.

- [x] Galaxy generator (256 systems × 8 galaxies, deterministic)
- [x] Galactic chart visualization
- [x] Goat-soup style description generator (recursive grammar, ours)
- [x] Hyperspace tunnel transition between systems
- [x] Cockpit view with crosshair, dashboard, scanner
- [x] Newtonian-ish flight model (throttle + pitch + roll + yaw)
- [x] Save game in localStorage
- [ ] Coriolis station with rotating slot to dock through
- [ ] Trade screen with all 17 commodities and the supply/demand price model
- [ ] Ship blueprint loader for at least 4 ship types (1 done — the Cobra)

## v0.2 — combat

- [ ] Hostile AI: pirates pursue, traders flee
- [ ] Front laser hit detection + ship explosions
- [ ] Police that respond to you firing in safe zones
- [ ] Combat rank tracking
- [ ] Equipment upgrades: better lasers, shields, fuel scoop, ECM, docking computer

## v0.3 — universe

- [ ] All 8 galaxies playable, galactic hyperdrive
- [ ] Missions: bounty hunting, courier, rescue
- [ ] Asteroids you can mine
- [ ] Sound: procedural blips and engine drone via Web Audio

## v1.0 — polish

- [ ] Full ship roster (12+ blueprints)
- [ ] Procedurally rendered planets with surface meridians
- [ ] Multiple visual presets (phosphor, amber, modern cyan)
- [ ] Itch.io release
- [ ] Optional Tauri desktop wrapper

## Things we have explicitly decided NOT to do for v1.0

- Multiplayer (would change everything; v2 territory)
- 3D solid-shaded ships (the wireframe glow IS the aesthetic)
- A campaign with a fixed story (procedural emergent narrative is the point)
- Microtransactions / unlockables (it's a game, not a service)
