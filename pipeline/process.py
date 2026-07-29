#!/usr/bin/env python3
"""Turn data/raw/*.json into the static files the frontend fetches.

    python pipeline/process.py            # everything
    python pipeline/process.py buildings  # one step

Every step is clip -> reduce -> round -> write, and every step prints the byte
size of what it wrote. Nothing is invented: where a join fails or a field is
absent, the output says so explicitly (see the `unknown` land-use category)
rather than guessing a plausible value.
"""

import json
import os
import sys
from collections import Counter, defaultdict

from shapely.geometry import shape
from shapely.prepared import prep

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import geo  # noqa: E402
from landuse import category as lu_category  # noqa: E402
from landuse import legend as lu_legend  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
OUT = os.path.join(ROOT, "data", "processed")

# --- tuning knobs, all stated so they can be argued with -------------------
SIMPLIFY_BUILDING = 4e-6     # ~0.45 m — below the source's own precision
SIMPLIFY_ROAD = 8e-6         # ~0.9 m
SIMPLIFY_PARK = 2e-5         # ~2.2 m
SIMPLIFY_BOUNDARY = 1e-5     # ~1.1 m
SIMPLIFY_DISTRICT = 1e-5     # precinct / fire company boundaries

# Thinning grid: at most one tree point per cell. 40 m keeps the *pattern* of
# where the borough's street trees are (dense on the North Shore grid, sparse
# on the South Shore) at a fraction of the payload. Both the true in-borough
# count and the rendered count are written to trees_meta.json and shown in the
# UI, so the layer never implies it is one-dot-per-tree.
TREE_MIN_SPACING_M = 40

# Forestry Tree Points is a rolling inventory of *planting spaces*, so it also
# carries stumps and retired records. Only standing living trees are rendered.
TREE_STRUCTURES = {"Full", "Shaft"}
TREE_DEAD_CONDITIONS = {"Dead", "Critical"}
CRIME_HEX_M = 300            # hex circumradius for the crime grid
SR311_HEX_M = 300

FT_TO_M = 0.3048

# The 311 complaint types rendered as their own layer. Chosen from the real
# trailing-12-month Staten Island distribution (see docs/PHASE_LOG.md) for
# volume + narrative legibility. Everything else is still counted, under
# "All other types" — filtered, never silently dropped.
SR311_TYPES = [
    "Illegal Parking",      # 17,888 — the borough's single loudest complaint
    "Snow or Ice",          # 14,957 — seasonal, and very Staten Island
    "Noise - Residential",  # 10,961
    "Street Condition",     #  6,209 — potholes and paving
    "Damaged Tree",         #  5,254 — pairs with the tree layer
    "HEAT/HOT WATER",       #  3,660 — named in PLAN.md §3 as a wanted category
]

# NYPD offence level -> the three-way split the crime view uses.
LAW_CAT = {"FELONY": "felony", "MISDEMEANOR": "misdemeanor", "VIOLATION": "violation"}


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def load(name):
    with open(os.path.join(RAW, f"{name}.json")) as fh:
        return json.load(fh)


def write(name, obj):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    with open(path, "w") as fh:
        json.dump(obj, fh, separators=(",", ":"))
    size = os.path.getsize(path)
    n = len(obj.get("features", [])) if isinstance(obj, dict) else 0
    print(f"    -> {name:28s} {size/1e6:7.2f} MB" + (f"  ({n:,} features)" if n else ""))
    return {"file": name, "bytes": size, "features": n}


def norm_bbl(v):
    """PLUTO and the footprint file spell BBL differently ('5000010010',
    '5000010010.0', 5000010010). Normalise to a plain digit string."""
    if v in (None, "", "0"):
        return None
    try:
        return str(int(float(v)))
    except (TypeError, ValueError):
        return None


def fnum(v):
    try:
        f = float(v)
        return f
    except (TypeError, ValueError):
        return None


REPORT = {}


def si_polygon():
    """The Staten Island clip polygon, as a prepared shapely geometry."""
    rows = load("borough_boundary")
    g = shape(rows[0]["the_geom"])
    return g, prep(g)


# --------------------------------------------------------------------------
# steps
# --------------------------------------------------------------------------

