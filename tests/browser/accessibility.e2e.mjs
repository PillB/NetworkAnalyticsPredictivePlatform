import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4401);
const baseURL = `http://127.0.0.1:${port}`;
const artifacts = "test-results/playwright-accessibility";
const zoomCases = [
  { zoom: 200, viewport: { width: 640, height: 900 } },
  { zoom: 300, viewport: { width: 427, height: 900 } },
  { zoom: 400, viewport: { width: 320, height: 900 } },
];

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

async function assertNoPageOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    offenders: [...document.querySelectorAll("body *")]
      .filter((element) => {
        for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
          const overflowX = getComputedStyle(ancestor).overflowX;
          if (["auto", "scroll", "hidden", "clip"].includes(overflowX)) return false;
        }
        return true;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          selector: element.id
            ? `#${element.id}`
            : `${element.tagName.toLowerCase()}.${[...element.classList].join(".")}`,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((item) => item.left < -1 || item.right > document.documentElement.clientWidth + 1)
      .slice(0, 10),
  }));
  assert.ok(
    dimensions.scrollWidth <= dimensions.clientWidth + 1,
    `${label}: document overflows horizontally (${dimensions.scrollWidth}px > ${dimensions.clientWidth}px); offenders: ${JSON.stringify(dimensions.offenders)}`,
  );
  assert.ok(
    dimensions.bodyScrollWidth <= dimensions.clientWidth + 1,
    `${label}: body overflows horizontally (${dimensions.bodyScrollWidth}px > ${dimensions.clientWidth}px)`,
  );
  return dimensions;
}

