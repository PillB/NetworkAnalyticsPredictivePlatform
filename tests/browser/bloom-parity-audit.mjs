import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const artifacts = "test-results/bloom-parity";
const reportPath = "docs/validation/neo4j-bloom-parity-audit.md";
const bloomHome = "https://neo4j.com/docs/bloom-user-guide/current/";
const bloomSearchBar = "https://neo4j.com/docs/bloom-user-guide/current/bloom-visual-tour/search-bar/";
const bloomLegend = "https://neo4j.com/docs/bloom-user-guide/current/bloom-visual-tour/legend-panel/";
const bloomPattern = "https://neo4j.com/docs/bloom-user-guide/current/bloom-tutorial/graph-pattern-search/";
const stormPaper = "https://arxiv.org/abs/2402.14207";
const repository = process.env.PAGES_BASE_PATH ?? "NetworkAnalyticsPredictivePlatform";
const port = Number(process.env.PLAYWRIGHT_PORT ?? 4415);
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
      // Preview server may still be starting.
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
  const texts = {
    home: await captureText(browser, bloomHome, "neo4j-bloom-home.png"),
    search: await captureText(browser, bloomSearchBar, "neo4j-bloom-search-bar.png"),
    legend: await captureText(browser, bloomLegend, "neo4j-bloom-legend-panel.png"),
    pattern: await captureText(browser, bloomPattern, "neo4j-bloom-graph-pattern-search.png"),
    storm: await captureText(browser, stormPaper, "stanford-storm-paper.png"),
  };
  const claims = [
    {
      id: "search-first",
      label: "Search-first graph exploration",
      passed: /search bar|Search phrase|Search phrases|full.?text search|actions/i.test(texts.search),
      basis: "Neo4j Bloom search bar documentation describes search phrases, full-text search, graph patterns, and actions.",
    },
    {
      id: "natural-graph-pattern",
      label: "Near-natural graph pattern query",
      passed: /Graph pattern|natural language|near natural language|suggestions|Perspective/i.test(texts.pattern),
      basis: "Neo4j Bloom graph pattern search documents near-natural language graph pattern input using perspective vocabulary.",
    },
    {
      id: "rule-style-legend",
      label: "Legend, styling, and rule-based visual cues",
      passed: /Legend|style|Style|rule|data.?driven|category|filter/i.test(texts.legend),
      basis: "Neo4j Bloom legend panel documentation describes categories, styles, filtering/search, and data-driven rules.",
    },
    {
      id: "scenes-perspectives",
      label: "Scenes and perspective-oriented exploration",
      passed: /Scene|Perspective|Explore|visualization|graph/i.test(`${texts.home}\n${texts.search}`),
      basis: "Neo4j Bloom documentation frames exploration around graph visualization, scenes, and perspectives.",
    },
    {
      id: "storm-method",
      label: "STORM-style multi-perspective synthesis",
      passed: /Synthesis of Topic Outlines|multi-perspective|Question Asking|outline/i.test(texts.storm),
      basis: "The Stanford OVAL STORM paper describes retrieval plus multi-perspective question asking to synthesize grounded outlines.",
    },
  ];
  assert.deepEqual(claims.filter((claim) => !claim.passed), [], "Reference pages did not expose expected public claims");
  return {
    claims,
    lengths: Object.fromEntries(Object.entries(texts).map(([key, text]) => [key, text.length])),
  };
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
  await page.locator("#bloomPhrase").fill("show accounts connected to Acct 777");
  await page.locator("#runBloomPhrase").click();
  await page.screenshot({ path: `${artifacts}/napp-bloom-phrase.png`, fullPage: true });
  await page.locator("#scenePreset").selectOption("financial-flow");
  await page.locator("#applyScenePreset").click();
  await page.locator("#bloomPhrase").fill("paths between Acct 100 and Acct 777");
  await page.locator("#runBloomPhrase").click();
  await page.screenshot({ path: `${artifacts}/napp-bloom-scene-path.png`, fullPage: true });
  const explanation = await page.locator("#bloomExplanation").innerText();
  const rows = await page.locator("#chartRows").innerText();
  const checks = [
    {
      id: "search-first",
      label: "Graph phrase search",
      passed: /Path between Acct 100 and Acct 777|Acct 777/i.test(explanation) && /Graph phrase executed/i.test(await page.locator("#statusMessage").textContent()),
      improvement: "Phrases execute against the current authorized visible projection and refuse unsupported patterns.",
    },
    {
      id: "natural-graph-pattern",
      label: "Supported analyst phrases",
      passed: /tx-004/i.test(explanation) && /Path explanation/i.test(rows),
      improvement: "Path results include exact synthetic transaction dependencies rather than uncited graph hints.",
    },
    {
      id: "rule-style-legend",
      label: "Rule styling and legend",
      passed: /ledger-backed|Derived result|Cutoff/i.test(explanation) && await page.locator("svg.graph-style-boardroom").count() >= 1,
      improvement: "Financial preset applies restrained boardroom styling with evidence-class rule explanations.",
    },
    {
      id: "scenes-perspectives",
      label: "Scene preset and reset",
      passed: await page.locator("#scenePreset").count() === 1 && await page.locator("#resetScenePreset").count() === 1,
      improvement: "Scene presets are validated by workflow and infrastructure visibility before application.",
    },
    {
      id: "storm-method",
      label: "Grounded synthesis discipline",
      passed: /Evidence dependencies and cutoff|Rule styling and visible rows/i.test(explanation),
      improvement: "The UI exposes source dependencies, cutoff, visual rule rationale, and visible rows in one synthesized panel.",
    },
  ];
  await page.locator("#resetScenePreset").click();
  assert.match(await page.locator("#statusMessage").textContent(), /Scene preset reset/i);
  assert.deepEqual(errors, [], `Browser errors occurred:\n${errors.join("\n")}`);
  assert.deepEqual(checks.filter((check) => !check.passed), [], "NAPP did not satisfy all Bloom exploration checks");
  await context.close();
  return { checks, explanationLength: explanation.length, rowLength: rows.length };
}