def step_boundary():
    print("[boundary]")
    rows = load("borough_boundary")
    g = geo.clean_geom(rows[0]["the_geom"], SIMPLIFY_BOUNDARY)
    f = geo.feature(g, {"boro": "Staten Island", "borocode": 5})
    REPORT["boundary"] = write("boundary.geojson", geo.fc([f]))


def step_parks():
    print("[parks]")
    feats = []
    for r in load("parks"):
        g = geo.clean_geom(r.get("multipolygon"), SIMPLIFY_PARK)
        if not g:
            continue
        feats.append(geo.feature(g, {
            "name": r.get("signname") or "",
            "kind": r.get("typecategory") or "",
            "acres": round(fnum(r.get("acres")) or 0, 1),
        }))
    REPORT["parks"] = write("parks.geojson", geo.fc(feats))


ROAD_CLASS = {
    # CSCL rw_type -> render class. DCP's own meanings, grouped for styling.
    "1": "street", "2": "highway", "3": "bridge", "4": "tunnel",
    "5": "path", "6": "path", "7": "step", "8": "service", "9": "ramp",
    "10": "service", "11": "street", "12": "nonphysical", "13": "ramp",
    "14": "ferry",
}


def step_roads():
    print("[roads]")
    feats = []
    skipped = Counter()
    for r in load("streets"):
        cls = ROAD_CLASS.get(str(r.get("rw_type") or "").strip(), "street")
        if cls in ("nonphysical", "step"):
            skipped[cls] += 1
            continue
        g = geo.clean_geom(r.get("the_geom"), SIMPLIFY_ROAD)
        if not g:
            skipped["no_geom"] += 1
            continue
        feats.append(geo.feature(g, {
            "cls": cls,
            "w": int(fnum(r.get("streetwidth")) or 0),
            "spd": int(fnum(r.get("posted_speed")) or 0),
        }))
    print(f"    skipped: {dict(skipped)}")
    REPORT["roads"] = write("roads.geojson", geo.fc(feats))


def step_buildings():
    print("[buildings]")
    # PLUTO lookup: bbl -> the handful of attributes the popup and ramp need.
    pluto = {}
    for r in load("pluto"):
        b = norm_bbl(r.get("bbl"))
        if b:
            pluto[b] = r
    print(f"    pluto lots: {len(pluto):,}")

    feats = []
    stats = Counter()
    lu_counts = Counter()
    heights = []
    for r in load("buildings"):
        # 5 dp is ~1.1 m — coarser than the footprint source resolves, but this
        # is the single biggest lever on payload size across 142k polygons and
        # is invisible at any camera height this viewer allows.
        g = geo.clean_geom(r.get("the_geom"), SIMPLIFY_BUILDING, nd=5)
        if not g:
            stats["no_geom"] += 1
            continue

        bbl = norm_bbl(r.get("base_bbl")) or norm_bbl(r.get("mappluto_bbl"))
        lot = pluto.get(bbl) if bbl else None
        if lot is None:
            stats["unjoined"] += 1

        h_ft = fnum(r.get("height_roof"))
        h = round(h_ft * FT_TO_M, 1) if h_ft and h_ft > 0 else None
        if h:
            heights.append(h)
        else:
            stats["no_height"] += 1

        cat = lu_category(lot.get("landuse") if lot else None)
        lu_counts[cat] += 1

        props = {"lu": cat}
        if h:
            props["h"] = h
        # One year field: the footprint file's construction_year, falling back
        # to PLUTO's yearbuilt. Carrying both costs ~1 MB across the borough
        # and tells the reader nothing extra.
        yr = fnum(r.get("construction_year")) or (fnum(lot.get("yearbuilt")) if lot else None)
        if yr and yr > 1600:
            props["yr"] = int(yr)
        if lot:
            addr = (lot.get("address") or "").strip()
            if addr:
                props["ad"] = addr.title()
            fl = fnum(lot.get("numfloors"))
            if fl:
                props["fl"] = round(fl, 1)
            ur = fnum(lot.get("unitsres"))
            if ur:
                props["ur"] = int(ur)
        feats.append(geo.feature(g, props))

    heights.sort()
    print(f"    {len(feats):,} buildings | unjoined to PLUTO: {stats['unjoined']:,} "
          f"| no height: {stats['no_height']:,} | dropped (bad geom): {stats['no_geom']:,}")
    if heights:
        print(f"    height m: median {heights[len(heights)//2]:.1f}, "
              f"p95 {heights[int(len(heights)*0.95)]:.1f}, max {heights[-1]:.1f}")
    print(f"    land use: {dict(lu_counts.most_common())}")

    REPORT["buildings"] = write("buildings.geojson", geo.fc(feats))
    REPORT["buildings"].update(
        unjoined=stats["unjoined"], no_height=stats["no_height"],
        landuse_counts=dict(lu_counts),
    )
    write("legend_landuse.json", {"categories": lu_legend()})


