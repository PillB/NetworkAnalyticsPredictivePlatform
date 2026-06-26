import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4402);
const repository = process.env.PAGES_BASE_PATH ?? "NetworkAnalyticsPredictivePlatform";
const remoteURL = process.env.PAGES_REMOTE_URL;
const baseURL = remoteURL
  ? remoteURL.replace(/\/+$/g, "")
  : `http://127.0.0.1:${port}/${repository}`;

function playwrightModulePath() {
  if (process.env.PLAYWRIGHT_MODULE) return process.env.PLAYWRIGHT_MODULE;
  const npxRoot = join(homedir(), ".npm", "_npx");
  if (existsSync(npxRoot)) {
    const candidates = readdirSync(npxRoot)
      .map((entry) => join(npxRoot, entry, "node_modules", "playwright"))
      .filter((candidate) => existsSync(join(candidate, "index.mjs")))
      .sort()
      .reverse();
    if (candidates.length) return join(candidates[0], "index.mjs");
  }
  const globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
  return join(globalRoot, "@playwright/cli/node_modules/playwright/index.mjs");
}

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      if ((await fetch(`${baseURL}/`)).ok) return;
    } catch {
      // Server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Pages preview did not become ready");
}

if (!remoteURL) execFileSync(process.execPath, ["scripts/build-pages.mjs"], { stdio: "inherit" });
const server = remoteURL
  ? null
  : spawn(process.execPath, ["scripts/serve-pages.mjs"], {
      env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), PAGES_BASE_PATH: repository },
      stdio: ["ignore", "pipe", "pipe"],
    });
let stderr = "";
server?.stderr.on("data", (chunk) => {
  stderr += chunk;
});

try {
  await waitForServer();
  const { chromium } = await import(pathToFileURL(playwrightModulePath()).href);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
    assert.equal(new URL(page.url()).pathname, `/${repository}/apps/web/`);
    assert.equal(await page.locator("#stepList .step-button").count(), 7);
    assert.match(
      await page.locator("#statusMessage").textContent(),
      /static training fallback/i,
    );
    assert.match(
      await page.locator("#priorityQueue").innerText(),
      /No ordering shown in static fallback mode/i,
    );
    await page.locator("#useCaseMode").selectOption("fraud");
    assert.match(await page.locator("#question-title").textContent(), /mule accounts|fraud ring/i);
    assert.match(await page.locator("#communityHeading").textContent(), /mule bridge/i);
    assert.equal(await page.locator("#stepList .step-button").count(), 7);
    await page.locator("#visualControls").click();
    await page.locator("#rotateRight").click();
    assert.match(await page.locator("#statusMessage").textContent(), /rotated/i);
    await page.locator("#graphUndo").click();
    assert.match(await page.locator("#statusMessage").textContent(), /undo/i);
    await page.locator("#resetLayout").click();
    assert.match(await page.locator("#statusMessage").textContent(), /layout reset/i);
    for (let index = 0; index < 6; index += 1) {
      await page.locator("#nextStep").click();
    }
    assert.equal(await page.locator("#nextStep").textContent(), "Review complete");
    await page.locator("#markFinding").click();
    await page.locator("#runPreflight").click();
    assert.equal(await page.locator("#reportStatus").textContent(), "Preflight passed");
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
  console.log(
    remoteURL
      ? "GitHub Pages remote: subpath assets, guided MVP, and report preflight passed"
      : "GitHub Pages preview: subpath assets, guided MVP, and report preflight passed",
  );
} finally {
  server?.kill("SIGTERM");
  if (stderr.trim()) process.stderr.write(stderr);
}