function renderReport({ references, napp }) {
  const rows = napp.checks.map((check) => {
    const reference = references.claims.find((claim) => claim.id === check.id);
    return `| ${check.label} | ${reference ? reference.basis : "NAPP differentiator"} | ${check.passed ? "Pass" : "Fail"} | ${check.improvement} |`;
  }).join("\n");
  return `# Neo4j Bloom Graph Exploration Playwright Audit

Generated: ${new Date().toISOString()}

## Scope

This audit compares NetworkAnalyticsPredictivePlatform Step 5 graph exploration behavior against public Neo4j Bloom documentation using Playwright. It validates feature-class parity and documented improvements. It does not claim pixel-perfect replication or complete proprietary parity.

The implementation review used a STORM-inspired method: retrieve public references, inspect multiple perspectives (search, graph patterns, scenes/perspectives, legend/rules, analyst safety), synthesize an implementation outline, then verify the product behavior with browser evidence.

## Public References

- Neo4j Bloom user guide: ${bloomHome}
- Neo4j Bloom search bar: ${bloomSearchBar}
- Neo4j Bloom graph pattern search: ${bloomPattern}
- Neo4j Bloom legend panel: ${bloomLegend}
- Stanford STORM paper: ${stormPaper}

Screenshots captured:

- \`${artifacts}/neo4j-bloom-home.png\`
- \`${artifacts}/neo4j-bloom-search-bar.png\`
- \`${artifacts}/neo4j-bloom-graph-pattern-search.png\`
- \`${artifacts}/neo4j-bloom-legend-panel.png\`
- \`${artifacts}/stanford-storm-paper.png\`

Reference text lengths:

- Bloom home: ${references.lengths.home}
- Bloom search bar: ${references.lengths.search}
- Bloom graph pattern search: ${references.lengths.pattern}
- Bloom legend panel: ${references.lengths.legend}
- STORM paper: ${references.lengths.storm}

## NAPP Evidence

- Phrase search screenshot: \`${artifacts}/napp-bloom-phrase.png\`
- Scene/path screenshot: \`${artifacts}/napp-bloom-scene-path.png\`
- Explanation text length: ${napp.explanationLength}
- Chart row text length: ${napp.rowLength}

## Feature-Class Comparison

| Capability | Public reference basis | NAPP audit result | NAPP improvement or safety constraint |
| --- | --- | --- | --- |
${rows}

## Verdict

The Playwright audit supports Step 5 feature-class parity for public Neo4j Bloom-style graph exploration concepts relevant to this training application: search-first graph phrases, near-natural graph pattern behavior, scene/perspective-style presets, legend/rule styling, and plain-language graph explanations. NAPP adds evidence-safe controls: authorized-projection execution, exact source dependencies, known-at cutoffs, preset validation, and neutral decision-support language.

## Remaining Risks

- Public documentation cannot prove complete proprietary Neo4j Bloom behavior.
- This is a functional comparison, not visual cloning.
- Phrase support is intentionally narrow and deterministic; unsupported requests are refused instead of guessed.
- Scene presets are training UI state. Production needs server-side authorization-aware saved perspectives, audit, retention, and multi-user persistence.
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
    await writeFile(`${artifacts}/bloom-parity-audit.json`, JSON.stringify({ references, napp }, null, 2));
    await writeFile(reportPath, renderReport({ references, napp }));
  } finally {
    await browser.close();
  }
  console.log(`Bloom parity Playwright audit passed; report written to ${reportPath}`);
} finally {
  server?.kill("SIGTERM");
  if (stderr.trim()) process.stderr.write(stderr);
}
