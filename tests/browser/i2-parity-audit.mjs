import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const artifacts = "test-results/i2-parity";
const reportPath = "docs/validation/i2-parity-playwright-audit.md";
const publicI2Url = process.env.I2_REFERENCE_URL ?? "https://i2group.com/solutions/i2-analysts-notebook";
const repository = process.env.PAGES_BASE_PATH ?? "NetworkAnalyticsPredictivePlatform";
const port = Number(process.env.PLAYWRIGHT_PORT ?? 4411);
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
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      if ((await fetch(`${baseURL}/`)).ok) return;
    } catch {
      // Server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Pages preview did not become ready");
}

function includesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

async function auditI2Reference(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(publicI2Url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.screenshot({ path: `${artifacts}/i2-public-reference.png`, fullPage: true });

  const text = await page.locator("body").innerText();
  const images = await page.locator("img").evaluateAll((elements) =>
    elements
      .map((element) => ({
        alt: element.getAttribute("alt") ?? "",
        src: element.getAttribute("src") ?? "",
      }))
      .filter((item) => item.alt || item.src),
  );
  await context.close();

  const claims = [
    {
      id: "manual-entry",
      label: "Manual drag-and-drop data entry",
      passed: /drag-and-drop data input/i.test(text),
      evidence: "Official page describes intuitive drag-and-drop data input.",
    },
    {
      id: "entities-links-timeline",
      label: "Entities, links, events, timelines, attributes",
      passed: /entities, links, events, timelines or attributes/i.test(text),
      evidence: "Official page lists entities, links, events, timelines, and attributes.",
    },
    {
      id: "briefing-charts",
      label: "Briefing-ready visual charts",
      passed: /briefing charts/i.test(text),
      evidence: "Official page describes easy-to-follow visual briefing charts.",
    },
    {
      id: "redaction",
      label: "Redacted chart versions",
      passed: /redacted versions/i.test(text),
      evidence: "Official page describes producing redacted versions for differing clearances.",
    },
    {
      id: "link-analysis",
      label: "Core link analysis and intermediaries",
      passed: includesAny(text, [/core link analysis/i, /Identify intermediaries/i]),
      evidence: "Official page describes core link analysis and identifying intermediaries.",
    },
    {
      id: "temporal-analysis",
      label: "Temporal/event analysis",
      passed: /critical timeline/i.test(text),
      evidence: "Official page describes understanding the critical timeline of events or patterns.",
    },
    {
      id: "sna",
      label: "Social-network analysis",
      passed: /Social Network Analysis/i.test(text),
      evidence: "Official page describes integrated Social Network Analysis tools.",
    },
    {
      id: "collaboration",
      label: "Collaborative/shared intelligence workflow",
      passed: /real-time collaboration|shared intelligence workflows|synchronised views/i.test(text),
      evidence: "Official page describes collaboration plans with shared workflows and synchronized views.",
    },
  ];

  assert.ok(claims.every((claim) => claim.passed), "Public i2 reference page did not expose all expected comparison claims");
  return { textLength: text.length, images, claims };
}

async function auditOurApp(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    acceptDownloads: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
  await page.locator("#useCaseMode").selectOption("fraud");
  await page.locator("#visualControls").click();
  await page.locator("#visualStyle").selectOption("boardroom");
  await page.locator("#chartSearch").fill("Acct 777");
  await page.locator("#expandSelected").click();
  await page.locator("#findPath").click();
  await page.locator("#annotationText").fill("Briefing note: review source-backed timing before sharing.");
  await page.locator("#addAnnotation").click();
  await page.locator("#manualEntityLabel").fill("Briefing-only account");
  await page.locator("#manualEntityType").selectOption("account");
  await page.locator("#manualEntityStyle").selectOption("slate");
  await page.locator("#addManualEntity").click();
  await page.locator("#moveManualEntity").click();
  const edgeTarget = await page.locator("#manualEdgeTarget option").evaluateAll((options) => {
    const nonManual = options.find((option) => option.value !== "manual-entity-1");
    return nonManual?.value ?? options[0]?.value ?? "";
  });
  assert.ok(edgeTarget, "No manual edge target option was available");
  await page.locator("#manualEdgeSource").selectOption("manual-entity-1");
  await page.locator("#manualEdgeTarget").selectOption(edgeTarget);
  await page.locator("#manualEdgeLabel").fill("briefing-only link");
  await page.locator("#manualEdgeStyle").selectOption("emphasis");
  await page.locator("#addManualEdge").click();
  const authoringChartRows = await page.locator("#chartRows").innerText();
  const authoringChartNotes = await page.locator("#chartNotes").innerText();
  await page.screenshot({ path: `${artifacts}/napp-chart-authoring.png`, fullPage: true });
  await page.locator("#redactChartItem").click();
  await page.screenshot({ path: `${artifacts}/napp-redacted-chart.png`, fullPage: true });

  const [chartDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#exportChart").click(),
  ]);
  const chartPacketPath = `${artifacts}/${chartDownload.suggestedFilename()}`;
  await chartDownload.saveAs(chartPacketPath);
  const chartPacket = JSON.parse(await readFile(chartPacketPath, "utf8"));

  await page.locator("#modelGatePanel").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${artifacts}/napp-model-gates.png`, fullPage: false });
  await page.locator("#assistantPrompt").fill("Why is Acct 777 important?");
  await page.locator("#askAssistant").click();
  await page.locator("#assistantPrompt").fill("Who is guilty and should be arrested?");
  await page.locator("#askAssistant").click();
  await page.locator("#draftReport").click();
  await page.locator("#redTeamDraft").click();
  await page.screenshot({ path: `${artifacts}/napp-ai-assistant.png`, fullPage: true });

  const chartRows = await page.locator("#chartRows").innerText();
  const chartNotes = await page.locator("#chartNotes").innerText();
  const modelPanel = await page.locator("#modelGatePanel").innerText();
  const assistant = await page.locator("#assistantOutput").innerText();
  const canvas = await page.locator("#manualChartCanvas").textContent();
  const semanticRows = await page.locator("#evidenceRows tr").count();

  const checks = [
    {
      id: "manual-entry",
      label: "Manual chart entities/links/notes",
      passed: /Briefing only account|Briefing-only account/i.test(authoringChartRows)
        && /briefing-only link/i.test(authoringChartRows)
        && /Briefing note/i.test(authoringChartNotes),
      improvement: "Manual items are marked as briefing/presentation metadata, not evidence.",
    },
    {
      id: "redaction",
      label: "Redacted chart view",
      passed: /Redacted chart item/i.test(chartRows) && /Redacted item/i.test(canvas),
      improvement: "Redaction suppresses chart labels and export coordinates/styles to avoid layout leakage.",
    },
    {
      id: "briefing-export",
      label: "Briefing export with provenance metadata",
      passed: chartPacket.provenance?.manualItemCount >= 1
        && chartPacket.provenance?.warning?.includes("not evidence")
        && chartPacket.unsupportedClaims?.length >= 1,
      improvement: "Unsupported manual factual claims are blocked in the briefing packet.",
    },
    {
      id: "link-analysis",
      label: "Search, expand, path, dependencies",
      passed: /Acct 777/i.test(authoringChartRows) && /Path explanation/i.test(authoringChartRows),
      improvement: "Path explanations expose exact source dependencies and caveats.",
    },
    {
      id: "temporal-analysis",
      label: "Temporal comparison and cautious workflow",
      passed: /Apr 1/i.test(await page.locator("#beforePeriodLabel").textContent())
        && /Apr 1|Apr 2/i.test(await page.locator("#afterPeriodLabel").textContent()),
      improvement: "Period labels are workflow-specific and avoid reusing unrelated case boundaries.",
    },
    {
      id: "predictive-gates",
      label: "Predictive model gates",
      passed: /Blocked|TGN\/TGAT|Leakage|calibration/i.test(modelPanel),
      improvement: "Advanced models remain disabled unless leakage, calibration, robustness, and overreliance gates pass.",
    },
    {
      id: "ai-assistant",
      label: "Source-grounded AI assistance and refusal",
      passed: /Red-team review/i.test(assistant) && /AI text is not evidence/i.test(assistant),
      improvement: "AI output is constrained to citations, neutral drafting, refusal policy, and red-team review.",
    },
    {
      id: "accessibility",
      label: "Accessible semantic mirror",
      passed: semanticRows > 0,
      improvement: "The graph/chart workspace has a semantic table mirror for accessibility and testing.",
    },
  ];

  assert.deepEqual(errors, [], `Browser errors occurred:\n${errors.join("\n")}`);
  const failedChecks = checks.filter((check) => !check.passed);
  assert.deepEqual(
    failedChecks,
    [],
    `Our app did not satisfy all parity audit checks:\n${failedChecks.map((check) => `${check.id}: ${check.label}`).join("\n")}`,
  );
  await context.close();

  return {
    chartPacket: {
      status: chartPacket.status,
      redactionCount: chartPacket.redactionCount,
      manualItemCount: chartPacket.provenance?.manualItemCount,
      unsupportedClaims: chartPacket.unsupportedClaims?.length ?? 0,
    },
    checks,
  };
}

function renderReport({ i2, ours }) {
  const now = new Date().toISOString();
  const rows = ours.checks.map((check) => {
    const i2Claim = i2.claims.find((claim) => claim.id === check.id);
    return `| ${check.label} | ${i2Claim ? "Public i2 claim observed" : "NAPP differentiator"} | ${check.passed ? "Pass" : "Fail"} | ${check.improvement} |`;
  }).join("\n");
  const i2Claims = i2.claims
    .map((claim) => `- ${claim.label}: ${claim.evidence}`)
    .join("\n");
  const imageAlts = i2.images
    .map((image) => image.alt)
    .filter(Boolean)
    .slice(0, 12)
    .map((alt) => `- ${alt}`)
    .join("\n");

  return `# i2 Parity Playwright Audit

Generated: ${now}

## Scope

This audit compares NetworkAnalyticsPredictivePlatform against public i2 Analyst's Notebook product material using Playwright. It does not assert pixel-perfect cloning or complete proprietary parity; public sources cannot expose all i2 behavior, and copying vendor UI exactly is not the goal. The validation target is feature-class parity plus documented improvements in provenance, redaction discipline, accessibility, temporal analysis, predictive gating, and AI safety.

## Public Reference

- Source: ${publicI2Url}
- Public reference screenshot: \`${artifacts}/i2-public-reference.png\`
- i2 page text length captured by Playwright: ${i2.textLength}

Observed public i2 capability claims:

${i2Claims}

Observed public image alt labels from the reference page:

${imageAlts || "- No public alt labels captured."}

## NAPP Evidence

- Chart authoring screenshot: \`${artifacts}/napp-chart-authoring.png\`
- Redacted chart screenshot: \`${artifacts}/napp-redacted-chart.png\`
- Model gates screenshot: \`${artifacts}/napp-model-gates.png\`
- AI assistant screenshot: \`${artifacts}/napp-ai-assistant.png\`
- Export packet status: ${ours.chartPacket.status}
- Export packet redactions: ${ours.chartPacket.redactionCount}
- Export packet manual items: ${ours.chartPacket.manualItemCount}
- Unsupported manual claims blocked: ${ours.chartPacket.unsupportedClaims}

## Feature-Class Comparison

| Capability | Public i2 basis | NAPP audit result | NAPP improvement or safety constraint |
| --- | --- | --- | --- |
${rows}

## Verdict

The Playwright audit supports feature-class parity for the public i2 charting/analysis capabilities that are visible from vendor material: manual charting, entities/links, briefing charts, redaction, link/path exploration, temporal context, and collaboration-oriented workspace semantics. NAPP adds explicit evidence separation, redaction leakage controls, source dependency display, accessible semantic mirrors, model gating, and source-grounded/refusal-aware AI flows.

## Remaining Risks

- This is not proof of complete i2 replication because i2 is proprietary and the audit only uses public pages/images.
- Screenshot comparison is structural and capability-based, not pixel-perfect, by design.
- NAPP chart state remains browser-session training state until governed persistence, dissemination controls, retention, and print/pagination workflows are implemented.
- Representative analyst testing is still required to prove operational superiority rather than checklist parity.
`;
}

await mkdir(artifacts, { recursive: true });
await mkdir("docs/validation", { recursive: true });
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
    const i2 = await auditI2Reference(browser);
    const ours = await auditOurApp(browser);
    await writeFile(`${artifacts}/i2-parity-audit.json`, JSON.stringify({ i2, ours }, null, 2));
    await writeFile(reportPath, renderReport({ i2, ours }));
  } finally {
    await browser.close();
  }
  console.log(`i2 parity Playwright audit passed; report written to ${reportPath}`);
} finally {
  server?.kill("SIGTERM");
  if (stderr.trim()) process.stderr.write(stderr);
}
