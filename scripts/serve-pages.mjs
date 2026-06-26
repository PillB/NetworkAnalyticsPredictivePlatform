import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.env.PAGES_ROOT ?? "dist-pages");
const basePath = `/${(process.env.PAGES_BASE_PATH ?? "NetworkAnalyticsPredictivePlatform")
  .replace(/^\/+|\/+$/g, "")}`;
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 4402);
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function localPath(urlPath) {
  const decoded = normalize(decodeURIComponent(urlPath.split("?")[0]));
  if (decoded !== basePath && !decoded.startsWith(`${basePath}/`)) return null;
  const relative = decoded.slice(basePath.length).replace(/^[/\\]+/, "");
  const candidate = resolve(join(root, relative));
  return candidate === root || candidate.startsWith(`${root}/`) ? candidate : null;
}

createServer((request, response) => {
  let filePath = localPath(request.url ?? "/");
  if (!filePath) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  try {
    if (statSync(filePath).isDirectory()) filePath = join(filePath, "index.html");
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    createReadStream(join(root, "404.html")).pipe(response);
  }
}).listen(port, host, () => {
  console.log(`Pages preview: http://${host}:${port}${basePath}/`);
});
