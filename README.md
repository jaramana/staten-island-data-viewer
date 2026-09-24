# Staten Island Data Viewer

A 3D map of Staten Island, built from real NYC open data.

## Background

The viewer is a map, not a game. You can fly the camera, click features, and
switch between data views. You cannot change the city, because the city is a
snapshot of real records.

The visual style is drawn from early-2000s city-builder games. Its
game-inspired visuals display published New York City data.

The project is a static site: vanilla HTML, CSS, and JavaScript, with
MapLibre GL for the map. It has no framework, no backend, and no database.
All data processing happens offline, in `pipeline/`, and writes static files
to `data/processed/` that the site fetches directly.

Further documentation:

- [PLAN.md](PLAN.md) — the full build plan
- [DATA_SOURCES.md](DATA_SOURCES.md) — provenance of every dataset
- [docs/VISUAL_IDENTITY.md](docs/VISUAL_IDENTITY.md) — the design system
- [NOT_DOING.md](NOT_DOING.md) — what is deliberately out of scope

## Data source

See [DATA_SOURCES.md](DATA_SOURCES.md) for the full list of datasets and
their provenance. This file is generated from the pipeline's fetch manifest.
It is not written by hand.

### Data honesty rules

1. Every rendered value traces to a published dataset row. The presentation
   is stylised; the numbers are not.
2. Vintages are read from the publisher's API at fetch time. They are never
   typed by hand.
3. Missing data renders as missing, with its own legend entry.

## Tools used

Vanilla HTML, CSS, and JavaScript, with MapLibre GL for the map. Python for
the offline data pipeline. Node for the local development server. Claude for
development.

## Repository layout

```
pipeline/          offline Python data pipeline
  sources.py         dataset registry — the single source of truth
  download.py        fetch raw data -> data/raw/ (gitignored)
  make_data_sources.py  regenerate DATA_SOURCES.md from the fetch manifest
  landuse.py         PLUTO land-use code -> render category mapping
data/raw/          raw downloads (gitignored, reproducible)
data/processed/    static GeoJSON/JSON the frontend fetches
site/              the static site
docs/              design + decision docs
audio/local/       drop-in slot for your own music (gitignored, never shipped)
```

## Usage

Install the pipeline's dependencies:

```bash
python3 -m venv .venv && .venv/bin/pip install -r pipeline/requirements.txt
```

Check that every data source is reachable, and see current vintages and row
counts. This does not download anything and takes about a minute:

```bash
.venv/bin/python pipeline/download.py --check
```

Download all data to `data/raw/`. This is large and takes several minutes:

```bash
.venv/bin/python pipeline/download.py
```

Regenerate the provenance document from what was actually fetched:

```bash
.venv/bin/python pipeline/make_data_sources.py
```

To view the site locally:

```bash
node pipeline/serve.js 8787
```

Then open <http://localhost:8787/site/index.html>.

`?pump=1` is a development-only flag. A hidden or backgrounded browser tab
never receives `requestAnimationFrame`, and MapLibre schedules style
loading, tile loading, and rendering through it. In a headless or automated
context, the map silently never finishes loading. This flag installs a
`MessageChannel`-backed animation frame so the page can be screenshotted.
Normal use needs nothing.
