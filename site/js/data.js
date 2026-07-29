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

/** Fetch several files, reporting overall progress across them. */
export async function loadAll(names, onStep) {
  const out = {};
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const key = name.replace(/\.(geo)?json$/, "");
    if (onStep) onStep(key, i / names.length, 0);
    out[key] = await loadFile(name, (frac) => {
      if (onStep) onStep(key, (i + frac) / names.length, frac);
    });
    if (onStep) onStep(key, (i + 1) / names.length, 1);
  }
  return out;
}
