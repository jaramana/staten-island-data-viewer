/* Staten Island Data Viewer — app shell.

   Everything here reveals; nothing here changes the city. Camera moves,
   layer toggles and popups only. There is no editable state, by design.
*/

import { CAMERA, MAX_BOUNDS, VIEWPOINTS } from "./config.js";
import { loadAll, loadFile } from "./data.js";
import { bindInspect } from "./inspect.js";
import { addBuildingLayers, applyAtmosphere, buildStyle } from "./style.js";
import { ViewManager, VIEWS } from "./views.js";

const $ = (sel) => document.querySelector(sel);

/* ---------------------------------------------------------------- dev aid */

/* Opt-in via ?pump=1, for headless verification only.
 *
 * A hidden or backgrounded tab is never given requestAnimationFrame, and
 * MapLibre schedules *everything* through it — applying the style, loading
 * tiles, rendering. Without rAF the map silently never finishes loading, which
 * looks exactly like broken data. Calling `map.redraw()` on a timer doesn't
 * help, because the work is queued in rAF callbacks that never run.
 *
 * So: give the page a real rAF, backed by a MessageChannel round-trip (not
 * clamped to 1 Hz the way setTimeout is in a hidden tab). This is self-limiting
 * rather than a busy loop — MapLibre stops requesting frames once it's idle. */
if (new URLSearchParams(location.search).has("pump")) {
  const queue = [];
  const ch = new MessageChannel();
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    const due = queue.splice(0, queue.length);
    const t = performance.now();
    for (const cb of due) {
      try { cb(t); } catch (e) { console.error(e); }
    }
  };
  ch.port1.onmessage = flush;

  let id = 0;
  const pending = new Map();
  window.requestAnimationFrame = (cb) => {
    const handle = ++id;
    pending.set(handle, cb);
    queue.push((t) => { if (pending.delete(handle)) cb(t); });
    if (!scheduled) {
      scheduled = true;
      ch.port2.postMessage(0);
    }
    return handle;
  };
  window.cancelAnimationFrame = (handle) => pending.delete(handle);
}

/* ---------------------------------------------------------------- boot bar */

const boot = {
  el: $("#boot"),
  bar: $("#boot .bar span"),
  step: $("#boot .step"),
  set(pct, text) {
    if (this.bar) this.bar.style.width = pct + "%";
    if (text && this.step) this.step.textContent = text;
  },
  done() {
    this.set(100, "ready");
    setTimeout(() => this.el && this.el.classList.add("done"), 220);
  },
};

/* ------------------------------------------------------------------- map */

boot.set(4, "fetching borough");

/* [file, progress weight]. The base map is small and goes up first; the city
   itself (~85% of the payload) streams in afterwards, over a map that is
   already on screen and already interactive. */
const BASE_FILES = [
  ["boundary.geojson", 1],
  ["parks.geojson", 1],
  ["roads.geojson", 6],
];

const LOAD_LABEL = {
  boundary: "borough outline",
  parks: "parkland",
  roads: "street network",
};

const base = await loadAll(BASE_FILES, (key, overall) => {
  boot.set(4 + Math.round(overall * 56), LOAD_LABEL[key] || key);
});

boot.set(62, "building the world");

const map = new maplibregl.Map({
  container: "map",
  style: buildStyle(base),
  center: CAMERA.center,
  zoom: CAMERA.zoom,
  pitch: CAMERA.pitch,
  bearing: CAMERA.bearing,
  minZoom: CAMERA.minZoom,
  maxZoom: CAMERA.maxZoom,
  minPitch: CAMERA.minPitch,
  maxPitch: CAMERA.maxPitch,
  maxBounds: MAX_BOUNDS,
  attributionControl: false,
  dragRotate: true,
  antialias: true,
  fadeDuration: 200,
});

window.__map = map; // for console inspection during development

map.on("load", () => {
  boot.set(88, "lighting the scene");
  applyAtmosphere(map);
  map.touchZoomRotate.enableRotation();
  boot.done();
  loadCity();
});

/* ------------------------------------------------------------- the city */

