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
  assert.match(html, /They do not create evidence/i);
});

test("i2-class chart workspace controls are present", async () => {
  const html = await readFile(`${repoRoot}apps/web/index.html`, "utf8");
  assert.match(html, /id="chartSearch"/);
  assert.match(html, /id="expandSelected"/);
  assert.match(html, /id="findPath"/);
  assert.match(html, /id="addAnnotation"/);
  assert.match(html, /id="saveLayout"/);
  assert.match(html, /id="restoreLayout"/);
  assert.match(html, /id="manualEntityLabel"/);
  assert.match(html, /id="manualEntityStyle"/);
  assert.match(html, /id="moveManualEntity"/);
  assert.match(html, /id="manualChartCanvas"/);
  assert.match(html, /id="addManualEntity"/);
  assert.match(html, /id="addManualEdge"/);
  assert.match(html, /id="redactChartItem"/);
  assert.match(html, /id="exportChart"/);
  assert.match(html, /id="nodeVisualTarget"/);
  assert.match(html, /id="nodeIconPreset"/);
  assert.match(html, /id="nodeImageUpload"/);
  assert.match(html, /id="resetNodeVisual"/);
});

test("Linkurious-style investigation workspace controls are present", async () => {
  const html = await readFile(`${repoRoot}apps/web/index.html`, "utf8");
  assert.match(html, /id="saveSearch"/);
  assert.match(html, /id="workspaceComment"/);
  assert.match(html, /id="addWorkspaceComment"/);
  assert.match(html, /id="caseNoteText"/);
  assert.match(html, /id="addCaseNote"/);
  assert.match(html, /id="taskLabel"/);
  assert.match(html, /id="taskStatus"/);
  assert.match(html, /id="setTaskStatus"/);
  assert.match(html, /id="reviewStatus"/);
  assert.match(html, /id="setReviewStatus"/);
  assert.match(html, /id="saveWorkspaceSnapshot"/);
  assert.match(html, /id="restoreWorkspaceSnapshot"/);
  assert.match(html, /id="prepareCasePacket"/);
});

test("Neo4j Bloom-style graph exploration controls are present", async () => {
  const html = await readFile(`${repoRoot}apps/web/index.html`, "utf8");
  const app = await readFile(`${repoRoot}apps/web/app.mjs`, "utf8");
  const css = await readFile(`${repoRoot}apps/web/styles.css`, "utf8");
  assert.match(html, /id="bloomPhrase"/);
  assert.match(html, /id="runBloomPhrase"/);
  assert.match(html, /id="scenePreset"/);
  assert.match(html, /id="applyScenePreset"/);
  assert.match(html, /id="resetScenePreset"/);
  assert.match(html, /id="bloomExplanation"/);
  assert.match(app, /executeGraphPhrase/);
  assert.match(app, /applyScenePreset/);
  assert.match(css, /bloom-tools/);
});

test("financial transaction import controls are present", async () => {
  const html = await readFile(`${repoRoot}apps/web/index.html`, "utf8");
  assert.match(html, /id="transactionCsv"/);
  assert.match(html, /id="transactionFormat"/);
  assert.match(html, /id="loadSampleJson"/);
  assert.match(html, /id="mappingControls"/);
  assert.match(html, /id="previewImport"/);
  assert.match(html, /id="applyImport"/);
  assert.match(html, /rejected-row reporting|rejected rows|Training import/i);
});

test("boardroom graph style and AI decision-support panels are present", async () => {
  const html = await readFile(`${repoRoot}apps/web/index.html`, "utf8");
  const app = await readFile(`${repoRoot}apps/web/app.mjs`, "utf8");
  const css = await readFile(`${repoRoot}apps/web/styles.css`, "utf8");
  assert.match(html, /id="visualStyle"/);
  assert.match(html, /Boardroom/);
  assert.match(html, /id="modelGatePanel"/);
  assert.match(html, /id="assistantPrompt"/);
  assert.match(html, /id="askAssistant"/);
  assert.match(html, /id="draftReport"/);
  assert.match(html, /id="redTeamDraft"/);
  assert.match(app, /evaluatePredictiveModelCandidates/);
  assert.match(app, /answerGraphQuestion/);
  assert.match(css, /graph-style-boardroom/);
});
