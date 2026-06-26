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
const tinyPng = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

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
    await page.locator("#loadSampleJson").click();
    await page.locator("#previewImport").click();
    assert.match(await page.locator("#importPreview").innerText(), /3 accepted/i);
    assert.match(await page.locator("#importPreview").innerText(), /Unsupported currency: DOGE/i);
    await page.locator("#loadSampleCsv").click();
    await page.locator("#previewImport").click();
    assert.match(await page.locator("#importPreview").innerText(), /8 accepted/i);
    assert.match(await page.locator("#importPreview").innerText(), /1 rejected/i);
    await page.locator("#applyImport").click();
    assert.match(await page.locator("#statusMessage").textContent(), /Imported 8 transactions/i);
    assert.match(await page.locator("#graphHeading").textContent(), /Imported financial/i);
    await page.locator("#visualControls").click();
    await page.locator("#nodeVisualTarget").selectOption("acct-777");
    await page.locator("#nodeIconPreset").selectOption("alert");
    assert.match(await page.locator("#statusMessage").textContent(), /Presentation icon updated/i);
    assert.ok(await page.locator(".node-icon").count() >= 1);
    await page.locator("#nodeImageUpload").setInputFiles({
      name: "node.png",
      mimeType: "image/png",
      buffer: tinyPng,
    });
    await page.waitForFunction(() => /Presentation image updated/i.test(document.querySelector("#statusMessage")?.textContent ?? ""));
    assert.match(await page.locator("#statusMessage").textContent(), /Presentation image updated/i);
    assert.ok(await page.locator(".node-image").count() >= 1);
    await page.locator("#resetNodeVisual").click();
    assert.match(await page.locator("#statusMessage").textContent(), /Presentation visual reset/i);
    await page.locator("#rotateRight").click();
    assert.match(await page.locator("#statusMessage").textContent(), /rotated/i);
    const dragTarget = page.locator('.graph-node[data-node-id="acct-777"]').first();
    const dragBox = await dragTarget.boundingBox();
    assert.ok(dragBox);
    await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(dragBox.x + 24, dragBox.y + 18, { steps: 20 });
    await page.mouse.up();
    assert.match(await page.locator("#statusMessage").textContent(), /Moved Acct 777/i);
    await page.locator("#graphUndo").click();
    assert.match(await page.locator("#statusMessage").textContent(), /undo/i);
    await page.locator("#resetLayout").click();
    assert.match(await page.locator("#statusMessage").textContent(), /layout reset/i);
    await page.locator("#chartSearch").fill("Acct 777");
    assert.match(await page.locator("#chartSearchResults").innerText(), /Acct 777/i);
    await page.locator("#pinFirstResult").click();
    assert.match(await page.locator("#chartRows").innerText(), /Acct 777/i);
    await page.locator("#expandSelected").click();
    assert.match(await page.locator("#statusMessage").textContent(), /Expanded selected/i);
    await page.locator("#findPath").click();
    assert.match(await page.locator("#statusMessage").textContent(), /Path added|No path found/i);
    assert.match(await page.locator("#chartRows").innerText(), /Path explanation|Acct 777/i);
    await page.locator("#annotationText").fill("Review transaction timing before briefing");
    await page.locator("#addAnnotation").click();
    assert.match(await page.locator("#chartNotes").innerText(), /analyst annotation/i);
    await page.locator("#manualEntityLabel").fill("Briefing only account");
    await page.locator("#manualEntityType").selectOption("account");
    await page.locator("#addManualEntity").click();
    assert.match(await page.locator("#statusMessage").textContent(), /Manual chart entity added/i);
    assert.match(await page.locator("#chartRows").innerText(), /Briefing only account/i);
    await page.locator("#manualEdgeSource").selectOption("manual-entity-1");
    await page.locator("#manualEdgeTarget").selectOption("acct-777");
    await page.locator("#manualEdgeLabel").fill("briefing-only link");
    await page.locator("#manualEdgeStyle").selectOption("dashed");
    await page.locator("#addManualEdge").click();
    assert.match(await page.locator("#chartRows").innerText(), /briefing-only link/i);
    await page.locator("#redactChartItem").click();
    assert.match(await page.locator("#chartRows").innerText(), /Redacted chart item/i);
    assert.match(await page.locator("#chartNotes").innerText(), /blocked/i);
    const [chartDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("#exportChart").click(),
    ]);
    assert.match(chartDownload.suggestedFilename(), /chart-packet/i);
    assert.match(await page.locator("#statusMessage").textContent(), /manual items remain outside evidence/i);
    await page.locator("#workspaceUndo").click();
    assert.match(await page.locator("#statusMessage").textContent(), /workspace undo/i);
    await page.locator("#workspaceRedo").click();
    assert.match(await page.locator("#statusMessage").textContent(), /workspace redo/i);
    await page.locator("#layoutName").fill("Fraud briefing view");
    await page.locator("#saveLayout").click();
    assert.match(await page.locator("#chartNotes").innerText(), /Fraud briefing view/i);
    await page.locator("#restoreLayout").click();
    assert.match(await page.locator("#statusMessage").textContent(), /Restored saved layout/i);
    for (let index = 0; index < 6; index += 1) {
      await page.locator("#nextStep").click();
    }
    assert.equal(await page.locator("#nextStep").textContent(), "Review complete");
    await page.locator("#markFinding").click();
    await page.locator("#runPreflight").click();
    assert.equal(await page.locator("#reportStatus").textContent(), "Preflight passed");
    assert.match(await page.locator("#reportPreview").innerText(), /Provenance appendix/i);
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
