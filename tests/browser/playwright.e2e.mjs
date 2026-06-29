import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4399);
const baseURL = `http://127.0.0.1:${port}`;
const artifacts = "test-results/playwright";

function playwrightModulePath() {
  if (process.env.PLAYWRIGHT_MODULE) return process.env.PLAYWRIGHT_MODULE;

  const npxRoot = join(homedir(), ".npm", "_npx");
  if (existsSync(npxRoot)) {
    const cachedCandidates = readdirSync(npxRoot)
      .map((entry) => join(npxRoot, entry, "node_modules", "playwright"))
      .filter((candidate) => existsSync(join(candidate, "index.mjs")))
      .filter((candidate) => {
        const browserManifest = join(candidate, "..", "playwright-core", "browsers.json");
        if (!existsSync(browserManifest)) return false;
        const manifest = JSON.parse(readFileSync(browserManifest, "utf8"));
        const browser = manifest.browsers.find((item) => item.name === "chromium-headless-shell");
        return browser && existsSync(
          join(homedir(), "Library", "Caches", "ms-playwright", `chromium_headless_shell-${browser.revision}`),
        );
      })
      .sort()
      .reverse();
    if (cachedCandidates.length) return join(cachedCandidates[0], "index.mjs");
  }

  const globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
  return join(globalRoot, "@playwright/cli/node_modules/playwright/index.mjs");
}

async function waitForServer(timeoutMs = 10_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${baseURL}/apps/web/`);
      if (response.ok) return;
    } catch {
      // The child process may not have bound the port yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Demo server did not become ready within ${timeoutMs} ms`);
}

async function desktopJourney(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const browserErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => browserErrors.push(`page: ${error.message}`));

  await page.goto(`${baseURL}/apps/web/`, { waitUntil: "networkidle" });
  await assertFocusAndHelpBehavior(page);
  await assertPageLandmarks(page);
  await assertGuidedJourney(page);
  await assertCustomizationAndVersioning(page);
  await assertGraphModesAndLocalTraining(page);
  await assertKeyboardEvidenceSelection(page);
  await assertReportExport(page);

  await page.screenshot({
    path: `${artifacts}/desktop-guided-report.png`,
    fullPage: true,
  });
  assert.deepEqual(browserErrors, [], `Browser errors occurred:\n${browserErrors.join("\n")}`);
  await context.close();
}

async function assertFocusAndHelpBehavior(page) {
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press("Tab");
  assert.equal(
    await page.locator(".skip-link").evaluate((element) => document.activeElement === element),
    true,
  );
  await page.keyboard.press("Enter");
  assert.equal(new URL(page.url()).hash, "#main");

  await page.locator("#helpButton").click();
  assert.equal(await page.locator("#helpDialog").isVisible(), true);
  await page.locator("#closeHelp").click();
  assert.equal(
    await page.locator("#helpButton").evaluate((element) => document.activeElement === element),
    true,
  );
}

async function assertPageLandmarks(page) {
  assert.equal(await page.title(), "Harbor Lantern · Guided analysis");
  assert.equal(await page.locator("h1").first().textContent(), "A guided investigation");
  assert.equal(await page.locator("#stepList .step-button").count(), 7);
  assert.equal(await page.locator("#beforeGraph").getAttribute("aria-label"), "Network before the comparison boundary");
  assert.equal(await page.locator("#afterGraph").getAttribute("aria-label"), "Network after the comparison boundary");
  assert.equal(await page.locator("#evidenceRows tr").count(), 6);
  if (process.env.PLAYWRIGHT_SERVER === "api") {
    assert.match(await page.locator("#statusMessage").textContent(), /Authorized service projection loaded/);
    assert.equal(await page.locator("#priorityQueue .priority-item").count(), 7);
    assert.match(await page.locator("#priorityQueue").innerText(), /evidence review priority/i);
    assert.match(await page.locator(".priority-card").innerText(), /does not estimate guilt/i);
    assert.ok(await page.locator("#priorityQueue .priority-item.is-abstained").count() >= 1);
  } else {
    assert.match(await page.locator("#priorityQueue").innerText(), /No ordering shown in static fallback mode/i);
  }
  await page.locator("#scopeToggle").click();
  assert.equal(await page.locator("#scopeDrawer").isVisible(), true);
  assert.match(await page.locator("#scopeDrawer").innerText(), /Why this default\?/i);
}

