/* Data views — the "viewer" half of the project.

   A view is a named set of layers plus a legend. Switching views changes what
   is *shown*, never what exists: no view writes anything, and re-loading the
   page in any view gives every visitor the same city.

   Each view's data is fetched the first time it is opened, so opening the app
   costs the base map plus buildings and nothing else. */

import { LANDUSE_COLORS } from "./config.js";
import { loadFile } from "./data.js";

/* Sequential ramps. Five steps each — enough to read a pattern, few enough to
   stay legible in a legend the size of a postage stamp. */
const RAMP_HEAT = ["#f4e08a", "#f4bd5c", "#ec8f43", "#dc5c3c", "#b5303a"];
const RAMP_CIVIC = ["#bfe3c8", "#84cfae", "#4fb3a1", "#2f8b93", "#1f5f7e"];

const CRIME_BREAKS = [5, 15, 40, 90]; // complaints per 300 m hex

export const VIEWS = {
  city: {
    label: "City",
    hint: "Land use",
    blurb:
      "Every building in the borough, extruded to its real roof height and " +
      "coloured by the land use recorded for its tax lot.",
  },
  crime: {
    label: "Crime",
    hint: "NYPD complaints",
    blurb:
      "NYPD complaint records year to date, counted into 300 m cells and into " +
      "precincts. Individual complaint locations are deliberately not plotted.",
  },
  sr311: {
    label: "311",
    hint: "Service requests",
    blurb:
      "311 service requests over the trailing twelve months, counted into " +
      "300 m cells. Shading is per-type quintiles, so quiet types stay readable.",
  },
  trees: {
    label: "Trees",
    hint: "Street trees",
    blurb:
      "Standing living street trees from the Forestry inventory, thinned for " +
      "render density. One dot is not one tree — see the note below.",
  },
  services: {
    label: "Services",
    hint: "Police & fire",
    blurb:
      "Police precinct and fire company response areas, and firehouse " +
      "locations. Click any of them to trace its boundary.",
  },
};

/* Which layers belong to which view. `city` owns the buildings, which stay
   visible (dimmed) under the overlay views so the city never disappears. */
const VIEW_LAYERS = {
  city: [],
  crime: ["crime-hex", "crime-hex-line", "precinct-outline", "precinct-fill"],
  sr311: ["sr311-hex", "sr311-hex-line"],
  trees: ["trees-dot", "trees-core"],
  services: [
    "fireco-fill", "fireco-line", "precinct-outline", "precinct-fill",
    "firehouse-dot", "firehouse-core",
  ],
};

const ALL_OVERLAY_LAYERS = [...new Set(Object.values(VIEW_LAYERS).flat())];

export class ViewManager {
  constructor(map, { onLegend } = {}) {
    this.map = map;
    this.onLegend = onLegend || (() => {});
    this.current = "city";
    /* name -> in-flight or settled load promise. Storing the *promise* rather
       than a "loaded" flag matters: two quick view switches would otherwise
       have the second one see the first's flag, skip the load, and show an
       empty view. */
    this.loads = new Map();
    this.sr311Type = "Illegal Parking";
    this.selected = null; // highlighted district, if any
  }

  async show(name) {
    if (!VIEWS[name]) return;
    this.current = name;
    await this.ensure(name);
    // A slower earlier switch must not repaint over a faster later one.
    if (this.current !== name) return;

    for (const id of ALL_OVERLAY_LAYERS) {
      if (!this.map.getLayer(id)) continue;
      const on = (VIEW_LAYERS[name] || []).includes(id);
      this.map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    }

    // Buildings dim under an overlay so the overlay reads on top of them.
    if (this.map.getLayer("buildings")) {
      this.map.setPaintProperty(
        "buildings", "fill-extrusion-opacity", name === "city" ? 0.96 : 0.35
      );
    }
    this.clearSelection();
    this.onLegend(this.legend());
  }

  /* ------------------------------------------------------------- loading */