/* A small chip in the corner while the buildings stream in, so the empty
   borough never looks like the finished product. */
function cityChip() {
  const el = document.createElement("div");
  el.className = "panel";
  el.id = "city-chip";
  el.innerHTML = `<span class="dot"></span><span class="txt">Building the city…</span>`;
  document.body.appendChild(el);
  return {
    set(pct) {
      el.querySelector(".txt").textContent = `Building the city… ${Math.round(pct * 100)}%`;
    },
    done(n) {
      el.querySelector(".dot").classList.add("ok");
      el.querySelector(".txt").textContent = `${n.toLocaleString()} buildings`;
      setTimeout(() => el.classList.add("fade"), 2600);
      setTimeout(() => el.remove(), 3400);
    },
    fail(msg) {
      el.querySelector(".dot").classList.add("bad");
      el.querySelector(".txt").textContent = msg;
    },
  };
}

async function loadCity() {
  const chip = cityChip();
  try {
    const buildings = await loadFile("buildings.geojson", (f) => chip.set(f));
    addBuildingLayers(map, buildings);
    chip.done(buildings.features.length);
  } catch (err) {
    console.error(err);
    chip.fail("Buildings unavailable — run pipeline/process.py");
  }
  buildViewSwitcher();
  bindInspect(map, views);
}

/* ------------------------------------------------------------- data views */

const views = new ViewManager(map, { onLegend: renderLegend });
window.__views = views;

function buildViewSwitcher() {
  const host = $("#view-switcher");
  if (!host) return;
  host.innerHTML = "";
  for (const [key, v] of Object.entries(VIEWS)) {
    const b = document.createElement("button");
    b.className = "view-tab" + (key === views.current ? " is-active" : "");
    b.type = "button";
    b.dataset.view = key;
    b.innerHTML = `<span class="vl">${v.label}</span><span class="vh">${v.hint}</span>`;
    b.addEventListener("click", async () => {
      host.querySelectorAll(".view-tab").forEach((x) => x.classList.remove("is-active"));
      b.classList.add("is-active");
      b.classList.add("is-loading");
      try {
        await views.show(key);
      } catch (err) {
        console.error(err);
        renderLegend({ title: v.label, blurb: "This view's data failed to load." });
      } finally {
        b.classList.remove("is-loading");
      }
    });
    host.appendChild(b);
  }
  renderLegend(views.legend());
}

function renderLegend(legend) {
  const el = $("#legend");
  if (!el) return;
  if (!legend) {
    el.innerHTML = "";
    el.style.display = "none";
    return;
  }
  el.style.display = "";

  const swatches = (legend.swatches || [])
    .map((s) => `<div class="lg-row">
        <span class="lg-sw" style="background:${s.color}"></span>
        <span class="lg-lb">${s.label}</span>
      </div>`)
    .join("");

  const types = (legend.types || [])
    .map((t) => `<button type="button" class="lg-type${t === legend.activeType ? " is-active" : ""}"
        data-type="${t.replace(/"/g, "&quot;")}">${t}</button>`)
    .join("");

  el.innerHTML = `
    <div class="panel-title">${legend.title}${legend.hint ? ` — ${legend.hint}` : ""}</div>
    <div class="lg-body">
      ${legend.blurb ? `<p class="lg-blurb">${legend.blurb}</p>` : ""}
      ${types ? `<div class="lg-types">${types}</div>` : ""}
      ${swatches}
      ${legend.note ? `<p class="lg-note">${legend.note}</p>` : ""}
    </div>`;

  el.querySelectorAll(".lg-type").forEach((b) => {
    b.addEventListener("click", () => views.setSr311Type(b.dataset.type));
  });
}

map.on("error", (e) => {
  const msg = (e && e.error && e.error.message) || "unknown map error";
  console.error("map error:", msg, e);
  if (boot.step) boot.step.textContent = "error: " + msg;
});

/* --------------------------------------------------------- camera controls */

function flyTo(vp) {
  map.easeTo({
    center: vp.center,
    zoom: vp.zoom,
    pitch: vp.pitch,
    bearing: vp.bearing,
    duration: 900,
    essential: true,
  });
}

