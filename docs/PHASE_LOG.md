# Phase log

One entry per phase gate: what was built, what was deferred, and the honest
self-review PLAN.md rule 4 asks for.

---

## Phase 0 — Foundations & open decisions ✅

### Built

- **Repo scaffold** — `pipeline/`, `data/raw` (gitignored), `data/processed`,
  `site/`, `docs/`, `audio/local` (gitignored). Git initialised, one commit.
- **Dataset registry** (`pipeline/sources.py`) — 13 sources, each with its
  Staten Island filter written down so the borough clip is auditable.
- **Downloader** (`pipeline/download.py`) — paged SODA client, retry/backoff,
  writes `data/raw/_manifest.json` recording the publisher's own last-updated
  timestamp and row counts at fetch time.
- **Provenance doc** (`DATA_SOURCES.md`) — *generated* by
  `pipeline/make_data_sources.py` from that manifest. No vintage is ever typed
  by hand, so the doc and the "data as of" footer cannot drift from reality.
- **Trivial test call against all 13 sources — all pass.** Verified 2026-07-29.
- **Visual identity** (`docs/VISUAL_IDENTITY.md`) — standalone palette (chrome
  vs. world families), type stack, one panel recipe, motion timings, and the
  explicit list of what the identity forbids.
- **Land-use collapse** (`pipeline/landuse.py`) — PLUTO's 11 `landuse` codes →
  8 render categories + an explicit `unknown`, shared by pipeline and legend.
- **`NOT_DOING.md`** — PLAN.md §7 list, plus four items added during Phase 0.

### Open questions resolved

