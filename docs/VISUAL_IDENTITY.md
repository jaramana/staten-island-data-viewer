# Visual identity — Staten Island Data Viewer

A standalone identity. It shares nothing with Bus Works, ADRH Mapper, or
corunalabs.org — no masthead, no palette, no type stack, no components. It is
built to feel like an early-2000s city-builder, entirely from original CSS and
canvas-drawn assets.

**Hard line:** inspiration by eye only. No SimCity 4 code, art, fonts, or audio
files ever enter this repo. Everything below is a from-scratch recreation of a
*mood*, not a copy of an asset.

---

## 1. The reference mood, in words

Three things make an SC4 screenshot instantly recognisable, and each has a cheap
original equivalent:

| SC4 trait | What we build instead |
|---|---|
| Warm midday sun, long soft shadows, hazy horizon | MapLibre `light` + `fog` + `sky`, sun azimuth ~215°, warm haze |
| Saturated, legible zone colours over muted terrain | Desaturated ground + parks; buildings carry all the colour |
| Heavy chrome: bevelled metal panels, riveted edges, small caps labels | CSS gradients + inset/outset box-shadows, no images |
| A camera that sits *above and off-axis*, never straight down | Pitch locked 45–62°, bearing free, minZoom floor |

---

## 2. Palette

Two families that must never be confused: **world colours** (the city itself)
and **chrome colours** (the HUD sitting on top of it). Keeping the HUD cool and
dark makes the warm world pop, which is most of the SC4 feeling.

### 2.1 Chrome — cool gunmetal, amber accents

| Token | Hex | Use |
|---|---|---|
| `--chrome-900` | `#0d1520` | Panel shadow, deepest recess |
| `--chrome-800` | `#16212f` | Panel body base |
| `--chrome-700` | `#223143` | Panel body top of gradient |
| `--chrome-600` | `#33475e` | Bevel highlight, inactive tab |
| `--chrome-500` | `#4a637f` | Divider, disabled text |
| `--chrome-100` | `#c6d4e4` | Body text on chrome |
| `--chrome-000` | `#eef4fb` | Headline text, active tab text |
| `--accent-amber` | `#f0a830` | Primary accent — active tab, key numbers |
| `--accent-amber-hi` | `#ffd177` | Amber highlight / glow |
| `--accent-cyan` | `#4fd0e0` | Secondary accent — selection, hover ring |
| `--accent-red` | `#e2564a` | Alerts, crime view accent |
| `--accent-green` | `#63c46a` | Positive/complete states |

### 2.2 World — muted ground, saturated buildings

| Token | Hex | Use |
|---|---|---|
| `--world-water` | `#1c4f6e` | Harbour, Kill Van Kull, Arthur Kill |
| `--world-water-shallow` | `#2a6f8f` | Shoreline band |
| `--world-land` | `#3f4a35` | Base ground (deliberately drab) |
| `--world-park` | `#4a6b38` | Parks Properties polygons |
| `--world-park-hi` | `#5d8244` | Park edge highlight |
| `--road-major` | `#d8c9a8` | Highways / arterials (rw_type 2,3,9) |
| `--road-minor` | `#a89a80` | Local streets (rw_type 1) |
| `--road-casing` | `#2b2b26` | Road outline (the "chunky outline" trick) |
| `--sky-day` | `#8fc4e8` | Sky top, midday |
| `--haze-day` | `#cfd9c8` | Fog / horizon blend, midday |

### 2.3 Land-use ramp (the single most important colour decision)

Eight categories, collapsed from PLUTO's eleven `landuse` codes. The mapping is
recorded in `pipeline/landuse.py` so the legend and the pipeline can never drift
apart. Hues follow the city-builder convention the eye already knows —
**green residential, blue commercial, yellow industrial** — without copying any
specific game's exact values.

| Category | PLUTO `landuse` | Token | Hex |
|---|---|---|---|
| Residential — low | 01 | `--lu-res-low` | `#7fbf5a` |
| Residential — multi | 02, 03 | `--lu-res-multi` | `#3f9142` |
| Mixed use | 04 | `--lu-mixed` | `#4bb6a4` |
| Commercial & office | 05 | `--lu-commercial` | `#3d85c8` |
| Industrial & manufacturing | 06 | `--lu-industrial` | `#e0b544` |
| Institutional & utility | 07, 08 | `--lu-institutional` | `#9b6fc4` |
| Open space & recreation | 09 | `--lu-openspace` | `#5f8f4e` |
| Parking & vacant | 10, 11 | `--lu-vacant` | `#9c9481` |
| _No PLUTO match_ | — | `--lu-unknown` | `#6b7280` |

`--lu-unknown` is a grey with its own legend entry reading "no land-use record."
It is never silently folded into another category — an unjoined building is a
data fact, not a gap to paper over.

---

## 3. Typography

System stack only — no webfont downloads, no licensing question, no FOUT.

- **HUD / chrome:** `"Helvetica Neue", Helvetica, Arial, sans-serif`, letter-spacing
  `0.06em`, uppercase for labels, 11–13px. Tight and technical.
- **Numbers (population, budget, counts):** `ui-monospace, "SF Mono", Menlo,
  Consolas, monospace`, tabular, amber. Big readouts are the SC4 tell.
- **Body / popups:** same sans, sentence case, 13px, `--chrome-100`.

No italics anywhere. No font smaller than 11px.

---

## 4. Chrome construction

All panels are one recipe, so the UI reads as a single machined object:

```
background: linear-gradient(180deg, var(--chrome-700), var(--chrome-800));
border: 1px solid var(--chrome-900);
box-shadow:
  inset 0 1px 0 var(--chrome-600),      /* top bevel highlight */
  inset 0 -1px 0 var(--chrome-900),     /* bottom bevel shadow */
  0 6px 18px rgba(0,0,0,0.45);          /* drop shadow onto the world */
border-radius: 3px;                      /* nearly square — 2000s, not 2020s */
```

- Corners: 3px. Never pill-shaped, never fully square.
- Active state: 1px `--accent-amber` inner border + faint amber glow.
- Hover: 1px `--accent-cyan` ring. Never a colour fill change.
- Layout: a **bottom-left view switcher** (vertical tab strip) and a **top
  readout strip**, both floating over the map with a gap — panels sit *on* the
  world, they don't frame it.

## 5. Iconography

Canvas- or SVG-drawn in code, 2px stroke, flat fills from the palette above, no
gradients, no external icon font. Every icon reads at 16px. Markers (precinct,
firehouse) are a 20px rounded-square badge with a 2px `--chrome-900` outline —
the chunky-outline look does the "game" work.

## 6. Motion

- View switches: 220ms ease-out cross-fade on layer opacity. Never instant.
- Camera moves: `easeTo` 900ms, never `jumpTo`, except on first load.
- Hover feedback: 90ms. Fast enough to feel mechanical.
- Day/night (Phase 5): a slow interpolation of `--sky-*`, `--haze-*` and the
  MapLibre light angle. Cosmetic only, never tied to real time-of-day data.

## 7. Sound (Phase 5, pending user sign-off)

UI clicks are code-generated (WebAudio oscillator blips), not sourced files.
Music is 2–3 freely licensed tracks, documented in `AUDIO_SOURCES.md`, and is
**off by default** with a visible mute state.

---

## 8. What this identity forbids

- Any asset that came from somewhere else — art, icon fonts, tilesets, textures.
- Photorealistic imagery as the primary layer (see PLAN.md §2.1).
- Consistency with any other Coruña Labs tool.
- Chrome so heavy it eats the map: total HUD footprint stays under ~22% of the
  viewport at 1280×800.