async function assertGuidedJourney(page) {
  const expectedTitles = [
    "What changed before the shipment?",
    "Open the claim behind a connection",
    "Compare like with like",
    "A possible split, not a verdict",
    "What if the alias is wrong?",
    "Write a cautious assessment",
    "Check before sharing",
  ];

  for (let index = 0; index < expectedTitles.length; index += 1) {
    assert.equal((await page.locator("#stepTitle").textContent()).trim(), expectedTitles[index]);
    assert.ok((await page.locator("#stepExplanation").textContent()).trim().length > 40);
    assert.ok((await page.locator("#stepTask").textContent()).trim().length > 15);
    if (index < expectedTitles.length - 1) await page.locator("#nextStep").click();
  }
  assert.equal(await page.locator("#nextStep").textContent(), "Review complete");
}

async function assertCustomizationAndVersioning(page) {
  const versionBefore = await page.locator(".version-chip").textContent();
  await page.locator("#visualControls").click();
  await page.locator("#highContrast").check();
  assert.equal(await page.locator("html").getAttribute("data-contrast"), "high");
  assert.equal(await page.locator(".version-chip").textContent(), versionBefore);

  await page.locator("#aliasIncluded").uncheck();
  assert.equal(await page.locator(".version-chip").textContent(), "Analysis v2");
  assert.match(await page.locator("#communityInterpretation").textContent(), /too weak to support a split/i);

  await page.locator("#resetAnalysis").click();
  assert.equal(await page.locator("#aliasIncluded").isChecked(), true);
  assert.equal(await page.locator("#highContrast").isChecked(), true);
  assert.equal(await page.locator(".version-chip").textContent(), "Analysis v3");
  await page.locator("#visualControls").click();
  assert.equal(await page.locator("#visualPopover").isHidden(), true);
}

async function assertGraphModesAndLocalTraining(page) {
  const tableCount = await page.locator("#tableCount").textContent();
  await page.locator("#visualControls").click();

  await page.locator("#comparisonMode").selectOption("single-before");
  assert.equal(await page.locator("#beforeGraph").isVisible(), true);
  assert.equal(await page.locator("#afterGraph").isHidden(), true);
  assert.equal(await page.locator("#tableCount").textContent(), tableCount);

  await page.locator("#comparisonMode").selectOption("single-after");
  assert.equal(await page.locator("#beforeGraph").isHidden(), true);
  assert.equal(await page.locator("#afterGraph").isVisible(), true);
  assert.equal(await page.locator("#tableCount").textContent(), tableCount);

  await page.locator("#comparisonMode").selectOption("overlay");
  assert.equal(await page.locator("#overlayGraph").isVisible(), true);
  assert.match(await page.locator("#overlayPanel").innerText(), /No longer observed/i);

  await page.locator("#comparisonMode").selectOption("timeline-split");
  assert.ok(await page.locator('[id^="timelineGraph"]').count() >= 2);
  assert.match(await page.locator("#overlayPanel").innerText(), /Semantic table unchanged/i);
  assert.equal(await page.locator("#tableCount").textContent(), tableCount);
  await page.locator("#visualControls").click();

  await page.locator("#useCaseMode").selectOption("fraud");
  assert.match(await page.locator("#localModelOutput").innerText(), /Ready to train/i);
  await page.locator("#runLocalModel").click();
  assert.match(await page.locator("#localModelOutput").innerText(), /browser-local logistic/i);
  assert.match(await page.locator("#localModelOutput").innerText(), /Top review-priority prediction: Acct 777/i);
  assert.match(await page.locator("#localModelOutput").innerText(), /tx-004|transaction dependencies/i);
  assert.doesNotMatch(await page.locator("#localModelOutput").innerText(), /should be arrested|proved/i);
  await page.locator("#useCaseMode").selectOption("harbor");
}

