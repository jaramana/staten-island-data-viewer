# Staten Island Data Viewer — Build Prompt for Claude Code

## How to run this

Open a terminal in a fresh empty project directory and start Claude Code, then paste this entire document as your first message (or save it as `PLAN.md` in that directory and tell Claude Code to read it and begin at Phase 0). Claude Code will work through the phases below on its own, but is instructed to **stop and report at the end of every phase** rather than run start-to-finish unattended — so expect a series of short check-ins, not one long unattended run. At each stop, the simplest useful thing you can do is look at what it built (open the page, or paste in a screenshot) and reply "looks right, continue" or point out what's off — you don't need to read code to do this.

---

## 0. What this project is (read this before touching anything)

You are building an **interactive-to-view, not-playable** data viewer of Staten Island, styled as closely as reasonably achievable after SimCity 4, built entirely from real NYC open data. It is a standalone project — not visually tied to any other Coruña Labs tool. It is explicitly **not a game the user can play** — there is no building, no simulation logic, no player agency over the city — but within that, full free-camera exploration and click/hover interactivity is the point, not an afterthought. The user flies around a static (snapshot-in-time) 3D city, inspects things, and toggles between data views: population, crime, 311 complaints, trees, transit, budget, news. Think of it as "SimCity 4's camera, chrome, and feel, wrapped around a real dataset instead of a simulation engine."

### Non-negotiable rules

1. **Interactive viewer, not a playable game.** The user should be able to freely pan/zoom/tilt the camera, click buildings/precincts/firehouses/trees/planes for info popups, toggle between data views, and hover for tooltips — full interactivity is expected and good. What's out of scope is anything that lets the user *change* the city: no building placement, no zoning, no bulldozing, no budget sliders that do anything, no editable state of any kind. The test is simple: does this action change what the city looks like or how it behaves for the next viewer? If yes, it's out of scope — stop and ask before building it. If it just reveals more information about what's already there, it's in scope.
2. **No invented data.** If a dataset doesn't cover something, don't fake it. You may *stylize/exaggerate the presentation* of real data (bigger crime dots, punchier color ramps, animated transitions) but the underlying numbers must trace back to a real source. If there's no data for a feature the user wants, say so instead of generating placeholder content.
3. **Minimal first, always.** Every phase below has a "smallest version that works" and a list of things explicitly deferred. Build the smallest version, get it running end-to-end, then stop.
4. **Phase gates are mandatory, and include a self-review.** At the end of every phase: (a) re-read this document's rules and the current phase's deliverable/deferred list, (b) check your own work against them honestly — did anything creep in that wasn't asked for, does anything look like invented data, does anything accidentally let the user change the city — and fix or flag anything you find before reporting, (c) summarize what was built with what's explicitly deferred, and (d) wait for the go-ahead before starting the next phase. Do not chain phases together autonomously. This self-review step, plus the user's own visual check-in (§ How to run this), is the review process for this project — no separate reviewer agent is needed given the project's size, but if any phase feels uncertain or the code is getting hard to reason about, say so explicitly rather than guessing.
5. **This is a standalone project, not a Coruña Labs tool.** It does not share a template, palette, typography, or component library with Bus Works, ADRH Mapper, or corunalabs.org, and should not be made to look consistent with them. It should look and feel as close to SimCity 4 as reasonably achievable in a browser — its own distinct visual identity, built from scratch. Everything is fair game for that identity (palette, chrome, fonts, UI sounds, panel style, iconography) with exactly two exceptions: no actual SimCity 4 IP (code, art, fonts, or audio files) and no invented NYC data. Real inspiration-by-eye from SC4's look (recreating a similar *style* in original code/assets) is fine; copying its literal files is not.
6. **No copyrighted assets committed to the repo.** No SimCity 4 music files, no scraped tile art from other projects, no stock imagery of unclear license. See §5 (Audio) and §6 (Visual assets) below for the actual approach.

---

## 1. Scope lock

