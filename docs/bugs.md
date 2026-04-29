# Aphelion — Known Bugs

## Per-glyph glow halos do not render

**Status:** Open. Workaround in place (`renderLayers` falls back to
per-layer bucket bloom; visible result is brighter characters with
no halo bleeding into the gaps between them).

**Symptom:** Characters paint at the requested colour and brightness,
but the surrounding pixels never light up. There is no visible halo
extending past any glyph silhouette and no overlap-fill in the dark
gaps between adjacent glyphs. The glow slider 0 → 100 only shifts
character intensity; it never produces the radial glow seen in the
Effulgence reference frames or in W3Schools' CSS `text-shadow` neon
demos.

**Tried (none worked):**
1. **Bucket bloom** — render bright characters to a per-layer offscreen
   canvas, blur with progressive `ctx.filter = 'blur(Xpx)'` passes,
   composite back onto main with `'lighter'`. Cumulative pass alpha
   pushed up to ~3.0. Halos do not appear past character silhouettes.
2. **Per-glyph atlas (ctx.filter)** — pre-bake a halo tile per
   `(char, hue, sat, brightness, cell, profile)` tuple by stacking
   blurred copies of a bright character canvas under `'lighter'`,
   then `drawImage` the tile onto the main canvas. No visible halo.
3. **Per-glyph atlas (shadowBlur)** — same atlas, but the halo tile
   built by stacking `fillText` calls with progressively larger
   `shadowBlur` values + a neon-style colour ramp (white inner /
   saturated outer). No visible halo.
4. **Direct per-cell `shadowBlur`** — single `fillText` per cell on
   the visible canvas with a non-zero `shadowBlur`. *Some* halo
   visible but only a few pixels past the glyph; gaps still dark.
5. **Stacked per-cell `shadowBlur`** — 3–5 `fillText` calls per cell
   at progressively wider `shadowBlur` radii (4, 12, 28, 60 for
   atmospheric) under `'lighter'`. Same result as (4) — no further
   spread. Performance hit was unacceptable on planet view.

**Hypothesis:** Either (a) hardware acceleration is off in the
target Chrome and canvas blur primitives are degrading, or (b) some
DPR / `setTransform` interaction in this codebase is silently
neutering both `ctx.filter` blur and `shadowBlur` when the source
or destination is itself a transformed canvas. Need a minimal repro
outside of `index.html` to isolate.

**Next paths to try (when this is reopened):**
- Stacked DOM canvas overlays with CSS `filter: blur()` and
  `mix-blend-mode: screen`. CSS filter uses a different rendering
  path than `ctx.filter`; should rule out (a) above.
- Test a minimal HTML page with `ctx.shadowBlur` only (no transforms,
  no offscreen) to confirm the primitive renders at all in the
  user's environment.
- If both fail: WebGL bloom shader. Not a small change.