- **Budget source** (PLAN.md §3, "Unresolved"). Confirmed: the NYC Council
  budget dashboard exposes no public API. Chosen fallback is OMB's
  [Expense Budget — Community Boards Geographic Report](https://data.cityofnewyork.us/d/f9xn-fiww),
  which is *better* than the citywide alternatives here because it is
  borough-scoped: FY2026 adopted dollars and budgeted headcount for Staten
  Island (`boro_nm='RICHMOND'`), by agency. Real SC4-style budget panel material
  — FDNY $139.4M/872 positions, NYPD $97.0M/901, Sanitation $44.6M/533.
- **Population source.** The Census Bureau ACS API now requires a registered
  key (verified: returns "Missing Key"). Using DCP's published borough
  population table instead — decennial counts 1950–2020, with 2030/2040 marked
  as projections wherever displayed. Residential unit counts come from PLUTO,
  which we already pull.

### Substitutions from PLAN.md §3 (all same-publisher, better-vintage)

| Plan named | Using instead | Why |
|---|---|---|
| 3-D Building Model `tnru-abg2` | Building Footprints `5zhs-2jue` | The named asset was last updated **2016** and ships as per-tile multipatch/DWG a browser can't consume. The substitute is the city's live building inventory (updated 2026-07-26) with `height_roof`, `ground_elevation`, and `base_bbl` to join PLUTO on — exactly what §2 needs. |
| LION `2v4z-66xt` | CSCL Centerline `inkn-q76z` | LION's Socrata asset is a stale (**2013**) zipped file geodatabase needing GDAL. CSCL Centerline is the city's currently-maintained street centerline (2026-07-26), served as queryable GeoJSON. |
| Fire Companies `iiv7-jaj9` | Fire Companies `bst7-5464` | Same DCP dataset and vintage; the map asset returns empty properties and null geometry over the API. |

### Additions beyond PLAN.md §3 — flagged for sign-off

- **Parks Properties** (`enfh-gkve`, 161 SI polygons). Not in the plan's table.
  Staten Island is roughly a third parkland; without it the base map reads as an
  implausibly empty green field. Cheap, real, and materially improves the
  Phase 2 deliverable. **Say the word and it comes out.**

### Deferred / needs the user

- **MTA and 511NY developer keys — not registered.** Registering creates
  accounts under the user's identity, which is theirs to do, not mine. Both are
  Phase 6 (optional) only, so nothing downstream is blocked.
- **News feed — awaiting confirmation** (PLAN.md §3 requires it). Two candidates
  verified reachable and well-formed on 2026-07-29: SILive / Staten Island
  Advance (`https://www.silive.com/arc/outboundfeeds/rss/?outputType=xml`, ~97KB,
  valid RSS) and Gothamist (`https://gothamist.com/feed`, ~49KB, valid RSS).
  Recommendation: SILive as primary — it is the borough's own paper — with
  Gothamist as a secondary city-wide row. Not built against until confirmed.
- **Audio — nothing sourced yet** (PLAN.md §5 requires the shortlist be
  confirmed first). Phase 5.
- **No UI of any kind** — correct for this phase.

### Self-review against the rules

- *Rule 1 (viewer, not game):* nothing built yet can change the city. ✅
- *Rule 2 (no invented data):* every source verified live against its publisher;
  no placeholder rows anywhere; unjoined buildings will render as an explicit
  `unknown` category rather than being coloured plausibly. ✅
- *Rule 3 (minimal first):* no tile server, no build tooling, no framework. I
  checked for `tippecanoe`/`pmtiles` and deliberately did **not** add them —
  plain simplified GeoJSON first, escalate only if the Phase 3 performance gate
  actually fails. ✅
- *Rule 5 (standalone identity):* the identity doc shares no token, font, or
  component with any other Coruña Labs tool, and says so explicitly. ✅
- *Rule 6 (no copyrighted assets):* zero binary assets in the repo. System font
  stack only. ✅
- *Creep check:* one addition beyond the plan (Parks), flagged above rather than
  slipped in.

---

## Phase 1 — Data pipeline ✅

`pipeline/process.py` turns `data/raw/` into `data/processed/`. Every step is
clip → reduce → round → write, and prints what it dropped and why.

### Output files and byte sizes

| File | Size | Gzipped | Features | What it is |
|---|---:|---:|---:|---|
| `buildings.geojson` | 41.97 MB | 5.12 MB | 142,455 | Real footprints, real roof heights, land-use category |
| `trees.geojson` | 4.09 MB | 0.35 MB | 32,689 | Thinned street-tree points |
| `roads.geojson` | 3.04 MB | 0.34 MB | 16,692 | Street centerlines, classed for styling |
| `sr311_hex.geojson` | 0.90 MB | — | 3,328 | 311 counts per (type, 300 m hex) |
| `fire_companies.geojson` | 0.22 MB | — | 50 | Fire company response areas |
| `parks.geojson` | 0.16 MB | — | 161 | Parks Properties polygons |
| `crime_hex.geojson` | 0.14 MB | — | 520 | Crime counts per 300 m hex |
| `precincts.geojson` | 0.10 MB | — | 4 | Precinct boundaries + their own totals |
| `boundary.geojson` | 0.08 MB | — | 1 | The borough polygon (also the land mask) |
| `firehouses.geojson` | 0.003 MB | — | 20 | Firehouse points |
| `manifest.json`, `stats.json`, `crime_meta.json`, `sr311_meta.json`, `trees_meta.json`, `legend_landuse.json` | 0.01 MB | — | — | Vintages, headline numbers, legends, honesty notes |

**Total: 50.70 MB raw / ~6.5 MB over the wire gzipped.** `buildings.geojson` is
~83% of it; everything else together is under 9 MB.

### Joins and reductions, with the numbers

- **Buildings ↔ PLUTO on BBL:** 142,455 footprints, **137,311 joined (96.4%)**,
  **5,144 unjoined**. Unjoined buildings are *not* guessed at — they render in
  the `unknown` land-use category with its own legend entry. 92 buildings have
  no roof height and are flagged rather than assigned one.
- **Land use, collapsed to 8:** res_low 124,070 · unknown 5,396 · res_multi
  3,356 · institutional 2,576 · commercial 2,318 · mixed 2,259 · openspace 923
  · industrial 845 · vacant 712. (Staten Island really is that overwhelmingly
  one- and two-family housing — that lopsidedness is the finding, not a bug.)
- **Heights:** median 7.9 m, p95 10.7 m, max 64.6 m. A low-rise borough.
- **Crime:** 10,807 YTD complaints → 520 hex cells (300 m) + 4 precinct
  polygons carrying their own totals. Zero records lacked coordinates.
  Individual complaint points are deliberately never rendered.
- **311:** 153,330 requests over a trailing 12 months, 150 distinct types → 3,328
  (type, cell) records. Six types get their own layer — Illegal Parking (17,888),
  Snow or Ice (14,957), Noise-Residential (10,961), Street Condition (6,209),
  Damaged Tree (5,254), HEAT/HOT WATER (3,660). **Every other type is still
  counted, under "All other types"** — filtered, never dropped.
- **Trees:** 172,172 rows in the bounding box → 13,092 fall outside the borough
  polygon (precise clip) → 34,865 are stumps, retired records, or dead/critical
  → **124,215 standing living trees**, rendered as **32,689 thinned points**
  (one per 40 m cell). `trees_meta.json` states both numbers so the layer never
  implies one dot = one tree.
- **Roads:** 16,714 → 16,692. The 22 dropped are `step` (step streets) and
  `nonphysical` (paper streets) — both listed in the run output.
- **Budget:** FY2026 ADOPTED, Staten Island: **$340.2M across 2,812 budgeted
  positions**, 8 agencies. Carries an explicit note that this is only the
  agencies OMB reports geographically, not the whole city budget.
- **Population:** 487,155 (2020 Census). 2030/2040 kept in a separate
  `projected` object so they can never be shown as if they were counts.

### Deferred

- Anything live (MTA, 511NY) — static exports only, as specified.
- Vector tiling (`tippecanoe`/PMTiles). Deliberately not added. Plain
  simplified GeoJSON first; the Phase 3 gate decides whether it's needed.
- Compact binary/array encoding for the tree layer (~4× smaller). Only worth it
  if the perf pass says so.

### Self-review against the rules

- *Rule 2 (no invented data)* — the sharpest test in this phase, and it holds:
  5,144 unjoined buildings stay `unknown`; 92 heightless buildings stay
  heightless; 34,865 non-standing tree records are excluded rather than drawn as
  trees; 144 unrendered 311 types are aggregated rather than discarded. Every
  reduction is counted in the run output and written into a `*_meta.json` the UI
  can surface.
- *Rule 3 (minimal first)* — no tiling toolchain, no new dependencies beyond
  `requests`/`shapely`/`pyproj`.
- *Creep check:* the tree living/standing filter wasn't in the plan. It is a
  correctness fix, not a feature — rendering 27,953 "Retired" records and 7,883
  stumps as trees would have been the dishonest option. Documented in
  `trees_meta.json`.
- *Honest flag:* `buildings.geojson` at 42 MB raw is the one number I'm not
  comfortable with. It is fine gzipped, but browser parse + tile time is the
  real risk. **Phase 3's performance gate is where this gets decided**, and I'd
  rather fail it there loudly than paper over it now.
