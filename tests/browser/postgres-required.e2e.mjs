import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4405);
const repository = process.env.PAGES_BASE_PATH ?? "NetworkAnalyticsPredictivePlatform";
const baseURL = `http://127.0.0.1:${port}/${repository}`;

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

execFileSync(process.execPath, ["scripts/build-pages.mjs"], { stdio: "inherit" });
const server = spawn(process.execPath, ["scripts/serve-pages.mjs"], {
  env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), PAGES_BASE_PATH: repository },
  stdio: ["ignore", "pipe", "pipe"],
});
let stderr = "";
server.stderr.on("data", (chunk) => {
  stderr += chunk;
});

try {
  await waitForServer();
  const { chromium } = await import(pathToFileURL(playwrightModulePath()).href);
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(() => {
      localStorage.setItem("nappDemoApiBaseUrl", "https://demo-api.example.test");
      localStorage.setItem("nappDemoToken", "demo-token");
      localStorage.setItem("nappDemoActorId", "demo-analyst");
    });
    const page = await context.newPage();
    const browserErrors = [];
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        !/503 \(Service Unavailable\)/i.test(message.text())
      ) {
        browserErrors.push(`console: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => browserErrors.push(`page: ${error.message}`));
    await page.route("https://demo-api.example.test/v1/cases/harbor-lantern/workbench", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          detail: {
            error: {
              code: "postgres_demo_not_ready",
              message: "PostgreSQL workbench source is enabled but the secure runtime probe failed.",
            },
          },
        }),
      });
    });

    await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
    assert.match(
      await page.locator("#demoLoginStatus").textContent(),
      /Demo API failed closed/i,
    );
    assert.match(
      await page.locator("#demoLoginStatus").textContent(),
      /Static fallback is not a successful PostgreSQL validation/i,
    );
    assert.match(
      await page.locator("#statusMessage").textContent(),
      /failed closed/i,
    );
    assert.doesNotMatch(
      await page.locator("#statusMessage").textContent(),
      /Authorized service projection loaded/i,
    );
    assert.deepEqual(browserErrors, [], `Browser errors occurred:\n${browserErrors.join("\n")}`);
    await context.close();
  } finally {
    await browser.close();
  }
} finally {
  server.kill();
  if (stderr) process.stderr.write(stderr);
}
