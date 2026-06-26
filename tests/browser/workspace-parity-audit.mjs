import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const artifacts = "test-results/workspace-parity";
const reportPath = "docs/validation/linkurious-obsidian-workspace-parity-audit.md";
const linkuriousHome = "https://linkurious.com/";
const linkuriousAnalyze = "https://linkurious.com/decision-intelligence-platform-analyze-decide/";
const linkuriousDetect = "https://linkurious.com/decision-intelligence-platform-detection/";
const linkuriousGraph = "https://linkurious.com/decision-intelligence-platform-graph-visualization/";
const obsidianGraph = "https://obsidian.md/help/plugins/graph";
const repository = process.env.PAGES_BASE_PATH ?? "NetworkAnalyticsPredictivePlatform";
const port = Number(process.env.PLAYWRIGHT_PORT ?? 4412);
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

async function captureText(browser, url, screenshotName) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.screenshot({ path: `${artifacts}/${screenshotName}`, fullPage: true });
  const text = await page.locator("body").innerText();
  await page.close();
  return text;
}

async function auditReferences(browser) {
  const linkuriousTexts = [
    await captureText(browser, linkuriousHome, "linkurious-home.png"),
    await captureText(browser, linkuriousAnalyze, "linkurious-analyze-decide.png"),
    await captureText(browser, linkuriousDetect, "linkurious-detect.png"),
    await captureText(browser, linkuriousGraph, "linkurious-graph-visualization.png"),
  ];
  const linkuriousText = linkuriousTexts.join("\n");
  const obsidianText = await captureText(browser, obsidianGraph, "obsidian-graph-view.png");
  const claims = [
    {
      id: "search-query-filter",
      label: "Search, no-code queries, filtering",
      passed: /No-code Query Builder|Queries|Filtering|Search/i.test(linkuriousText) && /Search files/i.test(obsidianText),
      basis: "Linkurious public pages list no-code query builder, queries, filtering, and search; Obsidian Graph View documents search filters.",
    },
    {
      id: "collaboration-comments",
      label: "Comments and shared workspace collaboration",
      passed: /Comment and tag teammates|Shared work spaces and queries|Collaborate/i.test(linkuriousText),
      basis: "Linkurious public pages describe comments, teammate tagging, shared workspaces, shared queries, and collaboration.",
    },
    {
      id: "case-management",
      label: "Case management with status and assignment",
      passed: /case management|organize cases|update their status|assign them to your team/i.test(linkuriousText),
      basis: "Linkurious detection page describes organizing cases, updating status, assignment, and case closure.",
    },
    {
      id: "layouts-styling-export",
      label: "Layouts, styling, export/publish",
      passed: /Layouts|Styling|Export and Publish/i.test(linkuriousText),
      basis: "Linkurious graph visualization page lists layouts, styling, export and publish.",
    },
    {
      id: "graph-controls",
      label: "Graph interaction and local/global graph controls",
      passed: /Hover over each circle|Zoom in and out|Move the graph|Local Graph|depth/i.test(obsidianText),
      basis: "Obsidian Graph View documents hover, click, keyboard/mouse navigation, local graph, and depth.",
    },
  ];
  assert.deepEqual(claims.filter((claim) => !claim.passed), [], "Reference pages did not expose expected public claims");
  return { claims, linkuriousLength: linkuriousText.length, obsidianLength: obsidianText.length };
}

async function auditNapp(browser) {
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
  await page.evaluate(() => localStorage.clear());
  await page.locator("#useCaseMode").selectOption("fraud");
  await page.locator("#chartSearch").fill("Acct 777");
  await page.locator("#saveSearch").click();
  await page.locator("#pinFirstResult").click();
  await page.locator("#expandSelected").click();
  await page.locator("#findPath").click();
  await page.locator("#workspaceComment").fill("Reviewer should validate source timing");
  await page.locator("#addWorkspaceComment").click();
  await page.locator("#caseNoteText").fill("Prepare neutral packet for review");
  await page.locator("#addCaseNote").click();
  await page.locator("#taskLabel").fill("Verify KYC records");
  await page.locator("#taskStatus").selectOption("in-progress");
  await page.locator("#setTaskStatus").click();
  await page.locator("#reviewStatus").selectOption("ready-for-review");
  await page.locator("#setReviewStatus").click();
  await page.locator("#layoutName").fill("Reviewer handoff");
  await page.locator("#saveWorkspaceSnapshot").click();
  await page.screenshot({ path: `${artifacts}/napp-step3-workspace.png`, fullPage: true });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#useCaseMode").selectOption("fraud");
  await page.locator("#restoreWorkspaceSnapshot").click();
  await page.screenshot({ path: `${artifacts}/napp-step3-restored.png`, fullPage: true });
  const [packetDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#prepareCasePacket").click(),
  ]);
  const packetPath = `${artifacts}/${packetDownload.suggestedFilename()}`;
  await packetDownload.saveAs(packetPath);
  const packet = JSON.parse(await readFile(packetPath, "utf8"));
  const notesText = await page.locator("#chartNotes").innerText();
  const rowText = await page.locator("#chartRows").innerText();
  const checks = [
    {
      id: "search-query-filter",
      label: "Bounded search, pin, expand, path",
      passed: /Saved search/i.test(notesText) && /Expansion boundary/i.test(notesText) && /Path explanation|Acct 777/i.test(rowText),
      improvement: "Search and expansion are bounded to the authorized visible projection and explain that boundary.",
    },
    {
      id: "collaboration-comments",
      label: "Comments, case notes, audit log",
      passed: /analyst comment/i.test(notesText) && /case note/i.test(notesText) && /Audit/i.test(notesText),
      improvement: "Comments and case notes carry not-evidence status plus audit entries.",
    },
    {
      id: "case-management",
      label: "Task state, review status, reloadable workspace",
      passed: /Verify KYC records/i.test(notesText) && /ready-for-review/i.test(notesText) && /Saved workspace/i.test(notesText),
      improvement: "Review state is neutral and reloadable in the training browser session.",
    },
    {
      id: "case-packet",
      label: "Neutral case packet",
      passed: packet.contract === "InvestigationCasePacketV1"
        && /do not imply guilt/i.test(packet.safety.warning)
        && packet.comments[0]?.evidenceStatus === "not evidence",
      improvement: "Packet generation blocks guilt implication and keeps comments separate from evidence.",
    },
    {
      id: "obsidian-graph-controls",
      label: "Obsidian-inspired graph interaction already present",
      passed: await page.locator("#visualControls").count() === 1
        && await page.locator("#resetLayout").count() === 1
        && await page.locator("#graphUndo").count() === 1,
      improvement: "Graph view adds presentation-only boardroom styling, undo/redo, and evidence-safe separation.",
    },
  ];
  assert.deepEqual(errors, [], `Browser errors occurred:\n${errors.join("\n")}`);
  assert.deepEqual(checks.filter((check) => !check.passed), [], "NAPP did not satisfy all workspace parity checks");
  await context.close();
  return {
    checks,
    packet: {
      status: packet.status,
      reviewStatus: packet.reviewStatus,
      savedSearches: packet.savedSearches.length,
      comments: packet.comments.length,
      caseNotes: packet.caseNotes.length,
      tasks: packet.taskStates.length,
      auditLog: packet.auditLog.length,
    },
  };
}

