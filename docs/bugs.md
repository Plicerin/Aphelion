# Aphelion — Known Bugs

## Per-glyph glow halos do not render

**Status:** Open. Workaround in place (`renderLayers` paints sharp
characters only; #bloomDOM provides a CSS-filter copy canvas with
mix-blend-mode: screen, but the user-visible result is still no
halo bleed past character silhouettes). Live diagnostics shipped in
the cockpit (`#webgl-diag` panel + per-glyph bake-test "Open in new
tab" buttons) for whoever picks this up next.

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
6. **WebGL bloom postprocess** — proper GPU pipeline: upload `#stage`
   as a texture, half-res H+V Gaussian blur, quarter-res H+V seeded
   from the half result, additive composite to a `#bloomGL` canvas
   with mix-blend-mode: screen over `#stage`. Failed identically in
   Chrome, Edge, and Firefox — three-browser failure suggests ANGLE
   was running in a fallback backend (SwiftShader / D3D9 /
   `Microsoft Basic Render Driver`) that satisfies WebGL conformance
   but lacks linear filtering / floating-point textures /
   framebuffer blits. The `#webgl-diag` panel was added during this
   attempt to surface RENDERER / unmasked vendor / extension support
   so we can confirm the fallback hypothesis.
7. **CSS-filter on a stacked DOM canvas** — drawImage `#stage` onto a
   second canvas (`#bloomDOM`) and apply `filter: blur(Xpx)
   brightness(Y)` via CSS, then mix-blend-mode: screen over
   `#stage`. CSS filter goes through the browser compositor (Skia /
   CG / DirectComposition) rather than WebGL — completely separate
   code path with no shader/texture dependencies. User reported "did
   not work" with this path live too; combined with the WebGL
   failure that strongly implicates the rendering backend itself
   rather than any specific primitive.

**Hypothesis (current best):** The browser's GPU acceleration for
canvas / WebGL / CSS-filter is being routed through a software /
ANGLE fallback backend that drops the blur convolution. The
`#webgl-diag` panel rows for `UNMASKED RENDERER`, `EXT_color_buffer_float`,
and `OES_texture_float_linear` should reveal this — `SwiftShader` /
`Microsoft Basic` / similar names in the renderer string + `no` for
either extension is the signal.

**Live diagnostics still in `index.html`:**
- `#webgl-diag` panel on the flight screen (cockpit, left of the
  reticle). Shows WebGL version, RENDERER, VERSION, SHADING,
  unmasked vendor/renderer, extension support, framebuffer status.
  Fallback-backend strings get a warn colour.
- Per-glyph bake-test strip on the same panel: three "Open
  *profile* →" buttons that pop a new tab containing the
  bake-recipe tile (halo + hot-core stages) at 400×400 against a
  pure-black background. Modern browsers block direct `window.open`
  to a `data:` URL, so the new tab is opened blank then has HTML
  document.write'd into it that embeds the tile via `<img src=...>`.
- Console log on init: `[Aphelion bloom] CSS-filter bloom activated.`
  followed by `first render: WxH intensity=… blurPx=…`. Absence of
  these logs would mean the bloom path itself isn't even running.

**Next paths to try (when this is reopened):**
- Read what the diag panel actually says on the user's machine —
  if `UNMASKED RENDERER` is SwiftShader or similar, the fix is
  user-side (chrome://flags / hardware acceleration / driver
  update) rather than in this codebase.
- Try the bake-test "Open" buttons — if those new-tab tiles show
  the proper neon halo, the bake recipe is correct and the bug is
  somewhere in how the page itself composites the tiles back. If
  the new-tab tiles also show no halo, `shadowBlur` itself isn't
  spreading on the user's machine and no per-glyph approach will
  ever work there.
- If the platform truly can't blur: stop trying. Ship the
  no-halo aesthetic as-is and treat glow as a "premium-platform
  enhancement" — the game still looks like a glowing-ASCII space
  trader without it.
