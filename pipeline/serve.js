/* Minimal static file server for local development.
   `python3 -m http.server` is fine too, but it resolves its default directory
   from the process cwd, which some sandboxes refuse. This is explicit. */

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.argv[2] || 8787);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".geojson": "application/geo+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".md": "text/plain; charset=utf-8",
};

http
  .createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split("?")[0]);
    if (rel === "/") {
      // Redirect rather than rewrite, so the page's relative URLs resolve.
      res.writeHead(302, { location: "/site/index.html" }).end();
      return;
    }
    const file = path.join(ROOT, path.normalize(rel));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end("forbidden");
      return;
    }
    fs.stat(file, (err, st) => {
      console.log(`${req.method} ${rel} -> ${err || !st.isFile() ? 404 : 200}`);
      if (err || !st.isFile()) {
        res.writeHead(404, { "content-type": "text/plain" }).end("not found: " + rel);
        return;
      }
      res.writeHead(200, {
        "content-type": TYPES[path.extname(file)] || "application/octet-stream",
        "content-length": st.size,
        "cache-control": "no-cache",
      });
      fs.createReadStream(file).pipe(res);
    });
  })
  .listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}/site/index.html`));
