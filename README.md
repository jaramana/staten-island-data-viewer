# Staten Island Data Viewer

An interactive-to-view — **not playable** — 3D data viewer of Staten Island,
styled after early-2000s city-builder games and built entirely from real NYC
open data. Fly the camera, click things, toggle between data views. You cannot
change the city, because the city is a snapshot of real records.

Static site: vanilla HTML/CSS/JS + MapLibre GL. No framework, no backend, no
database. All heavy processing happens offline in `pipeline/`, which emits
static files to `data/processed/` that the frontend fetches directly.

See [PLAN.md](PLAN.md) for the full build plan, [DATA_SOURCES.md](DATA_SOURCES.md)
for provenance of every dataset, [docs/VISUAL_IDENTITY.md](docs/VISUAL_IDENTITY.md)
for the design system, and [NOT_DOING.md](NOT_DOING.md) for what's deliberately
out of scope.

## Repo layout

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

## Running the pipeline

```bash
python3 -m venv .venv && .venv/bin/pip install -r pipeline/requirements.txt
```

Check every source is reachable and see current vintages and row counts
(no download, ~1 minute):

```bash
.venv/bin/python pipeline/download.py --check
```

Full download to `data/raw/` (large, several minutes):

```bash
.venv/bin/python pipeline/download.py
```

Regenerate the provenance doc from what was actually fetched:

```bash
.venv/bin/python pipeline/make_data_sources.py
```

## Data honesty rules

1. Every rendered value traces to a published dataset row. Presentation is
   stylised; numbers are not.
2. Vintages are read from the publisher's API at fetch time and never typed by
   hand — `DATA_SOURCES.md` is generated, not written.
3. Missing data renders as missing, with its own legend entry.
