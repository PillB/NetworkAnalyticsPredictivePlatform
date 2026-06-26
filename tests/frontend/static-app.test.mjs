import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

test("static application has no package-manager or framework dependency", async () => {
  const html = await readFile(`${repoRoot}apps/web/index.html`, "utf8");
  const app = await readFile(`${repoRoot}apps/web/app.mjs`, "utf8");

  assert.match(html, /<script type="module" src="\.\/app\.mjs"><\/script>/);
  assert.doesNotMatch(html, /node_modules|react|cdn\./i);
  assert.doesNotMatch(app, /from ["'](react|vue|svelte|@)/i);
});

test("demo server preserves repository-relative module paths", async () => {
  const server = await readFile(`${repoRoot}scripts/serve-web.mjs`, "utf8");
  assert.match(server, /Location: "\/apps\/web\/"/);
  assert.match(server, /const root = resolve\("\."\)/);
  assert.match(server, /"\.mjs": "text\/javascript; charset=utf-8"/);
  assert.match(server, /X-Workbench-Mode/);
});

test("core visual has a semantic table and live status equivalent", async () => {
  const html = await readFile(`${repoRoot}apps/web/index.html`, "utf8");
  assert.match(html, /<table>/);
  assert.match(html, /id="evidenceRows"/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(html, /Skip to analysis/);
});

test("mandatory interpretation safeguards are present", async () => {
  const html = await readFile(`${repoRoot}apps/web/index.html`, "utf8");
  assert.match(html, /do not determine guilt/i);
  assert.match(html, /Not evidence of termination/i);
  assert.match(html, /Fictional training data/i);
  assert.match(html, /does not estimate guilt/i);
  assert.match(html, /Uncalibrated baseline/i);
});
