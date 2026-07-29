/* Data loading, on the main thread, with progress.

   Everything the viewer draws is a static file in data/processed/. We fetch
   them here, report progress, and hand parsed objects to MapLibre. See the
   comment in style.js for why we don't let MapLibre fetch URLs itself. */

import { DATA } from "./config.js";

const cache = new Map();

/** Fetch one processed file. Returns parsed JSON. */
export async function loadFile(name, onProgress) {
  if (cache.has(name)) return cache.get(name);

  const res = await fetch(DATA + name);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);

  const total = Number(res.headers.get("content-length")) || 0;
  let json;

  if (!onProgress || !total || !res.body) {
    json = await res.json();
  } else {
    // Stream so the boot bar moves during the big files rather than hanging.
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.length;
      onProgress(got / total);
    }
    const buf = new Uint8Array(got);
    let at = 0;
    for (const c of chunks) {
      buf.set(c, at);
      at += c.length;
    }
    json = JSON.parse(new TextDecoder().decode(buf));
  }

  cache.set(name, json);
  return json;
}

/** Fetch several files, reporting overall progress across them.
 *
 * `names` may be plain filenames or [filename, weight] pairs. Weights matter:
 * buildings.geojson is ~85% of the payload, so an unweighted bar would sit at
 * 75% for almost the whole load and then jump. */
export async function loadAll(names, onStep) {
  const entries = names.map((n) => (Array.isArray(n) ? n : [n, 1]));
  const total = entries.reduce((s, [, w]) => s + w, 0);
  const out = {};
  let done = 0;

  for (const [name, weight] of entries) {
    const key = name.replace(/\.(geo)?json$/, "");
    if (onStep) onStep(key, done / total, 0);
    out[key] = await loadFile(name, (frac) => {
      if (onStep) onStep(key, (done + frac * weight) / total, frac);
    });
    done += weight;
    if (onStep) onStep(key, done / total, 1);
  }
  return out;
}
