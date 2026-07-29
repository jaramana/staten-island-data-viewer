#!/usr/bin/env python3
"""Download every source in sources.py to data/raw/, and record its vintage.

    python pipeline/download.py --check          # trivial test call per source
    python pipeline/download.py                  # full download
    python pipeline/download.py --only buildings # one source

Raw output is gitignored. `data/raw/_manifest.json` records, per source, the
row count actually received, the publisher's own last-updated timestamp, and
when we fetched it — that manifest is what DATA_SOURCES.md and the in-app
"data as of" footer are built from, so no vintage is ever hand-typed.
"""

import argparse
import datetime as dt
import json
import os
import sys
import time

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sources import DOMAIN, SOURCES  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
PAGE = 50000
TIMEOUT = 300

# 311 is a rolling feed; we take a trailing 12 months as of the download date.
SR311_WINDOW_DAYS = 365

session = requests.Session()
session.headers.update({"User-Agent": "staten-island-data-viewer/0.1 (open data pipeline)"})


def utcnow():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0)


def resolve_where(key, spec):
    """Fill in any time-relative filter at download time."""
    if spec.get("where_template"):
        since = (utcnow() - dt.timedelta(days=SR311_WINDOW_DAYS)).strftime("%Y-%m-%dT00:00:00")
        return spec["where_template"].format(since=since)
    return spec.get("where")


def get(url, params, tries=4):
    for attempt in range(tries):
        try:
            r = session.get(url, params=params, timeout=TIMEOUT)
            if r.status_code == 200:
                return r.json()
            if r.status_code in (429, 500, 502, 503, 504):
                time.sleep(3 * (attempt + 1))
                continue
            raise RuntimeError(f"HTTP {r.status_code}: {r.text[:300]}")
        except requests.RequestException as exc:
            if attempt == tries - 1:
                raise
            print(f"    retry after {exc.__class__.__name__}")
            time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"gave up on {url}")


def metadata(spec):
    """Publisher's own metadata: name, last-updated, licence, attribution."""
    m = get(f"{DOMAIN}/api/views/{spec['id']}.json", {})
    updated = m.get("rowsUpdatedAt")
    return {
        "socrata_id": spec["id"],
        "published_name": m.get("name"),
        "attribution": m.get("attribution"),
        "attribution_link": m.get("attributionLink"),
        "license": (m.get("license") or {}).get("name") or "NYC Open Data Terms of Use",
        "publisher_updated_at": (
            dt.datetime.fromtimestamp(updated, dt.timezone.utc).replace(microsecond=0).isoformat()
            if updated
            else None
        ),
        "landing_page": f"{DOMAIN}/d/{spec['id']}",
    }


def count(spec, where):
    params = {"$select": "count(*) as n"}
    if where:
        params["$where"] = where
    rows = get(f"{DOMAIN}/resource/{spec['id']}.json", params)
    return int(rows[0]["n"])


def fetch_all(key, spec, where, expected):
    url = f"{DOMAIN}/resource/{spec['id']}.json"
    out, offset = [], 0
    while True:
        params = {"$limit": PAGE, "$offset": offset}
        if spec.get("select"):
            params["$select"] = spec["select"]
        if where:
            params["$where"] = where
        if spec.get("order"):
            params["$order"] = spec["order"]
        page = get(url, params)
        out.extend(page)
        print(f"    {len(out):>7,} / {expected:,}")
        if len(page) < PAGE:
            return out
        offset += PAGE


def run(keys, check_only):
    os.makedirs(RAW, exist_ok=True)
    manifest_path = os.path.join(RAW, "_manifest.json")
    manifest = {}
    if os.path.exists(manifest_path):
        with open(manifest_path) as fh:
            manifest = json.load(fh)

    failures = []
    for key in keys:
        spec = SOURCES[key]
        where = resolve_where(key, spec)
        print(f"\n[{key}] {spec['title']}")
        try:
            meta = metadata(spec)
            n = count(spec, where)
            print(f"    publisher updated {meta['publisher_updated_at']} | {n:,} rows match filter")

            entry = dict(
                meta,
                title=spec["title"],
                agency=spec["agency"],
                role=spec.get("role"),
                note=spec.get("note"),
                filter=where,
                select=spec.get("select"),
                rows_matching_filter=n,
                checked_at=utcnow().isoformat(),
            )

            if check_only:
                # Keep any previously-downloaded detail; refresh the vintage.
                manifest[key] = dict(manifest.get(key, {}), **entry)
                continue

            rows = fetch_all(key, spec, where, n)
            path = os.path.join(RAW, f"{key}.json")
            with open(path, "w") as fh:
                json.dump(rows, fh)

            entry.update(
                rows_downloaded=len(rows),
                bytes_raw=os.path.getsize(path),
                fetched_at=utcnow().isoformat(),
                raw_file=f"data/raw/{key}.json",
            )
            manifest[key] = entry
            print(f"    wrote {path} ({os.path.getsize(path)/1e6:.1f} MB)")
        except Exception as exc:  # noqa: BLE001 — report all, fail at the end
            print(f"    FAILED: {exc}")
            failures.append((key, str(exc)))

    with open(manifest_path, "w") as fh:
        json.dump(manifest, fh, indent=2, sort_keys=True)
    print(f"\nmanifest -> {manifest_path}")

    if failures:
        print("\nFAILURES:")
        for key, msg in failures:
            print(f"  {key}: {msg}")
        return 1
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", choices=sorted(SOURCES), help="subset of sources")
    ap.add_argument("--check", action="store_true", help="metadata + row count only, no download")
    args = ap.parse_args()
    sys.exit(run(args.only or list(SOURCES), args.check))