async function assertKeyboardEvidenceSelection(page) {
  const row = page.locator("#evidenceRows tr").nth(2);
  await row.focus();
  assert.equal(await row.evaluate((element) => document.activeElement === element), true);
  await page.keyboard.press("Enter");
  assert.match(await page.locator("#inspectorContent").innerText(), /Gate log HL-033/);

  await page.getByRole("tab", { name: "Reasoning" }).click();
  assert.match(await page.locator("#inspectorContent").innerText(), /Why is this connection shown\?/i);
  assert.match(await page.locator("#inspectorContent").innerText(), /What could go wrong\?/i);
  await page.getByRole("tab", { name: "Options" }).click();
  assert.match(await page.locator("#inspectorContent").innerText(), /Test, trace, or retain/i);
}

async function assertReportExport(page) {
  assert.equal(await page.locator("#exportReport").isDisabled(), true);
  await page.locator("#markFinding").click();
  await page.locator("#runPreflight").click();
  assert.match(await page.locator("#reportStatus").textContent(), /needs|Ready/i);
  assert.equal(await page.locator("#exportReport").isDisabled(), true);
  await page.locator("#ackRecommendation").click();
  await page.locator("#runPreflight").click();
  assert.equal(await page.locator("#reportStatus").textContent(), "Preflight passed");
  assert.equal(await page.locator("#exportReport").isEnabled(), true);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#exportReport").click(),
  ]);
  const reportPath = `${artifacts}/${download.suggestedFilename()}`;
  await download.saveAs(reportPath);
  const report = await readFile(reportPath, "utf8");
  assert.match(report, /Known at:/);
  assert.match(report, /Uncertainty and alternatives/);
  assert.match(report, /Provenance appendix/);
  assert.match(report, /not proof of wrongdoing/i);
}

async function mobileJourney(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(`${baseURL}/apps/web/`, { waitUntil: "networkidle" });

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  assert.ok(
    dimensions.page <= dimensions.viewport + 1,
    `Mobile page overflows horizontally: ${dimensions.page}px > ${dimensions.viewport}px`,
  );
  assert.equal(await page.locator("#stepList .step-button").count(), 7);
  await page.locator("#nextStep").click();
  assert.equal(await page.locator("#stepTitle").textContent(), "Open the claim behind a connection");
  await page.locator("#visualControls").click();
  assert.equal(await page.locator("#visualPopover").isVisible(), true);
  await page.screenshot({
    path: `${artifacts}/mobile-guided-analysis.png`,
    fullPage: true,
  });
  await context.close();
}

async function main() {
  await mkdir(artifacts, { recursive: true });
  const { chromium } = await import(pathToFileURL(playwrightModulePath()).href);
  const apiBacked = process.env.PLAYWRIGHT_SERVER === "api";
  const server = spawn(
    apiBacked ? ".venv/bin/uvicorn" : process.execPath,
    apiBacked
      ? [
          "apps.api.optional_api:app",
          "--host",
          "127.0.0.1",
          "--port",
          String(port),
        ]
      : ["scripts/serve-web.mjs"],
    {
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      UV_CACHE_DIR: "/tmp/network-analytics-uv-cache",
    },
    stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let serverStderr = "";
  server.stderr.on("data", (chunk) => {
    serverStderr += chunk;
  });

  try {
    await waitForServer();
    const browser = await chromium.launch({ headless: true });
    try {
      await desktopJourney(browser);
      await mobileJourney(browser);
    } finally {
      await browser.close();
    }
    console.log("Playwright: desktop journey, keyboard flow, report export, and mobile layout passed");
  } finally {
    server.kill("SIGTERM");
    if (serverStderr.trim()) process.stderr.write(serverStderr);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