function buildViewpoints() {
  const host = $("#viewpoints");
  if (!host) return;
  VIEWPOINTS.forEach((vp, i) => {
    const b = document.createElement("button");
    b.className = "btn" + (i === 0 ? " is-active" : "");
    b.type = "button";
    b.textContent = vp.label;
    b.addEventListener("click", () => {
      host.querySelectorAll(".btn").forEach((x) => x.classList.remove("is-active"));
      b.classList.add("is-active");
      flyTo(vp);
    });
    host.appendChild(b);
  });
}

/* The compass needle is drawn in code — no icon font, no image file. */
function buildCompass() {
  const el = $("#compass");
  if (!el) return;
  el.innerHTML = `
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <g id="needle">
        <polygon points="13,2 17,14 13,11.5 9,14" fill="#e2564a" stroke="#0d1520" stroke-width="1"/>
        <polygon points="13,24 9,12 13,14.5 17,12" fill="#c6d4e4" stroke="#0d1520" stroke-width="1"/>
      </g>
    </svg>`;
  el.title = "Reset bearing to north (click)";
  el.addEventListener("click", () =>
    map.easeTo({ bearing: 0, pitch: CAMERA.pitch, duration: 600 })
  );
  const needle = el.querySelector("#needle");
  const sync = () => {
    needle.setAttribute("transform", `rotate(${-map.getBearing()} 13 13)`);
  };
  map.on("rotate", sync);
  sync();
}

/* Keyboard: camera only. Arrow keys pan, Q/E rotate, R/F tilt, 0 resets. */
function bindKeys() {
  window.addEventListener("keydown", (e) => {
    if (e.target && /input|textarea/i.test(e.target.tagName)) return;
    const step = e.shiftKey ? 3 : 1;
    switch (e.key.toLowerCase()) {
      case "q": map.easeTo({ bearing: map.getBearing() - 8 * step, duration: 180 }); break;
      case "e": map.easeTo({ bearing: map.getBearing() + 8 * step, duration: 180 }); break;
      case "r": map.easeTo({ pitch: Math.min(CAMERA.maxPitch, map.getPitch() + 4 * step), duration: 180 }); break;
      case "f": map.easeTo({ pitch: Math.max(CAMERA.minPitch, map.getPitch() - 4 * step), duration: 180 }); break;
      case "0": flyTo(VIEWPOINTS[0]); break;
      default: return;
    }
    e.preventDefault();
  });
}

/* ------------------------------------------------------------ data footer */

async function buildFooter() {
  const el = $("#data-footer");
  if (!el) return;
  try {
    const man = await loadFile("manifest.json");
    const dates = Object.values(man.sources)
      .map((s) => s.publisher_updated_at)
      .filter(Boolean)
      .sort();
    const newest = dates.length ? dates[dates.length - 1].slice(0, 10) : "—";
    const oldest = dates.length ? dates[0].slice(0, 10) : "—";
    const n = Object.keys(man.sources).length;
    el.innerHTML =
      `<strong>Data as of ${newest}</strong> — ${n} NYC Open Data datasets, ` +
      `published between ${oldest} and ${newest}. ` +
      `A snapshot, not a live feed. Nothing here is simulated or invented. ` +
      `<a href="../DATA_SOURCES.md">Sources &amp; vintages →</a>`;
  } catch (err) {
    el.textContent = "Data manifest unavailable — run pipeline/process.py.";
  }
}

/* Companion to the rAF shim above: wait until the map has settled, so a
   headless driver can screenshot a finished frame instead of a half-drawn one. */
window.__settled = (timeoutMs = 30000) =>
  new Promise((resolve) => {
    const t0 = performance.now();
    const check = () => {
      if (map.loaded() || performance.now() - t0 > timeoutMs) {
        resolve({ ms: Math.round(performance.now() - t0), loaded: map.loaded() });
      } else {
        requestAnimationFrame(check);
      }
    };
    check();
  });

buildViewpoints();
buildCompass();
bindKeys();
buildFooter();