def step_trees(si_prep):
    from shapely.geometry import Point

    print("[trees]")
    kept, cells = [], set()
    outside = not_standing = in_borough = 0
    species = Counter()
    for r in load("trees"):
        loc = r.get("location")
        if not loc or not loc.get("coordinates"):
            continue
        lon, lat = loc["coordinates"][0], loc["coordinates"][1]
        if not si_prep.contains(Point(lon, lat)):
            outside += 1
            continue
        if (r.get("tpstructure") not in TREE_STRUCTURES
                or r.get("tpcondition") in TREE_DEAD_CONDITIONS):
            not_standing += 1
            continue
        in_borough += 1
        species[(r.get("genusspecies") or "").split(" - ")[-1]] += 1

        x, y = geo.to_plane(lon, lat)
        cell = (int(x // TREE_MIN_SPACING_M), int(y // TREE_MIN_SPACING_M))
        if cell in cells:
            continue
        cells.add(cell)
        kept.append(geo.feature(
            {"type": "Point", "coordinates": [round(lon, 5), round(lat, 5)]},
            {"d": int(fnum(r.get("dbh")) or 0),
             "sp": (r.get("genusspecies") or "").split(" - ")[-1][:32]},
        ))
    print(f"    {in_borough:,} standing living trees in the borough -> {len(kept):,} rendered "
          f"| {outside:,} outside the polygon | {not_standing:,} stumps/retired/dead")
    REPORT["trees"] = write("trees.geojson", geo.fc(kept))
    REPORT["trees"].update(
        in_borough=in_borough,
        thinning=f"one point per {TREE_MIN_SPACING_M} m grid cell",
    )
    write("trees_meta.json", {
        "in_borough_standing": in_borough,
        "rendered": len(kept),
        "excluded_not_standing": not_standing,
        "thinning": f"at most one point per {TREE_MIN_SPACING_M} m grid cell",
        "top_species": [{"species": s, "n": n} for s, n in species.most_common(12)],
        "note": ("Forestry Tree Points is a rolling inventory of planting spaces, not a "
                 "dated tree census. Stumps, retired records and dead/critical trees are "
                 "excluded. The rendered layer is thinned for density: one dot is not "
                 "one tree."),
    })


def step_crime():
    print("[crime]")
    rows = load("crime")
    by_hex = defaultdict(Counter)
    by_pct = defaultdict(Counter)
    offences = Counter()
    dates = []
    nogeo = 0
    for r in rows:
        lat, lon = fnum(r.get("latitude")), fnum(r.get("longitude"))
        cat = LAW_CAT.get((r.get("law_cat_cd") or "").strip().upper())
        pct = (r.get("addr_pct_cd") or "").strip()
        d = (r.get("cmplnt_fr_dt") or "")[:10]
        if d:
            dates.append(d)
        if cat:
            offences[(cat, (r.get("ofns_desc") or "UNKNOWN").strip().title())] += 1
        if pct:
            by_pct[pct]["total"] += 1
            if cat:
                by_pct[pct][cat] += 1
        if lat is None or lon is None:
            nogeo += 1
            continue
        x, y = geo.to_plane(lon, lat)
        k = geo.hex_key(x, y, CRIME_HEX_M)
        by_hex[k]["total"] += 1
        if cat:
            by_hex[k][cat] += 1

    feats = []
    for (q, r_), c in by_hex.items():
        feats.append(geo.feature(geo.hex_polygon(q, r_, CRIME_HEX_M), {
            "n": c["total"], "fel": c["felony"], "mis": c["misdemeanor"], "vio": c["violation"],
        }))
    print(f"    {len(rows):,} complaints -> {len(feats):,} hex cells "
          f"| {nogeo:,} without coordinates (counted in precinct totals only)")
    REPORT["crime_hex"] = write("crime_hex.geojson", geo.fc(feats))

    # Precinct polygons carrying their own totals.
    pfeats = []
    for r in load("police_precincts"):
        pct = str(r.get("precinct"))
        g = geo.clean_geom(r.get("the_geom"), SIMPLIFY_DISTRICT)
        c = by_pct.get(pct, Counter())
        pfeats.append(geo.feature(g, {
            "precinct": pct, "n": c["total"], "fel": c["felony"],
            "mis": c["misdemeanor"], "vio": c["violation"],
        }))
    REPORT["precincts"] = write("precincts.geojson", geo.fc(pfeats))

    top = [{"cat": k[0], "offence": k[1], "n": v} for k, v in offences.most_common(15)]
    REPORT["crime_meta"] = write("crime_meta.json", {
        "total": len(rows),
        "no_coordinates": nogeo,
        "date_min": min(dates) if dates else None,
        "date_max": max(dates) if dates else None,
        "hex_metres": CRIME_HEX_M,
        "top_offences": top,
        "note": ("Year-to-date NYPD complaint records, aggregated to a hex grid and to "
                 "precinct. Individual complaint locations are deliberately not plotted."),
    })


def step_311():
    print("[311]")
    rows = load("sr311")
    chosen = set(SR311_TYPES)
    by_type_hex = defaultdict(Counter)
    type_counts = Counter()
    dates = []
    for r in rows:
        t = (r.get("complaint_type") or "").strip()
        type_counts[t] += 1
        d = (r.get("created_date") or "")[:10]
        if d:
            dates.append(d)
        key = t if t in chosen else "All other types"
        lat, lon = fnum(r.get("latitude")), fnum(r.get("longitude"))
        if lat is None or lon is None:
            continue
        x, y = geo.to_plane(lon, lat)
        by_type_hex[key][geo.hex_key(x, y, SR311_HEX_M)] += 1

    feats = []
    for t, cells in by_type_hex.items():
        for (q, r_), n in cells.items():
            feats.append(geo.feature(geo.hex_polygon(q, r_, SR311_HEX_M), {"t": t, "n": n}))
    print(f"    {len(rows):,} requests | {len(type_counts):,} distinct types "
          f"-> {len(feats):,} (type, cell) records")
    REPORT["sr311_hex"] = write("sr311_hex.geojson", geo.fc(feats))

    REPORT["sr311_meta"] = write("sr311_meta.json", {
        "total": len(rows),
        "window_start": min(dates) if dates else None,
        "window_end": max(dates) if dates else None,
        "hex_metres": SR311_HEX_M,
        "rendered_types": SR311_TYPES,
        "distinct_types": len(type_counts),
        "top_types": [{"type": t, "n": n} for t, n in type_counts.most_common(25)],
        "note": ("Trailing 12 months of Staten Island 311 requests. The six rendered "
                 "types are a selection; every other type is still counted under "
                 "'All other types' rather than dropped."),
    })


def step_services():
    print("[services]")
    ffeats = []
    for r in load("fire_companies"):
        g = geo.clean_geom(r.get("the_geom"), SIMPLIFY_DISTRICT)
        if not g:
            continue
        ffeats.append(geo.feature(g, {
            "co": f"{r.get('fire_co_type','')}{r.get('fire_co_num','')}",
            "bn": r.get("fire_bn"), "div": r.get("fire_div"),
        }))
    REPORT["fire_companies"] = write("fire_companies.geojson", geo.fc(ffeats))

    hfeats = []
    for r in load("firehouses"):
        lat, lon = fnum(r.get("latitude")), fnum(r.get("longitude"))
        if lat is None or lon is None:
            continue
        hfeats.append(geo.feature(
            {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
            {"name": r.get("facilityname"), "addr": r.get("facilityaddress")},
        ))
    REPORT["firehouses"] = write("firehouses.geojson", geo.fc(hfeats))


def step_stats():
    """Headline numbers for the HUD strip. Every one traceable, every one labelled."""
    print("[stats]")
    # Population — DCP borough table. 2030/2040 are projections and are marked.
    pop = {}
    for r in load("population"):
        if (r.get("borough") or "").strip() == "Staten Island" and \
           (r.get("age_group") or "").strip() == "Total Population":
            for yr in ("1950", "1960", "1970", "1980", "1990", "2000", "2010", "2020",
                       "2030", "2040"):
                v = fnum(r.get(f"_{yr}"))
                if v:
                    pop[yr] = int(v)
    # Budget — latest ADOPTED fiscal year for Richmond (Staten Island).
    brows = load("budget")
    adopted = [r for r in brows if (r.get("bud_phs_nm") or "") == "ADOPTED"]
    fy = max((r.get("fisc_yr") or "" for r in adopted), default=None)
    latest = [r for r in adopted if r.get("fisc_yr") == fy]
    by_agency = defaultdict(lambda: {"amt": 0.0, "pos": 0.0})
    for r in latest:
        a = by_agency[(r.get("agy_nm") or "").title()]
        a["amt"] += fnum(r.get("bud_amt")) or 0
        a["pos"] += fnum(r.get("bud_pos")) or 0
    agencies = sorted(
        ({"agency": k, "amount": round(v["amt"]), "positions": round(v["pos"])}
         for k, v in by_agency.items()),
        key=lambda d: -d["amount"],
    )

    stats = {
        "population": {
            "census": {y: n for y, n in pop.items() if y <= "2020"},
            "projected": {y: n for y, n in pop.items() if y > "2020"},
            "latest_census_year": "2020",
            "latest_census_value": pop.get("2020"),
            "source": "NYC DCP, Population by Borough 1950-2040 (decennial Census; "
                      "2030/2040 are DCP projections)",
        },
        "budget": {
            "fiscal_year": fy,
            "phase": "ADOPTED",
            "geography": "Staten Island (OMB 'Richmond')",
            "total_amount": sum(a["amount"] for a in agencies),
            "total_positions": sum(a["positions"] for a in agencies),
            "by_agency": agencies,
            "source": "NYC OMB, Expense Budget - Community Boards Geographic Report",
            "note": ("Covers only the agencies OMB reports geographically. It is not "
                     "the whole city budget, and not everything spent on Staten "
                     "Island."),
        },
        "counts": {
            "buildings": REPORT.get("buildings", {}).get("features"),
            "street_segments": REPORT.get("roads", {}).get("features"),
            "trees_rendered": REPORT.get("trees", {}).get("features"),
            "parks": REPORT.get("parks", {}).get("features"),
        },
    }
    REPORT["stats"] = write("stats.json", stats)


def step_manifest():
    """The 'data as of' footer's source of truth."""
    print("[manifest]")
    with open(os.path.join(RAW, "_manifest.json")) as fh:
        man = json.load(fh)
    out = {
        "generated_at": __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc).replace(microsecond=0).isoformat(),
        "sources": {
            k: {
                "title": v.get("title"),
                "agency": v.get("agency"),
                "publisher_updated_at": v.get("publisher_updated_at"),
                "fetched_at": v.get("fetched_at"),
                "rows": v.get("rows_downloaded"),
                "url": v.get("landing_page"),
                "license": v.get("license"),
            }
            for k, v in man.items()
        },
        "outputs": REPORT,
    }
    write("manifest.json", out)


STEPS = {
    "boundary": step_boundary,
    "parks": step_parks,
    "roads": step_roads,
    "buildings": step_buildings,
    "trees": "needs_si",
    "crime": step_crime,
    "sr311": step_311,
    "services": step_services,
    "stats": step_stats,
}


def main(which):
    order = which or list(STEPS) + ["manifest"]
    si = None
    for name in order:
        if name == "manifest":
            step_manifest()
            continue
        fn = STEPS[name]
        if fn == "needs_si":
            if si is None:
                si = si_polygon()
            step_trees(si[1])
        else:
            fn()
    if not which:
        total = sum(v["bytes"] for v in REPORT.values() if isinstance(v, dict) and "bytes" in v)
        print(f"\ntotal processed payload: {total/1e6:.2f} MB")


if __name__ == "__main__":
    main([a for a in sys.argv[1:]])
