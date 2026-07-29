/* Click-to-inspect.

   Every popup here answers "what is already true about this thing?" — nothing
   a popup does changes the city. Values are printed as they came out of the
   source: where a field is absent, the popup says so rather than filling it. */

const LANDUSE_LABELS = {
  res_low: "Residential — one & two family",
  res_multi: "Residential — multi-family",
  mixed: "Mixed residential & commercial",
  commercial: "Commercial & office",
  industrial: "Industrial & manufacturing",
  institutional: "Institutional, transport & utility",
  openspace: "Open space & recreation",
  vacant: "Parking or vacant",
  unknown: "No land-use record",
};

/* Layers that answer a click, most specific first. */
const TARGETS = [
  "firehouse-core", "firehouse-dot",
  "trees-core",
  "crime-hex",
  "sr311-hex",
  "precinct-fill",
  "fireco-fill",
  "buildings", "buildings-flat",
];

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const row = (k, v) =>
  `<div class="pr"><span class="pk">${esc(k)}</span><span class="pv">${esc(v)}</span></div>`;

const num = (n) => Number(n).toLocaleString();

/* Staten Island's precincts are the 120th, 121st, 122nd and 123rd — "122th"
   reads as a bug to anyone who lives there. */
function ordinal(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return String(n);
  const tens = v % 100;
  if (tens >= 11 && tens <= 13) return `${v}th`;
  return `${v}${{ 1: "st", 2: "nd", 3: "rd" }[v % 10] || "th"}`;
}

export function bindInspect(map, views) {
  /* closeOnClick would make every second click a no-op that only dismisses the
     last popup — infuriating when the whole point is to click around. The
     handler below closes it explicitly when a click lands on nothing. */
  const popup = new maplibregl.Popup({
    closeButton: true,
    closeOnClick: false,
    maxWidth: "290px",
    className: "sc-popup",
  });

  const hitTargets = () => TARGETS.filter((id) => {
    const l = map.getLayer(id);
    if (!l) return false;
    return map.getLayoutProperty(id, "visibility") !== "none";
  });

  map.on("click", (e) => {
    const layers = hitTargets();
    if (!layers.length) return;
    const hits = map.queryRenderedFeatures(e.point, { layers });
    if (!hits.length) {
      views.clearSelection();
      popup.remove();
      return;
    }
    const f = hits[0];
    /* A crime cell sits inside a precinct, and the precinct boundary is drawn
       in this view — so clicking a cell should also trace the precinct it
       belongs to, rather than leaving that boundary decorative. */
    const precinct =
      f.layer.id === "crime-hex"
        ? hits.find((h) => h.layer.id === "precinct-fill")
        : null;

    const html = render(f, views, precinct);
    if (!html) return;
    if (precinct) views.selectPrecinct(precinct.properties.precinct);
    popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
  });

  // Pointer feedback: the cursor is the only hint that a thing is clickable.
  map.on("mousemove", (e) => {
    const layers = hitTargets();
    const hit = layers.length && map.queryRenderedFeatures(e.point, { layers }).length;
    map.getCanvas().style.cursor = hit ? "pointer" : "";
  });
}

function render(f, views, precinct) {
  const p = f.properties || {};
  switch (f.layer.id) {
    case "buildings":
    case "buildings-flat":
      return building(p);
    case "trees-core":
      return card("Street tree", [
        row("Species", p.sp || "not recorded"),
        row("Trunk diameter", p.d ? `${p.d} in` : "not recorded"),
      ], "Forestry Tree Points (DPR). The tree layer is thinned for density — " +
         "this dot stands for a real record, but not every tree is drawn.");
    case "crime-hex":
      return card("Crime — 300 m cell", [
        row("Complaints", num(p.n)),
        row("Felony", num(p.fel)),
        row("Misdemeanour", num(p.mis)),
        row("Violation", num(p.vio)),
        ...(precinct ? [row("Precinct", ordinal(precinct.properties.precinct))] : []),
      ], "NYPD complaints reported year to date, counted into this cell. " +
         "Individual complaint locations are not plotted.");
    case "sr311-hex":
      return card("311 — 300 m cell", [
        row("Type", p.t),
        row("Requests", num(p.n)),
      ], "Trailing twelve months of 311 service requests in this cell.");
    case "precinct-fill": {
      views.selectPrecinct(p.precinct);
      return card(`${ordinal(p.precinct)} Precinct`, [
        row("Complaints YTD", num(p.n)),
        row("Felony", num(p.fel)),
        row("Misdemeanour", num(p.mis)),
        row("Violation", num(p.vio)),
      ], "Boundary from DCP Police Precincts; counts from NYPD complaint data " +
         "for this precinct.");
    }
    case "fireco-fill": {
      views.selectFireCompany(p.co);
      return card(`Fire company ${p.co}`, [
        row("Battalion", p.bn || "—"),
        row("Division", p.div || "—"),
      ], "Response area from DCP Fire Companies. Division 8 is Staten Island.");
    }
    case "firehouse-core":
    case "firehouse-dot":
      return card(p.name || "Firehouse", [
        row("Address", p.addr || "not recorded"),
      ], "FDNY Firehouse Listing.");
    default:
      return null;
  }
}

function building(p) {
  const rows = [
    row("Land use", LANDUSE_LABELS[p.lu] || LANDUSE_LABELS.unknown),
    row("Roof height", p.h ? `${p.h} m` : "not recorded"),
    row("Built", p.yr || "not recorded"),
  ];
  if (p.fl) rows.push(row("Floors", p.fl));
  if (p.ur) rows.push(row("Residential units", num(p.ur)));

  const note = p.lu === "unknown"
    ? "This footprint has no matching PLUTO tax-lot record, so its land use is " +
      "genuinely unknown — it is not being guessed at."
    : "Footprint and height from the city building inventory; land use, floors " +
      "and units from PLUTO, joined on BBL.";

  return card(p.ad || "Building", rows, note);
}

function card(title, rows, note) {
  return `
    <div class="pc">
      <div class="pt">${esc(title)}</div>
      ${rows.join("")}
      ${note ? `<div class="pn">${esc(note)}</div>` : ""}
    </div>`;
}