async function tabTo(page, selector, maxTabs = 80) {
  for (let index = 0; index < maxTabs; index += 1) {
    if (await page.locator(selector).evaluate((element) => document.activeElement === element)) return index;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Keyboard focus did not reach ${selector} within ${maxTabs} Tab presses`);
}

async function assertVisibleKeyboardFocus(locator, label) {
  const focus = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      isActive: document.activeElement === element,
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      rect: {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      },
      viewport: {
        width: document.documentElement.clientWidth,
        height: window.innerHeight,
      },
    };
  });

  assert.equal(focus.isActive, true, `${label}: expected control to own keyboard focus`);
  assert.notEqual(focus.outlineStyle, "none", `${label}: focus outline is not visible`);
  assert.ok(focus.outlineWidth >= 2, `${label}: focus outline is thinner than 2px`);
  assert.ok(
    focus.rect.right >= 0
      && focus.rect.left <= focus.viewport.width
      && focus.rect.bottom >= 0
      && focus.rect.top <= focus.viewport.height,
    `${label}: focused control is outside the visible viewport`,
  );
}

async function assertKeyboardGuidedCompletion(page, label) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.activeElement?.blur();
  });
  await page.keyboard.press("Tab");
  assert.equal(
    await page.locator(".skip-link").evaluate((element) => document.activeElement === element),
    true,
    `${label}: skip link is not the first keyboard stop`,
  );
  await assertVisibleKeyboardFocus(page.locator(".skip-link"), `${label} skip link`);

  await tabTo(page, "#nextStep");
  await assertVisibleKeyboardFocus(page.locator("#nextStep"), `${label} guided Continue button`);

  const expectedTitles = [
    "Open the claim behind a connection",
    "Compare like with like",
    "A possible split, not a verdict",
    "What if the alias is wrong?",
    "Write a cautious assessment",
    "Check before sharing",
  ];
  for (const expectedTitle of expectedTitles) {
    await page.keyboard.press("Enter");
    assert.equal((await page.locator("#stepTitle").textContent()).trim(), expectedTitle);
    assert.equal(
      await page.locator("#nextStep").evaluate((element) => document.activeElement === element),
      true,
      `${label}: guided action lost keyboard focus after advancing`,
    );
  }
  assert.equal(await page.locator("#nextStep").textContent(), "Review complete");
}

async function assertSemanticTableAccess(page, label) {
  const table = page.getByRole("table");
  assert.equal(await table.count(), 1, `${label}: expected one semantic evidence table`);
  assert.equal(
    (await table.getByRole("columnheader").allTextContents()).map((text) => text.trim()).join("|"),
    "Relationship|Period|Event time|Known at|Evidence|Confidence|Community",
    `${label}: semantic column headers changed`,
  );
  assert.equal(await table.locator("th[scope='col']").count(), 7, `${label}: all headers need column scope`);
  assert.equal(await table.locator("tbody tr").count(), 6, `${label}: evidence rows are missing`);

  const row = table.locator("tbody tr").nth(2);
  await row.scrollIntoViewIfNeeded();
  await row.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await assertVisibleKeyboardFocus(row, `${label} evidence row`);
  await page.keyboard.press("Enter");
  assert.match(await page.locator("#inspectorContent").innerText(), /Gate log HL-033/);

  const scrollContainer = page.locator(".table-scroll");
  const tableWidths = await scrollContainer.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflowX: getComputedStyle(element).overflowX,
  }));
  if (tableWidths.scrollWidth > tableWidths.clientWidth + 1) {
    assert.equal(
      ["auto", "scroll"].includes(tableWidths.overflowX),
      true,
      `${label}: wide table is not contained by an intentional horizontal scroller`,
    );
  }
}

async function evaluateZoomCase(browser, zoomCase) {
  const label = `${zoomCase.zoom}% zoom equivalent`;
  const context = await browser.newContext({
    viewport: zoomCase.viewport,
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const browserErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => browserErrors.push(`page: ${error.message}`));

  try {
    await page.goto(`${baseURL}/apps/web/`, { waitUntil: "networkidle" });
    const initialDimensions = await assertNoPageOverflow(page, `${label}, initial`);

    await page.locator("#scopeToggle").click();
    await page.locator("#visualControls").click();
    await assertNoPageOverflow(page, `${label}, expanded controls`);
    await page.locator("#visualControls").click();

    await page.reload({ waitUntil: "networkidle" });
    await assertKeyboardGuidedCompletion(page, label);
    await assertNoPageOverflow(page, `${label}, completed guide`);
    await assertSemanticTableAccess(page, label);
    await assertNoPageOverflow(page, `${label}, semantic table`);

    await page.screenshot({
      path: `${artifacts}/reflow-${zoomCase.zoom}.png`,
      fullPage: true,
    });
    assert.deepEqual(browserErrors, [], `${label}: browser errors occurred:\n${browserErrors.join("\n")}`);
    return {
      zoomPercent: zoomCase.zoom,
      viewport: zoomCase.viewport,
      documentWidth: initialDimensions.scrollWidth,
      pageOverflow: false,
      guidedKeyboardCompletion: true,
      visibleFocus: true,
      semanticTable: true,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  await mkdir(artifacts, { recursive: true });
  const { chromium } = await import(pathToFileURL(playwrightModulePath()).href);
  const server = spawn(process.execPath, ["scripts/serve-web.mjs"], {
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverStderr = "";
  server.stderr.on("data", (chunk) => {
    serverStderr += chunk;
  });

  try {
    await waitForServer();
    const browser = await chromium.launch({ headless: true });
    try {
      const evidence = [];
      for (const zoomCase of zoomCases) evidence.push(await evaluateZoomCase(browser, zoomCase));
      await writeFile(
        `${artifacts}/evidence.json`,
        `${JSON.stringify({ generatedAt: new Date().toISOString(), results: evidence }, null, 2)}\n`,
        "utf8",
      );
    } finally {
      await browser.close();
    }
    console.log("Playwright accessibility: 200%, 300%, and 400% zoom/reflow checks passed");
  } finally {
    server.kill("SIGTERM");
    if (serverStderr.trim()) process.stderr.write(serverStderr);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
