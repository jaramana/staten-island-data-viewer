# Running "not doing" list

From PLAN.md §7, kept current as the project progresses. Anything here stays out
unless the user explicitly reopens it.

## Locked out from the start

- **No building / zoning / editing of any kind.** Free camera and inspection are
  fine; changing the city is not. The test: does an action change what the city
  looks like for the next viewer? If yes, it's out.
- **No fabricated NYC data** to fill visual gaps. Missing data is shown as
  missing (see the `unknown` land-use category).
- **No whole-city rendering** — Staten Island only.
- **No custom or AI-generated building art.** Buildings are real footprints
  extruded to real heights.
- **No SimCity 4 IP** — no code, art, fonts, or audio files. Freely licensed
  SC4-*mood* music (2–3 tracks, documented in `AUDIO_SOURCES.md`) is fine.
- **No visual or template consistency with other Coruña Labs tools.**
- **No live simulation engine** — no traffic AI, no population growth model.
  This is a viewer of real snapshots.

## Added during the build

- **Google Photorealistic 3D Tiles** — considered and rejected as a primary
  layer in PLAN.md §2.1 (no per-building data binding, needs billing). May be
  revisited only as a separately-scoped optional backdrop after Phase 7.
- **Census Bureau ACS API** — now requires a registered API key. Not pursued;
  population comes from DCP's published borough table instead. Reopen only if
  the user wants finer-grained (tract-level) demographics and registers a key.
- **Individual crime points on the map** — deliberately not rendered. Crime is
  aggregated to precinct and hex cell. Plotting ~10,800 individual complaint
  locations would be both a performance problem and a misleading level of
  precision for offence data.
- **Every 311 complaint type (~300)** — only a small chosen set is rendered
  (Phase 1), with the rest aggregated into an "all other" count rather than
  silently dropped.
