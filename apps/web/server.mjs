import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const root = normalize(join(fileURLToPath(new URL(".", import.meta.url)), "../.."));
const port = Number(process.env.PORT || 4173);
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  if (pathname === "/v1/cases/harbor-lantern/workbench") {
    response.writeHead(204, {
      "X-Workbench-Mode": "static-training-fallback",
      "Cache-Control": "no-store",
    }).end();
    return;
  }
  if (pathname === "/") {
    response.writeHead(302, { Location: "/apps/web/" }).end();
    return;
  }
  const relativePath =
    pathname === "/apps/web/"
      ? "apps/web/index.html"
      : pathname.replace(/^\/+/, "");
  const target = normalize(join(root, relativePath));

  if (!target.startsWith(root)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    if (!statSync(target).isFile()) throw new Error("Not a file");
    response.writeHead(200, {
      "Content-Type": types[extname(target)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    createReadStream(target).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
  }
}).listen(port, () => {
  console.log(`Harbor Lantern is available at http://localhost:${port}`);
});