  ensure(name) {
    if (this.loads.has(name)) return this.loads.get(name);
    const builders = {
      crime: () => this.addCrime(),
      sr311: () => this.addSr311(),
      trees: () => this.addTrees(),
      services: () => this.addServices(),
    };
    const build = builders[name];
    const p = build ? build() : Promise.resolve();
    // A failed load must not be cached, or the view can never recover.
    const tracked = p.catch((err) => {
      this.loads.delete(name);
      throw err;
    });
    this.loads.set(name, tracked);
    return tracked;
  }

  /* Precincts are shared by the crime and services views. Memoised so two
     concurrent view loads can't both try to add the same source. */
  ensurePrecincts() {
    if (!this._precincts) {
      this._precincts = loadFile("precincts.geojson").then((data) => {
        const map = this.map;
        if (map.getSource("precincts")) return;
        map.addSource("precincts", { type: "geojson", data });
        map.addLayer({
          id: "precinct-fill", type: "fill", source: "precincts",
          layout: { visibility: "none" },
          paint: { "fill-color": "#4fd0e0", "fill-opacity": 0 },
        });
        map.addLayer({
          id: "precinct-outline", type: "line", source: "precincts",
          layout: { visibility: "none" },
          paint: {
            "line-color": "#eef4fb", "line-width": 2.4,
            "line-opacity": 0.85, "line-dasharray": [4, 3],
          },
        });
      });
    }
    return this._precincts;
  }

  async addCrime() {
    const [hex, meta] = await Promise.all([
      loadFile("crime_hex.geojson"),
      loadFile("crime_meta.json"),
      this.ensurePrecincts(),
    ]);
    this.crimeMeta = meta;
    const map = this.map;
    map.addSource("crime-hex", { type: "geojson", data: hex });

    map.addLayer({
      id: "crime-hex",
      type: "fill",
      source: "crime-hex",
      layout: { visibility: "none" },
      paint: {
        "fill-color": step("n", CRIME_BREAKS, RAMP_HEAT),
        "fill-opacity": 0.62,
      },
    });
    map.addLayer({
      id: "crime-hex-line",
      type: "line",
      source: "crime-hex",
      layout: { visibility: "none" },
      paint: { "line-color": "#00000055", "line-width": 0.5 },
    });
  }

  async addSr311() {
    const [hex, meta] = await Promise.all([
      loadFile("sr311_hex.geojson"),
      loadFile("sr311_meta.json"),
    ]);
    this.sr311Meta = meta;
    const map = this.map;
    map.addSource("sr311-hex", { type: "geojson", data: hex });
    map.addLayer({
      id: "sr311-hex",
      type: "fill",
      source: "sr311-hex",
      layout: { visibility: "none" },
      filter: ["==", ["get", "t"], this.sr311Type],
      paint: {
        /* `q` is the per-type quintile bucket (0-4) computed in the pipeline.
           Indexing a literal array with `at` doesn't type-check as colours in
           MapLibre, so this is a plain step. */
        "fill-color": step("q", [1, 2, 3, 4], RAMP_CIVIC),
        "fill-opacity": 0.66,
      },
    });
    map.addLayer({
      id: "sr311-hex-line",
      type: "line",
      source: "sr311-hex",
      layout: { visibility: "none" },
      filter: ["==", ["get", "t"], this.sr311Type],
      paint: { "line-color": "#00000055", "line-width": 0.5 },
    });
  }

  setSr311Type(type) {
    this.sr311Type = type;
    for (const id of ["sr311-hex", "sr311-hex-line"]) {
      if (this.map.getLayer(id)) {
        this.map.setFilter(id, ["==", ["get", "t"], type]);
      }
    }
    this.onLegend(this.legend());
  }

