/* The MapLibre style, written from scratch.

   No basemap tiles, no external tile server, no sourced art. The whole world is
   four local GeoJSON files: water is the background, land is the borough
   polygon drawn on top of it, then parks, then roads.

   Roads carry a dark casing under a light fill — the chunky-outline trick that
   does most of the work of making a map read as a game board rather than a GIS
   layer. */

import { LANDUSE_COLORS, PALETTE as P } from "./config.js";

/* Sources carry already-parsed GeoJSON, not URLs.

   MapLibre will happily take a URL and fetch it inside its web worker, but in
   some embedded/sandboxed browser contexts that worker fetch fails silently —
   no error event, no request, the source simply never loads. Fetching on the
   main thread and handing over the parsed object is bulletproof, and it also
   gives us a real progress bar during boot, which a 42 MB building file
   genuinely needs. */
const src = (data) => ({ type: "geojson", data });

const MAJOR = ["highway", "bridge", "tunnel", "ramp"];
const MINOR_SERVICE = ["service", "path", "ferry"];

/* Pick a value by road class. */
const byClass = (street, major, service) => [
  "match", ["get", "cls"],
  MAJOR, major,
  MINOR_SERVICE, service,
  street,
];

/* Road widths: one zoom interpolation whose stops are per-class matches.
   (MapLibre allows only one zoom-based interpolate per expression, so the
   match has to live *inside* the interpolate, not wrap it.) */
const ZOOM_STOPS = [
  [11, 0.35],
  [13, 0.9],
  [15, 2.4],
  [18, 9],
];

const roadWidth = (street, major, service) => {
  const expr = ["interpolate", ["exponential", 1.6], ["zoom"]];
  for (const [z, k] of ZOOM_STOPS) {
    expr.push(z, byClass(street * k, major * k, service * k));
  }
  return expr;
};

export function buildStyle(data) {
  return {
    version: 8,
    name: "Staten Island — city builder",
    /* No `glyphs` key at all: every label in this project is DOM chrome, not a
       map label, so there is no glyph server to point at and the site stays
       fully self-contained. */
    sources: {
      boundary: src(data.boundary),
      parks: src(data.parks),
      roads: src(data.roads),
    },
    layers: [
      /* --- water ------------------------------------------------------- */
      {
        id: "water",
        type: "background",
        paint: { "background-color": P.water },
      },
      /* A lighter band just off the shoreline, drawn by blurring the land
         polygon outward. Cheap depth cue, no extra data. */
      {
        id: "shore-glow",
        type: "line",
        source: "boundary",
        paint: {
          "line-color": P.waterShallow,
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 10, 14, 34, 18, 90],
          "line-blur": ["interpolate", ["linear"], ["zoom"], 10, 8, 14, 26, 18, 70],
          "line-opacity": 0.85,
        },
      },

      /* --- land -------------------------------------------------------- */
      {
        id: "land",
        type: "fill",
        source: "boundary",
        paint: { "fill-color": P.land },
      },
      {
        id: "land-edge",
        type: "line",
        source: "boundary",
        paint: {
          "line-color": P.boundary,
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.8, 14, 1.6, 18, 2.4],
          "line-opacity": 0.5,
        },
      },

      /* --- parks ------------------------------------------------------- */
      {
        id: "parks",
        type: "fill",
        source: "parks",
        paint: { "fill-color": P.park, "fill-opacity": 0.95 },
      },
      {
        id: "parks-edge",
        type: "line",
        source: "parks",
        paint: {
          "line-color": P.parkEdge,
          "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.4, 15, 1.4],
          "line-opacity": 0.7,
        },
      },

      /* --- roads: casing under fill ------------------------------------ */
      {
        id: "roads-casing",
        type: "line",
        source: "roads",
        filter: ["!=", ["get", "cls"], "ferry"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": P.roadCasing,
          "line-width": roadWidth(2.4, 4.0, 1.6),
          "line-opacity": 0.8,
        },
      },
      {
        id: "roads-fill",
        type: "line",
        source: "roads",
        filter: ["!=", ["get", "cls"], "ferry"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": byClass(P.roadMinor, P.roadMajor, P.roadMinor),
          "line-width": roadWidth(1.3, 2.6, 0.8),
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 10.5, 0.75, 13, 0.95, 16, 1],
        },
      },
      /* Ferry routes are in the centerline file too, and they run out across
         open water to Manhattan. Drawn as a faint dashed wake so they read as
         a route rather than a road you could drive on. */
      {
        id: "roads-ferry",
        type: "line",
        source: "roads",
        filter: ["==", ["get", "cls"], "ferry"],
        layout: { "line-cap": "butt" },
        paint: {
          "line-color": P.ferry,
          "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.8, 15, 2],
          "line-opacity": 0.35,
          "line-dasharray": [3, 3],
        },
      },
    ],
  };
}

/* The city itself, added after the base map is already on screen.

   142,455 extruded footprints are ~85% of the payload and most of the tiling
   cost, so the base map goes up first and stays interactive while this loads
   in behind it. Layers are inserted *below* the ferry line so the ferry wake
   still reads on top of the waterfront. */
export function addBuildingLayers(map, buildings) {
  map.addSource("buildings", { type: "geojson", data: buildings });

  const before = map.getLayer("roads-ferry") ? "roads-ferry" : undefined;

  /* Colour is the land-use category from the PLUTO join; height is the real
     roof height in metres. Neither is invented: a building with no PLUTO match
     carries `unknown` and gets the grey that has its own legend entry. */
  map.addLayer({
    id: "buildings",
    type: "fill-extrusion",
    source: "buildings",
    filter: ["has", "h"],
    paint: {
      "fill-extrusion-color": [
        "match", ["get", "lu"],
        ...Object.entries(LANDUSE_COLORS).flatMap(([k, v]) => [k, v]),
        LANDUSE_COLORS.unknown,
      ],
      "fill-extrusion-height": ["get", "h"],
      "fill-extrusion-base": 0,
      /* Darkens each wall towards its base — the cheapest single thing that
         makes extrusions read as buildings rather than coloured boxes. */
      "fill-extrusion-vertical-gradient": true,
      "fill-extrusion-opacity": 0.96,
    },
  }, before);

  /* The 92 buildings with no recorded roof height. Drawn flat, so they are
     visibly present and visibly *not* a guess. */
  map.addLayer({
    id: "buildings-flat",
    type: "fill",
    source: "buildings",
    filter: ["!", ["has", "h"]],
    paint: { "fill-color": LANDUSE_COLORS.unknown, "fill-opacity": 0.7 },
  }, before);
}

/* Sun and haze. Kept out of the style object because support varies by
   MapLibre version — call these after `load` and let them no-op if the running
   version doesn't have them, rather than failing the whole style. */
export function applyAtmosphere(map, { sunAzimuth = 215, sunAltitude = 42 } = {}) {
  try {
    map.setLight({
      anchor: "map",
      position: [1.4, sunAzimuth, 90 - sunAltitude],
      color: "#fff3e0",
      intensity: 0.32,
    });
  } catch (e) {
    console.warn("light unsupported:", e.message);
  }
  try {
    if (typeof map.setSky === "function") {
      map.setSky({
        "sky-color": P.skyDay,
        "horizon-color": P.hazeDay,
        "fog-color": P.hazeDay,
        "fog-ground-blend": 0.55,
        "horizon-fog-blend": 0.7,
        "sky-horizon-blend": 0.85,
        "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 10, 0.7, 14, 0.25, 17, 0],
      });
    }
  } catch (e) {
    console.warn("sky unsupported:", e.message);
  }
}
