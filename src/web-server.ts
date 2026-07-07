/**
 * Lightweight HTTP server that serves the landing page.
 * Runs alongside the Discord bot on PORT (default 3000).
 * Render requires at least one open port to keep the service alive.
 * Started before Discord login so Render health checks pass immediately.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "./utils/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env["PORT"] ?? "3000", 10);

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css",
  ".js":   "text/javascript",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
};

// public/ lives at the project root, one level above dist/
const PUBLIC_DIR = path.resolve(__dirname, "../public");

function resolvePublicPath(urlPath: string): string | null {
  // Decode percent-encoding, strip query string, remove leading slash
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath.split("?")[0] ?? "/");
  } catch {
    return null; // malformed URL — reject
  }

  const relative = decoded.replace(/^\/+/, "") || "index.html";

  // Canonicalise to prevent path-traversal (e.g. /../../../etc/passwd)
  const full = path.resolve(PUBLIC_DIR, relative);
  const rel  = path.relative(PUBLIC_DIR, full);

  // rel must not start with ".." and must not be absolute
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;

  return full;
}

export function startWebServer(): void {
  const server = http.createServer((req, res) => {
    const urlPath = req.url ?? "/";
    let filePath = resolvePublicPath(urlPath);

    if (!filePath) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    // Fall back to index.html for missing paths or directories
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(PUBLIC_DIR, "index.html");
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] ?? "application/octet-stream";

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not Found");
        return;
      }
      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    });
  });

  server.listen(PORT, "0.0.0.0", () => {
    logger.info(`Web server running on port ${PORT}`);
  });

  server.on("error", (err) => {
    logger.error("Web server error", err);
  });
}
