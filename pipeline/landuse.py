"""The land-use collapse: PLUTO's 11 `landuse` codes -> 8 render categories.

Single source of truth, shared by the pipeline and (via the JSON it emits) by
the frontend legend, so the map and the legend cannot drift apart.

PLUTO `landuse` code meanings are DCP's, verbatim from the PLUTO data
dictionary — we group them, we do not reinterpret them.
"""

# code -> (category key, DCP's own label for the code)
PLUTO_LANDUSE = {
    "01": ("res_low", "One & Two Family Buildings"),
    "02": ("res_multi", "Multi-Family Walk-Up Buildings"),
    "03": ("res_multi", "Multi-Family Elevator Buildings"),
    "04": ("mixed", "Mixed Residential & Commercial Buildings"),
    "05": ("commercial", "Commercial & Office Buildings"),
    "06": ("industrial", "Industrial & Manufacturing"),
    "07": ("institutional", "Transportation & Utility"),
    "08": ("institutional", "Public Facilities & Institutions"),
    "09": ("openspace", "Open Space & Outdoor Recreation"),
    "10": ("vacant", "Parking Facilities"),
    "11": ("vacant", "Vacant Land"),
}

# Ordered for the legend. Colours mirror docs/VISUAL_IDENTITY.md §2.3.
CATEGORIES = [
    ("res_low", "Residential — low", "#7fbf5a"),
    ("res_multi", "Residential — multi", "#3f9142"),
    ("mixed", "Mixed use", "#4bb6a4"),
    ("commercial", "Commercial & office", "#3d85c8"),
    ("industrial", "Industrial", "#e0b544"),
    ("institutional", "Institutional & utility", "#9b6fc4"),
    ("openspace", "Open space & recreation", "#5f8f4e"),
    ("vacant", "Parking & vacant", "#9c9481"),
    ("unknown", "No land-use record", "#6b7280"),
]


def category(landuse_code):
    """Return the render category for a PLUTO landuse code.

    Anything missing or unrecognised becomes 'unknown' and stays visible as
    'unknown' — an unjoined building is a data fact, not a gap to fill in.
    """
    if not landuse_code:
        return "unknown"
    return PLUTO_LANDUSE.get(str(landuse_code).strip().zfill(2), ("unknown", ""))[0]


def legend():
    return [{"key": k, "label": lbl, "color": c} for k, lbl, c in CATEGORIES]
