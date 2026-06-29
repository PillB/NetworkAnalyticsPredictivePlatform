import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { probeOnlineDatasetSources } from "../../packages/guided-workflow/online-dataset-adapters.mjs";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4411);
const baseURL = `http://127.0.0.1:${port}`;
const runId = new Date().toISOString().replaceAll(/[:.]/g, "-");
const artifacts = process.env.FLOW_AUDIT_DIR ?? `test-results/flow-audit/${runId}`;
const maxFixPasses = Number(process.env.FLOW_AUDIT_FIX_PASSES ?? 2);

function playwrightModulePath() {
  if (process.env.PLAYWRIGHT_MODULE) return process.env.PLAYWRIGHT_MODULE;
  const npxRoot = join(homedir(), ".npm", "_npx");
  if (existsSync(npxRoot)) {
    const candidates = execFileSync("find", [npxRoot, "-path", "*/node_modules/playwright/index.mjs", "-print"], { encoding: "utf8" })
      .trim()
      .split("\n")
      .filter(Boolean)
      .sort()
      .reverse();
    if (candidates.length) return candidates[0];
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
      // Server may still be binding.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Screenshot audit server did not become ready");
}

async function visualDiagnostics(page) {
  return page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && box.width > 0 && box.height > 0;
    };
    const elements = [...document.querySelectorAll("button, input, select, textarea, h1, h2, h3, p, small, td, th")]
      .filter((element) => !element.closest(".status-bar"))
      .filter(visible);
    const textBoxes = elements
      .map((element, index) => {
        const box = element.getBoundingClientRect();
        return {
          index,
          selector: element.id ? `#${element.id}` : element.tagName.toLowerCase(),
          text: (element.innerText || element.value || element.textContent || "").trim().slice(0, 80),
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
          tagName: element.tagName.toLowerCase(),
        };
      });
    const clipping = textBoxes
      .filter((box) => box.y + box.height > 0 && box.y < innerHeight)
      .filter((box) => {
        if (box.tagName === "textarea") return box.scrollWidth > box.clientWidth + 3;
        if (box.tagName === "select") return false;
        return box.scrollWidth > box.clientWidth + 3 || box.scrollHeight > box.clientHeight + 3;
      })
      .slice(0, 20);
    const overlaps = [];
    for (let i = 0; i < textBoxes.length; i += 1) {
      for (let j = i + 1; j < textBoxes.length; j += 1) {
        if (elements[i].contains(elements[j]) || elements[j].contains(elements[i])) continue;
        const a = textBoxes[i];
        const b = textBoxes[j];
        if (a.tagName === "small" && b.tagName === "small") continue;
        if (a.y + a.height < 0 || b.y + b.height < 0 || a.y > innerHeight || b.y > innerHeight) continue;
        const area = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
          * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
        if (area > 240 && a.text && b.text && Math.abs(a.y - b.y) > 2) {
          overlaps.push({ a: a.selector, b: b.selector, area: Math.round(area) });
        }
      }
    }
    const svgs = [...document.querySelectorAll("svg")]
      .filter(visible)
      .filter((svg) => svg.id !== "manualChartCanvas")
      .map((svg) => ({
        id: svg.id || svg.getAttribute("aria-label") || "svg",
        nodes: svg.querySelectorAll(".graph-node").length,
        edges: svg.querySelectorAll(".graph-edge").length,
        width: Math.round(svg.getBoundingClientRect().width),
        height: Math.round(svg.getBoundingClientRect().height),
      }));
    const prohibitedText = document.body.innerText.match(/criminal gang proof|should be arrested|proved guilty|production prediction enabled|pretrained SOTA/i)?.[0] ?? null;
    return {
      url: location.href,
      title: document.title,
      viewport: { width: innerWidth, height: innerHeight },
      scroll: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      clipping,
      overlaps: overlaps.slice(0, 20),
      svgs,
      blankVisibleSvgs: svgs.filter((svg) => svg.width > 100 && svg.height > 100 && svg.nodes === 0 && svg.edges === 0),
      prohibitedText,
      status: document.querySelector("#statusMessage")?.textContent?.trim() ?? "",
      heading: document.querySelector("#question-title")?.textContent?.trim() ?? "",
    };
  });
}