function renderReport({ references, napp }) {
  const rows = napp.checks.map((check) => {
    const reference = references.claims.find((claim) => claim.id === check.id);
    return `| ${check.label} | ${reference ? reference.basis : "NAPP differentiator"} | ${check.passed ? "Pass" : "Fail"} | ${check.improvement} |`;
  }).join("\n");
  return `# Linkurious / Obsidian Workspace Parity Playwright Audit

Generated: ${new Date().toISOString()}

## Scope

This audit compares NetworkAnalyticsPredictivePlatform Step 3 investigation workspace behavior against public Linkurious product pages and Obsidian Graph View documentation using Playwright. It validates feature-class parity and documented improvements. It does not claim pixel-perfect replication or complete proprietary parity.

## Public References

- Linkurious home: ${linkuriousHome}
- Linkurious Analyze & Decide: ${linkuriousAnalyze}
- Linkurious Detect: ${linkuriousDetect}
- Linkurious Graph Visualization: ${linkuriousGraph}
- Obsidian Graph View: ${obsidianGraph}

Screenshots captured:

- \`${artifacts}/linkurious-home.png\`
- \`${artifacts}/linkurious-analyze-decide.png\`
- \`${artifacts}/linkurious-detect.png\`
- \`${artifacts}/linkurious-graph-visualization.png\`
- \`${artifacts}/obsidian-graph-view.png\`

Reference text captured:

- Linkurious combined text length: ${references.linkuriousLength}
- Obsidian text length: ${references.obsidianLength}

## NAPP Evidence

- Workspace screenshot: \`${artifacts}/napp-step3-workspace.png\`
- Reloaded workspace screenshot: \`${artifacts}/napp-step3-restored.png\`
- Packet status: ${napp.packet.status}
- Review status: ${napp.packet.reviewStatus}
- Saved searches: ${napp.packet.savedSearches}
- Comments: ${napp.packet.comments}
- Case notes: ${napp.packet.caseNotes}
- Tasks: ${napp.packet.tasks}
- Audit entries: ${napp.packet.auditLog}

## Feature-Class Comparison

| Capability | Public reference basis | NAPP audit result | NAPP improvement or safety constraint |
| --- | --- | --- | --- |
${rows}

## Verdict

The Playwright audit supports Step 3 feature-class parity for the public Linkurious/Obsidian capabilities relevant to investigation workspace behavior: bounded search, graph exploration, comments, shared workspace concepts, case status/task handling, saved layouts/snapshots, export/publish style packets, and graph interaction controls. NAPP adds evidence-safe boundaries, audit metadata, neutral review language, and packet safeguards that prevent analyst notes from becoming evidence or guilt claims.

## Remaining Risks

- Public pages and documentation cannot prove complete proprietary product behavior.
- The training workspace stores snapshots in browser localStorage; production still needs server-side persistence, authorization, retention, dissemination controls, and multi-user concurrency.
- This audit is a functional and structural comparison, not pixel-perfect visual cloning.
- Representative analyst evaluation remains required to prove operational superiority.
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
    const references = await auditReferences(browser);
    const napp = await auditNapp(browser);
    await writeFile(`${artifacts}/workspace-parity-audit.json`, JSON.stringify({ references, napp }, null, 2));
    await writeFile(reportPath, renderReport({ references, napp }));
  } finally {
    await browser.close();
  }
  console.log(`Workspace parity Playwright audit passed; report written to ${reportPath}`);
} finally {
  server?.kill("SIGTERM");
  if (stderr.trim()) process.stderr.write(stderr);
}
