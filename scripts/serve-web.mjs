import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(".");
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 4173);
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function safePath(urlPath) {
  const requested = normalize(decodeURIComponent(urlPath.split("?")[0]));
  const relative = requested.replace(/^[/\\]+/, "");
  const candidate = resolve(join(root, relative));
  return candidate.startsWith(`${root}/`) || candidate === root ? candidate : null;
}

createServer((request, response) => {
  if ((request.url ?? "").split("?")[0] === "/v1/cases/harbor-lantern/workbench") {
    response.writeHead(204, {
      "X-Workbench-Mode": "static-training-fallback",
      "Cache-Control": "no-store",
    });
    response.end();
    return;
  }
  if ((request.url ?? "/").split("?")[0] === "/") {
    response.writeHead(302, { Location: "/apps/web/" });
    response.end();
    return;
  }
  let filePath = safePath(request.url ?? "/");
  if (!filePath) {
    response.writeHead(403).end("Forbidden");
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
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, host, () => {
  console.log(`Guided analysis: http://${host}:${port}`);
});