function severityFor(diagnostics) {
  if (diagnostics.prohibitedText) return "blocker";
  if (diagnostics.horizontalOverflow) return "major";
  if (diagnostics.blankVisibleSvgs.length) return "major";
  if (diagnostics.clipping.length > 6 || diagnostics.overlaps.length > 8) return "major";
  if (diagnostics.clipping.length || diagnostics.overlaps.length) return "minor";
  return "pass";
}

async function captureStep(page, report, flowId, stepId, label) {
  const flowDir = join(artifacts, flowId);
  mkdirSync(flowDir, { recursive: true });
  const index = String(report.steps.length + 1).padStart(3, "0");
  const screenshot = join(flowDir, `${index}-${stepId}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  const diagnostics = await visualDiagnostics(page);
  const severity = severityFor(diagnostics);
  report.steps.push({
    index: report.steps.length + 1,
    flowId,
    stepId,
    label,
    screenshot,
    severity,
    diagnostics,
  });
}

async function action(page, report, flowId, stepId, label, callback) {
  await callback();
  await page.waitForTimeout(120);
  await captureStep(page, report, flowId, stepId, label);
}

async function startFreshPage(browser, report, flowId, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport, acceptDownloads: true, reducedMotion: "reduce" });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseURL}/apps/web/`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await captureStep(page, report, flowId, "load", "Fresh page load");
  return { context, page, errors };
}

async function harborFlow(browser, report) {
  const flowId = "harbor-fresh-report";
  const { context, page, errors } = await startFreshPage(browser, report, flowId);
  await action(page, report, flowId, "help-open", "Open help dialog", () => page.locator("#helpButton").click());
  await action(page, report, flowId, "help-close", "Close help dialog", () => page.locator("#closeHelp").click());
  for (let index = 0; index < 6; index += 1) {
    await action(page, report, flowId, `step-${index + 2}`, `Advance guided step ${index + 2}`, () => page.locator("#nextStep").click());
  }
  await action(page, report, flowId, "overlay", "Switch to overlay graph", () => page.locator("#comparisonMode").selectOption("overlay"));
  await action(page, report, flowId, "timeline", "Switch to timeline split graph", () => page.locator("#comparisonMode").selectOption("timeline-split"));
  await action(page, report, flowId, "evidence", "Select first evidence row", () => page.locator("#evidenceRows tr").first().click());
  await action(page, report, flowId, "reasoning", "Open reasoning tab", () => page.locator('[role="tab"][data-tab="reasoning"]').click());
  await action(page, report, flowId, "ack", "Acknowledge next action", () => page.locator("#ackRecommendation").click());
  await action(page, report, flowId, "ready", "Mark finding ready", () => page.locator("#markFinding").click());
  await action(page, report, flowId, "preflight", "Run report preflight", () => page.locator("#runPreflight").click());
  report.browserErrors.push(...errors.map((message) => ({ flowId, message })));
  await context.close();
}

async function dojoFlow(browser, report) {
  const flowId = "dojo-community-benchmark";
  const { context, page, errors } = await startFreshPage(browser, report, flowId);
  await action(page, report, flowId, "select-dataset", "Select dojo karate benchmark dataset", () => page.locator("#datasetMode").selectOption("dojo-karate-split-v1"));
  await action(page, report, flowId, "run-community", "Run deterministic community analysis", () => page.locator("#runLocalModel").click());
  await action(page, report, flowId, "hide-bridge", "Hide bridge interactions", () => page.locator("#aliasIncluded").uncheck());
  await action(page, report, flowId, "single-after", "Show single after graph", () => page.locator("#comparisonMode").selectOption("single-after"));
  await action(page, report, flowId, "reasoning", "Review reasoning tab", () => page.locator('[role="tab"][data-tab="reasoning"]').click());
  await action(page, report, flowId, "ack", "Acknowledge benchmark next action", () => page.locator("#ackRecommendation").click());
  await action(page, report, flowId, "ready", "Mark benchmark finding ready", () => page.locator("#markFinding").click());
  await action(page, report, flowId, "preflight", "Run benchmark preflight", () => page.locator("#runPreflight").click());
  report.browserErrors.push(...errors.map((message) => ({ flowId, message })));
  await context.close();
}

async function fraudImportFlow(browser, report) {
  const flowId = "fraud-import-model-workspace";
  const { context, page, errors } = await startFreshPage(browser, report, flowId);
  await action(page, report, flowId, "select-fraud", "Select transaction fraud workflow", () => page.locator("#useCaseMode").selectOption("fraud"));
  await action(page, report, flowId, "load-json", "Load sample JSON", () => page.locator("#loadSampleJson").click());
  await action(page, report, flowId, "preview-json", "Preview JSON import with rejection", () => page.locator("#previewImport").click());
  await action(page, report, flowId, "load-csv", "Load sample CSV", () => page.locator("#loadSampleCsv").click());
  await action(page, report, flowId, "preview-csv", "Preview CSV import", () => page.locator("#previewImport").click());
  await action(page, report, flowId, "apply-import", "Apply imported transaction workflow", () => page.locator("#applyImport").click());
  await action(page, report, flowId, "run-model", "Run automatic transaction analysis", () => page.locator("#runLocalModel").click());
  await action(page, report, flowId, "bloom-path", "Run graph phrase path", async () => {
    await page.locator("#bloomPhrase").fill("paths between Acct 100 and Acct 777");
    await page.locator("#runBloomPhrase").click();
  });
  await action(page, report, flowId, "workspace-search", "Search chart workspace", async () => {
    await page.locator("#chartSearch").fill("Acct 777");
    await page.locator("#saveSearch").click();
  });
  await action(page, report, flowId, "pin-expand", "Pin and expand workspace item", async () => {
    await page.locator("#pinFirstResult").click();
    await page.locator("#expandSelected").click();
  });
  await action(page, report, flowId, "report-preflight", "Complete imported report preflight", async () => {
    await page.locator("#evidenceRows tr").first().click();
    await page.locator('[role="tab"][data-tab="reasoning"]').click();
    await page.locator("#ackRecommendation").click();
    await page.locator("#markFinding").click();
    await page.locator("#runPreflight").click();
  });
  report.browserErrors.push(...errors.map((message) => ({ flowId, message })));
  await context.close();
}

async function mobileFlow(browser, report) {
  const flowId = "mobile-critical-path";
  const { context, page, errors } = await startFreshPage(browser, report, flowId, { width: 390, height: 844 });
  await action(page, report, flowId, "mobile-next", "Advance one mobile step", () => page.locator("#nextStep").click());
  await action(page, report, flowId, "mobile-customize", "Open mobile customization controls", () => page.locator("#visualControls").click());
  await action(page, report, flowId, "mobile-dojo", "Select dojo on mobile", () => page.locator("#datasetMode").selectOption("dojo-karate-split-v1"));
  await action(page, report, flowId, "mobile-run", "Run dojo model on mobile", () => page.locator("#runLocalModel").click());
  report.browserErrors.push(...errors.map((message) => ({ flowId, message })));
  await context.close();
}

function summarize(report) {
  const issues = report.steps
    .filter((step) => step.severity !== "pass")
    .map((step) => ({
      id: `${step.flowId}-${step.index}`,
      flowId: step.flowId,
      step: step.label,
      severity: step.severity,
      screenshot: step.screenshot,
      diagnostics: {
        horizontalOverflow: step.diagnostics.horizontalOverflow,
        clipping: step.diagnostics.clipping.slice(0, 3),
        overlaps: step.diagnostics.overlaps.slice(0, 3),
        blankVisibleSvgs: step.diagnostics.blankVisibleSvgs,
        prohibitedText: step.diagnostics.prohibitedText,
      },
      fixPassesAllowed: maxFixPasses,
      status: step.severity === "minor" ? "queued-for-polish" : "requires-fix-pass",
    }));
  report.issues = issues;
  report.summary = {
    totalSteps: report.steps.length,
    pass: report.steps.filter((step) => step.severity === "pass").length,
    minor: report.steps.filter((step) => step.severity === "minor").length,
    major: report.steps.filter((step) => step.severity === "major").length,
    blocker: report.steps.filter((step) => step.severity === "blocker").length,
    browserErrors: report.browserErrors.length,
    datasetSources: report.datasetSources.map((source) => ({ id: source.id, status: source.status })),
  };
}

function writeReports(report) {
  mkdirSync(artifacts, { recursive: true });
  const jsonPath = join(artifacts, "flow-audit-report.json");
  const mdPath = join(artifacts, "flow-audit-report.md");
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  const issueLines = report.issues.length
    ? report.issues.map((issue) =>
        `| ${issue.severity} | ${issue.flowId} | ${issue.step} | ${issue.screenshot} | ${JSON.stringify(issue.diagnostics).replaceAll("|", "\\|")} |`
      ).join("\n")
    : "| pass | all | No visual issues detected by automated diagnostics | | |";
  const datasetLines = report.datasetSources.map((source) =>
    `| ${source.id} | ${source.status} | ${source.httpStatus ?? ""} | ${source.reason.replaceAll("|", "\\|")} |`
  ).join("\n");
  writeFileSync(mdPath, `# End-to-End Screenshot Flow Audit

Run: ${report.runId}

## Summary

- Steps captured: ${report.summary.totalSteps}
- Pass: ${report.summary.pass}
- Minor: ${report.summary.minor}
- Major: ${report.summary.major}
- Blocker: ${report.summary.blocker}
- Browser errors: ${report.summary.browserErrors}
- Fix passes allowed per blocking issue: ${maxFixPasses}

## Issues

| Severity | Flow | Step | Screenshot | Diagnostics |
| --- | --- | --- | --- | --- |
${issueLines}

## Online Dataset Source Probes

| Source | Status | HTTP | Reason |
| --- | --- | --- | --- |
${datasetLines}

Adapter-only or blocked sources are not success states. They are recorded for follow-up dataset ingestion work.
`);
  return { jsonPath, mdPath };
}

mkdirSync(artifacts, { recursive: true });
const server = spawn(process.execPath, ["scripts/serve-web.mjs"], {
  env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverStderr = "";
server.stderr.on("data", (chunk) => {
  serverStderr += chunk;
});

try {
  await waitForServer();
  const datasetSources = await probeOnlineDatasetSources();
  const { chromium } = await import(pathToFileURL(playwrightModulePath()).href);
  const browser = await chromium.launch({ headless: true });
  const report = {
    contract: "EndToEndScreenshotFlowAuditV1",
    runId,
    baseURL,
    artifacts,
    maxFixPasses,
    datasetSources,
    browserErrors: [],
    steps: [],
    issues: [],
  };
  try {
    await harborFlow(browser, report);
    await dojoFlow(browser, report);
    await fraudImportFlow(browser, report);
    await mobileFlow(browser, report);
  } finally {
    await browser.close();
  }
  summarize(report);
  const paths = writeReports(report);
  assert.equal(report.browserErrors.length, 0, `Browser errors occurred:\n${JSON.stringify(report.browserErrors, null, 2)}`);
  assert.equal(report.summary.blocker, 0, `Blocker visual issues found. See ${paths.mdPath}`);
  assert.equal(report.summary.major, 0, `Major visual issues found. See ${paths.mdPath}`);
  console.log(`Screenshot flow audit passed: ${paths.mdPath}`);
} finally {
  server.kill("SIGTERM");
  if (serverStderr.trim()) process.stderr.write(serverStderr);
}
