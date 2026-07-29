/* Camera, bounds and palette constants.
   The palette here must match docs/VISUAL_IDENTITY.md and css/app.css. */

/* Absolute URL, resolved from this module's own location. MapLibre hands
   GeoJSON source URLs to a web worker, and a relative path resolved against a
   blob: worker origin silently never loads — so resolve it here, once. */
export const DATA = new URL("../../data/processed/", import.meta.url).href;

export const PALETTE = {
  water: "#1c4f6e",
  waterShallow: "#2f7898",
  /* Land is the backdrop for everything else, so it stays muted — but the
     first pass was so dark the borough read as a silhouette. This is a warm
     olive with enough value to sit *under* buildings and roads, not compete. */
  land: "#57603f",
  park: "#5f8442",
  parkEdge: "#78a052",
  roadMajor: "#f0e2ba",
  roadMinor: "#c9bb99",
  roadCasing: "#26261f",
  boundary: "#f0e6c8",
  ferry: "#7fb3c4",
  skyDay: "#8fc4e8",
  hazeDay: "#cfd9c8",
};

/* Staten Island, with a margin of harbour on every side so the borough never
   sits flush against the viewport edge. */
export const MAX_BOUNDS = [
  [-74.36, 40.44],
  [-73.95, 40.72],
];

export const CAMERA = {
  center: [-74.145, 40.578],
  zoom: 11.6,
  pitch: 55,
  bearing: -22,
  minZoom: 10.6,
  maxZoom: 18.5,
  /* Locked oblique band: never straight down (that's a GIS map), never so low
     the borough turns into a sliver. */
  minPitch: 30,
  maxPitch: 68,
};

/* Camera presets on the compass/HUD. Pure camera moves — they reveal, they
   never change anything. */
export const VIEWPOINTS = [
  { key: "borough", label: "Whole borough", center: [-74.145, 40.578], zoom: 11.6, pitch: 55, bearing: -22 },
  { key: "stgeorge", label: "St. George", center: [-74.0755, 40.6425], zoom: 14.4, pitch: 62, bearing: -35 },
  { key: "narrows", label: "The Narrows", center: [-74.0625, 40.6065], zoom: 13.2, pitch: 64, bearing: 35 },
  { key: "northshore", label: "North Shore", center: [-74.135, 40.632], zoom: 13.0, pitch: 60, bearing: -15 },
  { key: "southshore", label: "South Shore", center: [-74.185, 40.525], zoom: 13.0, pitch: 58, bearing: -30 },
  { key: "greenbelt", label: "The Greenbelt", center: [-74.135, 40.585], zoom: 13.4, pitch: 60, bearing: 10 },
];
