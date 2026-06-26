import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(".");
const output = resolve(process.env.PAGES_OUTPUT ?? "dist-pages");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const directory of ["apps/web", "packages", "data"]) {
  await cp(resolve(root, directory), resolve(output, directory), {
    recursive: true,
  });
}

const appIndexPath = resolve(output, "apps/web/index.html");
const appIndex = await readFile(appIndexPath, "utf8");
await writeFile(
  appIndexPath,
  appIndex.replace(
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="napp-deployment-mode" content="github-pages-static-training" />`,
  ),
  "utf8",
);

const entrypoint = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="0; url=./apps/web/" />
    <title>Harbor Lantern · Guided analysis</title>
  </head>
  <body>
    <p><a href="./apps/web/">Open the Harbor Lantern guided analysis</a></p>
  </body>
</html>
`;

await writeFile(resolve(output, "index.html"), entrypoint, "utf8");
await writeFile(resolve(output, "404.html"), entrypoint, "utf8");
await writeFile(resolve(output, ".nojekyll"), "", "utf8");

console.log(`GitHub Pages artifact built at ${output}`);