  async addTrees() {
    const [trees, meta] = await Promise.all([
      loadFile("trees.geojson"),
      loadFile("trees_meta.json"),
    ]);
    this.treeMeta = meta;
    const map = this.map;
    map.addSource("trees", { type: "geojson", data: trees });
    // Two circles: a dark halo and a bright core. Chunky outline, again.
    map.addLayer({
      id: "trees-dot",
      type: "circle",
      source: "trees",
      layout: { visibility: "none" },
      paint: {
        "circle-color": "#1f3517",
        "circle-radius": radiusByDbh(1.0),
        "circle-opacity": 0.85,
      },
    });
    map.addLayer({
      id: "trees-core",
      type: "circle",
      source: "trees",
      layout: { visibility: "none" },
      paint: {
        "circle-color": ["interpolate", ["linear"], ["get", "d"],
          0, "#8fd06a", 12, "#5da844", 30, "#2f7a33"],
        "circle-radius": radiusByDbh(0.6),
      },
    });
  }

  async addServices() {
    const [fireco, houses] = await Promise.all([
      loadFile("fire_companies.geojson"),
      loadFile("firehouses.geojson"),
      this.ensurePrecincts(),
    ]);
    const map = this.map;
    map.addSource("fireco", { type: "geojson", data: fireco });
    map.addSource("firehouses", { type: "geojson", data: houses });

    map.addLayer({
      id: "fireco-fill", type: "fill", source: "fireco",
      layout: { visibility: "none" },
      paint: { "fill-color": "#e2564a", "fill-opacity": 0.07 },
    });
    map.addLayer({
      id: "fireco-line", type: "line", source: "fireco",
      layout: { visibility: "none" },
      paint: { "line-color": "#f0a830", "line-width": 1.8, "line-opacity": 0.75 },
    });
    /* Firehouse badges: a dark outline disc under a red core — the chunky
       outline again, and big enough to survive being drawn among extrusions. */
    map.addLayer({
      id: "firehouse-dot", type: "circle", source: "firehouses",
      layout: { visibility: "none" },
      paint: {
        "circle-color": "#0d1520",
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 7, 16, 15],
        "circle-stroke-color": "#ffd177",
        "circle-stroke-width": 1.2,
      },
    });
    map.addLayer({
      id: "firehouse-core", type: "circle", source: "firehouses",
      layout: { visibility: "none" },
      paint: {
        "circle-color": "#e2564a",
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 4, 16, 10],
      },
    });
  }

  /* ----------------------------------------------------------- selection */

  /* Highlight one district's boundary. This is a *view* state — it reveals a
     boundary that already exists and is gone on reload. */
  selectPrecinct(precinct) {
    this.selected = { kind: "precinct", id: precinct };
    if (this.map.getLayer("precinct-fill")) {
      this.map.setPaintProperty("precinct-fill", "fill-opacity",
        ["case", ["==", ["get", "precinct"], precinct], 0.16, 0]);
      this.map.setPaintProperty("precinct-outline", "line-width",
        ["case", ["==", ["get", "precinct"], precinct], 3.2, 1.6]);
      this.map.setPaintProperty("precinct-outline", "line-opacity",
        ["case", ["==", ["get", "precinct"], precinct], 1, 0.35]);
    }
  }

  selectFireCompany(co) {
    this.selected = { kind: "fireco", id: co };
    if (this.map.getLayer("fireco-fill")) {
      this.map.setPaintProperty("fireco-fill", "fill-opacity",
        ["case", ["==", ["get", "co"], co], 0.22, 0.05]);
      this.map.setPaintProperty("fireco-line", "line-width",
        ["case", ["==", ["get", "co"], co], 2.6, 1.1]);
    }
  }

  clearSelection() {
    this.selected = null;
    if (this.map.getLayer("precinct-fill")) {
      this.map.setPaintProperty("precinct-fill", "fill-opacity", 0);
      this.map.setPaintProperty("precinct-outline", "line-width", 1.6);
      this.map.setPaintProperty("precinct-outline", "line-opacity", 0.55);
    }
    if (this.map.getLayer("fireco-fill")) {
      this.map.setPaintProperty("fireco-fill", "fill-opacity", 0.07);
      this.map.setPaintProperty("fireco-line", "line-width", 1.1);
    }
  }

  /* -------------------------------------------------------------- legend */

  legend() {
    const v = VIEWS[this.current];
    switch (this.current) {
      case "city":
        return {
          title: v.label, hint: v.hint, blurb: v.blurb,
          swatches: Object.entries(LANDUSE_COLORS).map(([k, c]) => ({
            color: c, label: LANDUSE_LABELS[k],
          })),
        };
      case "crime": {
        const m = this.crimeMeta || {};
        return {
          title: v.label, hint: v.hint, blurb: v.blurb,
          swatches: rampSwatches(RAMP_HEAT, CRIME_BREAKS, "per 300 m cell"),
          /* Report date and incident date are different things and the gap
             between them is large, so both are stated rather than blurred. */
          note: m.reported_max
            ? `${(m.total || 0).toLocaleString()} complaints reported ` +
              `${m.reported_min} to ${m.reported_max}. ` +
              `${(m.reported_before_window || 0).toLocaleString()} of them concern ` +
              `incidents from before that window — earliest ${m.occurred_min}.`
            : null,
        };
      }
      case "sr311": {
        const m = this.sr311Meta || {};
        const breaks = (m.quintile_breaks || {})[this.sr311Type] || [];
        const total = (m.type_totals || {})[this.sr311Type];
        return {
          title: v.label, hint: this.sr311Type, blurb: v.blurb,
          swatches: rampSwatches(RAMP_CIVIC, breaks, "per 300 m cell"),
          types: [...(m.rendered_types || []), "All other types"],
          activeType: this.sr311Type,
          note: total
            ? `${total.toLocaleString()} requests of this type, ` +
              `${m.window_start} to ${m.window_end}.`
            : null,
        };
      }
      case "trees": {
        const m = this.treeMeta || {};
        return {
          title: v.label, hint: v.hint, blurb: v.blurb,
          swatches: [
            { color: "#8fd06a", label: "Small trunk" },
            { color: "#5da844", label: "Medium" },
            { color: "#2f7a33", label: "Large trunk" },
          ],
          note: m.rendered
            ? `${m.rendered.toLocaleString()} dots shown for ` +
              `${m.in_borough_standing.toLocaleString()} standing living trees ` +
              `— thinned to one per 40 m.`
            : null,
        };
      }
      case "services":
        return {
          title: v.label, hint: v.hint, blurb: v.blurb,
          swatches: [
            { color: "#eef4fb", label: "Police precinct boundary" },
            { color: "#f0a830", label: "Fire company area" },
            { color: "#e2564a", label: "Firehouse" },
          ],
        };
      default:
        return null;
    }
  }
}