- **Geography:** Staten Island only. Not the whole city, not Brooklyn. Rationale: smallest building/lot count of any borough (best chance of smooth browser rendering with zero backend), and it's the only borough with a usable flight-path story — Newark (EWR) approach corridors cross low over the North Shore, which satisfies the "planes flying real flight paths" request with real data (see §4.5).
- **Time model:** A snapshot, not a live simulation. Where a feed is genuinely live (MTA, 511NY), it's an optional enhancement layered on top of the static base — never a requirement for the core experience to work.
- **Stack:** Static site. Vanilla HTML/CSS/JS + MapLibre GL. A standalone visual identity built for this project alone — no shared masthead, no trilingual `?lang=` pattern, no inherited component library (see rule 5). English only unless the user says otherwise. No frontend framework, no backend server, no database. All heavy data processing happens offline in a one-time (or periodically re-run) build pipeline that outputs static GeoJSON/JSON files the frontend fetches.
- **Hosting:** Static hosting — GitHub Pages or Cloudflare Pages, whichever is simpler to stand up for a standalone project.

---

## 2. The core architectural decision: procedural buildings, not art assets

Do **not** attempt to source or generate hand-crafted building sprites/tiles (e.g. isometric pixel art). This is a trap that will consume the entire project. Instead:

- Use the **3-D Building Model** dataset for real building footprints and heights.
- Use **PLUTO** for land-use category per tax lot (residential, commercial, industrial, institutional, mixed, vacant, etc.).
- Join the two, and render buildings as **MapLibre `fill-extrusion` layers**: real footprint, real height, colored by real land-use category, with a `pitch`/`bearing` camera locked to feel isometric-ish (SimCity camera angle), not literal isometric pixel art.

This gets you the "SimCity look" — a colorful extruded city skyline — for free from data you already have, with zero art asset sourcing risk and zero art-generation cost. It is also the single biggest scope-reduction decision in this plan; do not revisit it later in favor of custom art unless the user explicitly asks.

Non-building visual elements (trees, planes, precinct/firehouse markers, transit vehicles) are simple primitive shapes/icons/billboards — not custom art either. They can and should still be styled with real SC4 personality (chunky outlines, saturated palette, playful iconography) — "no sourced art" is a constraint on *where assets come from*, not on how game-like the result is allowed to look.

### 2.1 "Video-game quality" without sourcing any assets

This was an open question: should we use Google's Photorealistic 3D Tiles (the same raw input cannoneyed used) to get real-looking buildings for free instead of stylized extrusions?

**Recommendation: no, not as the primary layer.** Photorealistic 3D Tiles are a baked photogrammetry mesh — gorgeous, but you cannot recolor individual buildings by land-use, crime rate, or any other data dimension, because there's no per-building data binding, just a textured surface. That breaks the core premise of this project (a *data* viewer). It also requires a Google Maps Platform billing account with usage-based cost beyond a free tier, and heavy tiles are exactly why cannoneyed had to pre-bake his version into flat pixel art rather than serve it live. It's the wrong tool for a data-driven, always-interactive scene.

Instead, get the "game" feel entirely through techniques that are generated in code, not sourced from anywhere, layered onto the procedural extrusions from §2:

- **MapLibre's built-in `sky`, `fog`, and `light` layers** — real atmospheric depth, sun-angle-based shading on extruded buildings, distance haze. This alone does most of the work of making flat-colored blocks feel like a rendered scene instead of a GIS map.
- **A tiny self-generated texture for building facades** (a 4x4 or 8x8 canvas pattern drawn in code representing windows, tiled across each extrusion) — this is code-generated, not sourced art, and is a classic cheap trick for making extrusions read as "buildings" rather than "colored boxes."
- **Real aerial orthoimagery as a ground texture** — NY State GIS / NYC Open Data publish orthoimagery tiles for the city. Draping this under the extrusions (visible at street level, faded out under buildings) is real open data, not art, and adds a lot of visual richness for free.
- **A soft day/night lighting cycle** (already planned in Phase 5) plus subtle animated cloud shadows drifting across the terrain — cheap, code-only, very "SimCity."
- **A light CSS/canvas post-process pass** — slight vignette, bloom on lit windows at night, subtle film-grain — the kind of thing that makes a flat-shaded scene feel considered rather than raw. All parameters, no external images.

