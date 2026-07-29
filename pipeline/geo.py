"""Small geometry helpers shared by the processing steps.

Deliberately dependency-light: shapely for topology, pyproj for the one
projection we need. No GDAL, no tile toolchain (see PLAN.md rule 3 — plain
simplified GeoJSON first; escalate only if a performance gate actually fails).
"""

import math

from pyproj import Transformer
from shapely.geometry import mapping, shape

# Staten Island sits in NY State Plane Long Island (ft). We only need *a*
# metric-ish planar CRS for hex binning and distance thinning; 3857 is fine at
# this latitude once scaled, but 2263 is the city's own and avoids the
# Mercator stretch, so we use it and work in feet -> metres.
FT_PER_M = 3.280839895
_to_plane = Transformer.from_crs("EPSG:4326", "EPSG:2263", always_xy=True)
_to_wgs = Transformer.from_crs("EPSG:2263", "EPSG:4326", always_xy=True)


def to_plane(lon, lat):
    """lon/lat -> planar metres."""
    x, y = _to_plane.transform(lon, lat)
    return x / FT_PER_M, y / FT_PER_M


def to_wgs(x_m, y_m):
    """planar metres -> lon/lat."""
    return _to_wgs.transform(x_m * FT_PER_M, y_m * FT_PER_M)


def round_coords(obj, nd=6):
    """Round every coordinate in a GeoJSON geometry dict, in place-ish.

    6 decimal places is ~0.11 m at this latitude — well below anything the
    source data resolves — and cuts file size roughly in half versus the
    15-digit floats the API returns.
    """
    if isinstance(obj, (list, tuple)):
        if obj and isinstance(obj[0], (int, float)):
            return [round(float(c), nd) for c in obj]
        return [round_coords(o, nd) for o in obj]
    return obj


def clean_geom(geojson_geom, simplify_deg=None, nd=6):
    """Validate, optionally simplify, and round a GeoJSON geometry.

    Returns None if the geometry is missing or degenerate — a dropped
    degenerate polygon is honest; a repaired-into-existence one is not.
    """
    if not geojson_geom:
        return None
    try:
        g = shape(geojson_geom)
    except Exception:
        return None
    if g.is_empty:
        return None
    if not g.is_valid:
        g = g.buffer(0)
        if g.is_empty or not g.is_valid:
            return None
    if simplify_deg:
        g = g.simplify(simplify_deg, preserve_topology=True)
        if g.is_empty:
            return None
    out = mapping(g)
    return {"type": out["type"], "coordinates": round_coords(out["coordinates"], nd)}


def feature(geom, props):
    return {"type": "Feature", "geometry": geom, "properties": props}


def fc(features):
    return {"type": "FeatureCollection", "features": features}


# --------------------------------------------------------------------------
# Pointy-top hex binning, in planar metres.
# --------------------------------------------------------------------------

_SQRT3 = math.sqrt(3.0)


def hex_key(x, y, size):
    """Planar metres -> axial hex (q, r) at the given circumradius."""
    q = (_SQRT3 / 3.0 * x - y / 3.0) / size
    r = (2.0 / 3.0 * y) / size
    # cube round
    cx, cz = q, r
    cy = -cx - cz
    rx, ry, rz = round(cx), round(cy), round(cz)
    dx, dy, dz = abs(rx - cx), abs(ry - cy), abs(rz - cz)
    if dx > dy and dx > dz:
        rx = -ry - rz
    elif dy > dz:
        ry = -rx - rz
    else:
        rz = -rx - ry
    return int(rx), int(rz)


def hex_polygon(q, r, size, nd=6):
    """Axial hex -> a WGS84 GeoJSON Polygon ring."""
    cx = size * _SQRT3 * (q + r / 2.0)
    cy = size * 1.5 * r
    ring = []
    for i in range(6):
        a = math.radians(60 * i - 30)
        lon, lat = to_wgs(cx + size * math.cos(a), cy + size * math.sin(a))
        ring.append([round(lon, nd), round(lat, nd)])
    ring.append(ring[0])
    return {"type": "Polygon", "coordinates": [ring]}


def hex_center_lonlat(q, r, size, nd=6):
    cx = size * _SQRT3 * (q + r / 2.0)
    cy = size * 1.5 * r
    lon, lat = to_wgs(cx, cy)
    return [round(lon, nd), round(lat, nd)]