const LANDUSE_LABELS = {
  res_low: "Residential — low",
  res_multi: "Residential — multi",
  mixed: "Mixed use",
  commercial: "Commercial & office",
  industrial: "Industrial",
  institutional: "Institutional & utility",
  openspace: "Open space & recreation",
  vacant: "Parking & vacant",
  unknown: "No land-use record",
};

/* ---------------------------------------------------------------- helpers */

function step(prop, breaks, colors) {
  const expr = ["step", ["get", prop], colors[0]];
  breaks.forEach((b, i) => expr.push(b, colors[i + 1]));
  return expr;
}

function rampSwatches(colors, breaks, unit) {
  return colors.map((c, i) => {
    let label;
    if (!breaks.length) label = "—";
    else if (i === 0) label = `< ${breaks[0]}`;
    else if (i === colors.length - 1) label = `${breaks[breaks.length - 1]}+`;
    else label = `${breaks[i - 1]}–${breaks[i]}`;
    return { color: c, label: i === colors.length - 1 ? `${label} ${unit}` : label };
  });
}

function radiusByDbh(scale) {
  return ["interpolate", ["linear"], ["zoom"],
    11, ["*", scale, 1.1],
    13, ["*", scale, ["+", 1.4, ["*", 0.03, ["get", "d"]]]],
    16, ["*", scale, ["+", 3.0, ["*", 0.12, ["get", "d"]]]],
    18, ["*", scale, ["+", 6.0, ["*", 0.3, ["get", "d"]]]],
  ];
}
