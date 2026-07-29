#!/usr/bin/env python3
"""Regenerate DATA_SOURCES.md from data/raw/_manifest.json.

Vintages are never typed by hand — they come from whatever the publisher's API
reported at fetch time. Run after `download.py`.

    python pipeline/make_data_sources.py
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sources import PENDING_USER_DECISION, SOURCES  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "data", "raw", "_manifest.json")
OUT = os.path.join(ROOT, "DATA_SOURCES.md")

HEADER = """# Data sources

Every number, polygon and point in this viewer traces back to a row in one of
the datasets below. Nothing is invented, simulated, or filled in. Presentation
is stylised (colour ramps, exaggerated marker sizes, a game-like camera); the
underlying values are not.

This file is **generated** by `pipeline/make_data_sources.py` from
`data/raw/_manifest.json`, which is itself written by `pipeline/download.py`.
Do not edit it by hand — re-run the pipeline instead.

All NYC datasets below are published on NYC Open Data under the
[NYC Open Data Terms of Use](https://www.nyc.gov/html/data/terms.html), which
permit reuse with attribution. Attribution appears in the app footer.

"""


def fmt(n):
    return f"{n:,}" if isinstance(n, int) else "—"


def main():
    if not os.path.exists(MANIFEST):
        sys.exit("no manifest yet — run `python pipeline/download.py --check` first")
    with open(MANIFEST) as fh:
        man = json.load(fh)

    lines = [HEADER, "## Datasets in use\n"]
    lines.append(
        "| Key | Dataset | Publisher | Publisher last updated | Staten Island filter | Rows |"
    )
    lines.append("|---|---|---|---|---|---|")
    for key in SOURCES:
        m = man.get(key)
        if not m:
            lines.append(f"| `{key}` | _not yet fetched_ | | | | |")
            continue
        rows = m.get("rows_downloaded") or m.get("rows_matching_filter")
        filt = f"`{m['filter']}`" if m.get("filter") else "_(whole dataset — 6 rows)_"
        lines.append(
            f"| `{key}` | [{m['title']}]({m['landing_page']}) | {m['agency']} | "
            f"{(m.get('publisher_updated_at') or '—')[:10]} | {filt} | {fmt(rows)} |"
        )

    lines.append("\n## Per-dataset detail\n")
    for key in SOURCES:
        m = man.get(key)
        if not m:
            continue
        lines.append(f"### `{key}` — {m['title']}")
        lines.append("")
        lines.append(f"- **Role in this project:** {m.get('role')}")
        lines.append(f"- **Socrata asset:** [`{m['socrata_id']}`]({m['landing_page']})")
        lines.append(f"- **Publisher:** {m['agency']}" + (f" ({m['attribution']})" if m.get("attribution") else ""))
        lines.append(f"- **Publisher last updated:** {m.get('publisher_updated_at') or '—'}")
        lines.append(f"- **Licence:** {m.get('license')}")
        lines.append(f"- **Access method:** SODA v2 REST, paged; `pipeline/download.py`")
        lines.append(f"- **Staten Island filter:** `{m.get('filter')}`")
        lines.append(f"- **Fields pulled:** `{m.get('select')}`")
        if m.get("fetched_at"):
            lines.append(
                f"- **Fetched:** {m['fetched_at']} — {fmt(m.get('rows_downloaded'))} rows, "
                f"{(m.get('bytes_raw') or 0)/1e6:.1f} MB raw"
            )
        else:
            lines.append(
                f"- **Verified reachable:** {m.get('checked_at')} — "
                f"{fmt(m.get('rows_matching_filter'))} rows match the filter (not yet downloaded)"
            )
        if m.get("note"):
            lines.append(f"- **Note:** {m['note']}")
        lines.append("")

    lines.append("## Open items (need a user decision or a user-owned account)\n")
    for key, text in PENDING_USER_DECISION.items():
        lines.append(f"- **`{key}`** — {text}")
    lines.append("")

    with open(OUT, "w") as fh:
        fh.write("\n".join(lines))
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