None of this requires sourcing, licensing, or generating a single external visual asset. If, after Phase 7, the result still feels too flat, Google's Photorealistic 3D Tiles can be reconsidered as a strictly optional, non-default "cinematic/context" backdrop layer sitting *behind* the data-driven buildings — but that's a real scope addition (new API, new billing, new performance budget) and should only happen as a deliberate, separately-scoped decision, not a default part of this build.

---

## 3. Data plan

For every dataset below: pull the most recently published vintage at build time, record that vintage (date/version) in a `DATA_SOURCES.md` manifest and surface it in the UI (small "data as of" footer), and clip/filter to Staten Island only before processing further.

| Dataset | Role | Vintage guidance | Notes |
|---|---|---|---|
| [3-D Building Model](https://data.cityofnewyork.us/City-Government/3-D-Building-Model/tnru-abg2) | Building footprints + heights for extrusion | Latest available (likely not 2026) | Core geometry for §2 |
| [PLUTO](https://www.nyc.gov/content/planning/pages/resources/datasets/mappluto-pluto-change) | Land-use category per lot, joined to buildings by BBL | Latest available | Drives extrusion color ramp |
| [311 Service Requests](https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2020-to-Present/erm2-nwe9) | 311 data view | Rolling — pull most recent window (e.g. trailing 12 months), this will be genuinely 2026 data | Pick 4-6 most visually/narratively compelling complaint types (noise, heat/hot water, illegal parking, street condition, etc.) rather than all ~300 types — see Phase 4 |
| [NYPD Complaint Data (current year)](https://data.cityofnewyork.us/Public-Safety/NYPD-Complaint-Data-Current-Year-To-Date-/5uac-w243) | Crime data view | Rolling, current | Aggregate to precinct or grid cell for the "game-like" heatmap; don't plot every individual point |
| [Forestry Tree Points](https://data.cityofnewyork.us/Environment/Forestry-Tree-Points/hn5i-inap) | Tree placement | Fixed historical census — don't relabel it as current | Sample/thin the dataset for a representative-density tree layer, not every real tree |
| [LION](https://data.cityofnewyork.us/City-Government/LION/2v4z-66xt) | Street basemap geometry | Latest available | Restyle from scratch in the game's palette — this is your road network source of truth, not a literal basemap tile |
| [Police Precincts](https://data.cityofnewyork.us/Public-Safety/Police-Precincts/y76i-bdw7) | Click-to-boundary | Latest available | Click a precinct icon → highlight boundary polygon |
| [Fire Companies](https://data.cityofnewyork.us/Public-Safety/Fire-Companies/iiv7-jaj9) / [Firehouse Listing](https://data.cityofnewyork.us/Public-Safety/FDNY-Firehouse-Listing/hc8x-tcnd) | Click-to-boundary | Latest available | Same pattern as precincts |
| [MTA real-time](https://api.mta.info) | Optional: moving buses/trains | Live | GTFS-realtime, requires free API key. Bus Works already solved a version of this problem (rate-limit fallback to simulated movement on real route geometry) — reuse that pattern directly rather than re-solving it |
| [511NY](https://511ny.org/developers/help) | Optional: live traffic data view | Live | Requires free developer key, 10 requests/60s throttle — cache aggressively, this cannot be polled per-user-session at scale, poll server-side/build-time or very sparingly client-side |
| NYC Council Budget dashboard | Budget panel | Unresolved | No accessible raw API found during planning. Phase 0 task: confirm this, and if no API exists, fall back to Checkbook NYC (checkbookNYC.com) or NYC Open Data's Expense Budget datasets for the budget panel instead |
| News box | Timestamped headline feed | Not resolved | No live NYC-specific news API without a paid key/approval process was confirmed during planning. Recommended default: pull from a small set of NYC-focused RSS feeds (e.g. Staten Island Advance / SILive, Gothamist) at build time and display as timestamped headlines — explicitly not real-time, framed as "as of [date]" like everything else. Confirm with user before building against any specific feed given RSS terms vary |

---

## 4. Phases

Each phase ends with: a working, demoable increment; a short written summary; an explicit "deferred" list; and a stop for user sign-off.

### Phase 0 — Foundations & open decisions
**Goal:** Nothing visual yet. Resolve every unknown so later phases don't stall.
- Define this project's own visual identity: palette, typography, HUD chrome style, panel/iconography conventions — inspired by SimCity 4's look (watch/reference the review video the user linked for tone) but built entirely from original code and assets. This is a standalone identity, not shared with other Coruña Labs tools.
- Register for MTA and 511NY developer API keys (or confirm the user already has them).
- Resolve the Council Budget dashboard question (§3) — API or fallback source, decided and documented.
- Resolve the News box source (§3) — pick a specific feed or set, confirm with user.
- Set up the offline data-processing pipeline skeleton (Python, matching the user's existing R/Python comfort) — download scripts for each dataset, output to a `/data/raw` folder (gitignored).
- Write `DATA_SOURCES.md`: one row per dataset, with actual vintage/date pulled, license, and access method.
- **Deliverable:** empty repo scaffold, all keys/accounts confirmed working with a trivial test call, `DATA_SOURCES.md` filled in, no UI yet.

### Phase 1 — Data pipeline
**Goal:** Every dataset clipped to Staten Island, cleaned, joined where needed, exported as static GeoJSON/JSON.
- Clip all datasets to Staten Island boundary.
- Join Building Model ↔ PLUTO on BBL; classify land use into a small fixed set of categories (5-8 max) for the color ramp.
- Aggregate crime to precinct or hex/grid cells.
- Select and filter the 311 complaint categories chosen in Phase 0.
- Thin/sample tree points to a reasonable on-screen density.
- Simplify LION geometry for rendering performance.
- **Deferred:** anything live (MTA/511NY) — build against static exports only in this phase.
- **Deliverable:** a `/data/processed` folder of final static files the frontend can fetch directly, each under a sane size budget (state the byte size of each file in your summary).

### Phase 2 — Base map & camera
**Goal:** An empty but real Staten Island — streets, water, borough boundary, locked camera — using the shared template.
- MapLibre instance, restyled toward SimCity 4's actual palette and mood as closely as achievable in original code — this is one of the two places (with §2.1) where "as close to SC4 as possible" should really show up.
- Roads from LION, restyled.
- `SERVICE_AREA`/`MAX_BOUNDS`, `minZoom`, pitch/bearing locked to a SimCity-like oblique angle.
- **Deliverable:** a pannable/zoomable empty Staten Island in the game's visual language, no buildings yet.

### Phase 3 — Procedural buildings
**Goal:** The core "SimCity" visual — extruded, color-coded buildings across the whole borough.
- `fill-extrusion` layer from the Phase 1 building+PLUTO join.
- Color ramp by land-use category, height from real building height.
- Performance pass: confirm smooth pan/zoom with the full building set before moving on — this is the highest technical-risk phase, don't proceed until it's actually smooth.
- **Deliverable:** the full extruded city, performant, no data-view toggles yet.

### Phase 4 — Data views
**Goal:** The actual "viewer" functionality — toggleable overlays.
- Crime heatmap/points toggle.
- 311 category toggle(s) — chosen categories from Phase 0/1 only.
- Tree layer toggle.
- Precinct/firehouse click-to-boundary interaction.
- An SC4-style HUD switcher (tab strip or dropdown along the chrome, in this project's own visual language) to move between views.
- **Deferred:** live traffic, live transit — still out of scope here.
- **Deliverable:** every data view working independently, one at a time, cleanly toggleable.

### Phase 5 — Game-like flourishes
**Goal:** The small set of things that make this feel like SimCity rather than a GIS dashboard. Keep this phase tightly scoped — it is the most tempting place for scope creep.
- Animated planes along real EWR approach/departure corridors over the North Shore (a small number of simplified flight paths, not real-time ADS-B — state clearly in the UI that these are illustrative of real approach corridors, not live flights, unless the user wants to pursue a live flight-data source as a separate, explicitly-scoped addition).
- Day/night lighting cycle on a timer (cosmetic only).
- Population/budget headline numbers panel (SimCity-style HUD strip), sourced from Census/ACS or NYC Open Data population figures for Staten Island plus the budget source resolved in Phase 0.
- News box, static/timestamped per Phase 0 decision.
- Audio: source 2-3 freely licensed SC4-mood tracks per §5, plus the local-drop-in hook. Confirm the shortlisted tracks with the user before committing them (license + vibe check) rather than picking unilaterally.
- **Deferred:** anything not explicitly listed above. If it's tempting, it's deferred — flag it and ask.
- **Deliverable:** the HUD, planes, day/night, and news box, each demoable independently.

### Phase 6 — Live layers (optional, only if user confirms after Phase 5)
**Goal:** MTA and 511NY live data, if the user still wants it after seeing the static version.
- A rate-limit-aware fallback pattern (poll sparingly, cache aggressively, fall back to simulated movement on real route geometry if a feed is unavailable).
- Cache 511NY responses aggressively given the 10-req/60s throttle; never poll per-client.
- **Deliverable:** live layers as an additive toggle, with graceful fallback to static/simulated behavior if a feed is down or rate-limited.

### Phase 7 — Polish & performance pass
**Goal:** Ship-quality pass across the whole thing, not new features.
- Cross-device performance check (this is a heavy WebGL scene; test on a mid-range laptop, not just the dev machine).
- Trim/re-simplify any dataset that's still causing jank.
- Final UI pass against this project's own SC4-inspired visual identity from Phase 0 — consistency with *itself*, not with other Coruña Labs tools.
- **Deliverable:** a version the user would actually share a link to.

### Phase 8 — Deploy
- Static hosting (GitHub Pages or Cloudflare Pages).
- `DATA_SOURCES.md`, `AUDIO_SOURCES.md`, and the data-vintage footer all accurate and visible in the shipped build.

---

## 5. Audio

Source 2-3 freely licensed tracks in a similar mood — ambient, ~100-120bpm, jazzy/lounge-adjacent city-builder music — from legitimate royalty-free sources (e.g. Kevin MacLeod / incompetech under CC-BY, Pixabay Music, itch.io royalty-free packs, or similar libraries with clear commercial-use licenses). For each track picked: record the source URL, license type, and any attribution requirement in an `AUDIO_SOURCES.md` file in the repo, and satisfy that attribution in the UI (e.g. a small credits line) if the license requires it. Do not use anything with an unclear or "free for personal use only" license.

Also keep a "drop your own local tracks into `/audio/local` (gitignored)" hook as an additional, optional local-only option — so the user's own SC4 soundtrack (which they own) can play locally without ever being part of the shipped/committed build.

## 6. Visual assets — explicit note

Do not scrape, reference as a source, or attempt to reuse tile images from cannoneyed's Isometric NYC project — those are his own AI-generated artwork, not a licensed asset source, and stylistically mismatched to this project's data-driven-extrusion approach (§2). All visuals in this project come from real geometry + real attributes, styled with color/height/camera angle — not from sourced or generated illustration.

---

## 7. Running "not doing" list (update as the project progresses)

Keep this section current in the repo itself. Anything that shows up here stays out unless the user explicitly reopens it.

- No building/zoning/editing of any kind — free camera and inspection are fine, changing the city is not.
- No fabricated NYC data to fill visual gaps.
- No whole-city rendering — Staten Island only.
- No custom/AI-generated building art.
- No SimCity 4 IP of any kind (code, art, fonts, or audio files) — but freely licensed SC4-mood music (2-3 tracks, sourced and documented per §5) is fine. 
- No visual or template consistency with other Coruña Labs tools — this project has its own identity.
- No live simulation engine (traffic AI, population growth model, etc.) — this is a viewer of real snapshots, not a simulator in the mechanical sense.
