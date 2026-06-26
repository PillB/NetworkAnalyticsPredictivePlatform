import test from "node:test";
import assert from "node:assert/strict";

import {
  FIXTURE_SCHEMA,
  FIXTURE_VERSION,
  DEFAULT_SETTINGS,
  STEPS,
  createInitialState,
  deriveAnalysis,
  reportModel,
  resetAnalysis,
  runPreflight,
  updateSetting,
  visibleRelationships,
  configureWorkbenchBootstrap,
} from "../../packages/guided-workflow/harbor-lantern.mjs";
import { staticWorkbenchBootstrap } from "../../packages/api-client/workbench-client.mjs";

test("frontend consumes the versioned canonical interchange", () => {
  assert.equal(FIXTURE_SCHEMA, "HarborLanternInterchangeV1");
  assert.equal(FIXTURE_VERSION, "1.0.0");
});

test("workflow accepts the versioned service bootstrap contract", () => {
  const bootstrap = staticWorkbenchBootstrap();
  configureWorkbenchBootstrap(bootstrap);
  assert.equal(STEPS.length, bootstrap.guided_steps.length);
  assert.equal(visibleRelationships(DEFAULT_SETTINGS).length, bootstrap.relationships.length);
});
import {
  buildPeriodModel,
  graphSummary,
  semanticRows,
} from "../../packages/graph-renderer/graph-model.mjs";

test("guided flow provides one complete seven-step analysis", () => {
  assert.equal(STEPS.length, 7);
  assert.deepEqual(
    STEPS.map((step) => step.id),
    ["question", "evidence", "compare", "community", "alternatives", "finding", "report"],
  );
  assert.ok(STEPS.every((step) => step.explanation && step.task));
});

test("default comparison uses stable node coordinates across periods", () => {
  const before = buildPeriodModel("before", DEFAULT_SETTINGS);
  const after = buildPeriodModel("after", DEFAULT_SETTINGS);
  const commonIds = before.nodes
    .map((node) => node.id)
    .filter((id) => after.nodes.some((node) => node.id === id));

  assert.ok(commonIds.length > 0);
  commonIds.forEach((id) => {
    const a = before.nodes.find((node) => node.id === id);
    const b = after.nodes.find((node) => node.id === id);
    assert.deepEqual([a.x, a.y], [b.x, b.y]);
  });
});

test("change summary distinguishes appeared from no-longer-observed", () => {
  const summary = graphSummary(DEFAULT_SETTINGS);
  assert.deepEqual(summary.appeared.map((edge) => edge.id).sort(), ["r3", "r6"]);
  assert.deepEqual(summary.noLongerObserved.map((edge) => edge.id), ["r4"]);
  assert.ok(summary.persistent.length >= 2);
});

test("semantic table mirrors every visible graph relationship", () => {
  const graphIds = new Set([
    ...buildPeriodModel("before", DEFAULT_SETTINGS).edges.map((edge) => edge.id),
    ...buildPeriodModel("after", DEFAULT_SETTINGS).edges.map((edge) => edge.id),
  ]);
  const tableIds = new Set(semanticRows(DEFAULT_SETTINGS).map((row) => row.id));
  assert.deepEqual(tableIds, graphIds);
});

test("visual changes do not create analysis versions", () => {
  const state = createInitialState();
  const spaced = updateSetting(state, "spacing", 1.25);
  const relabeled = updateSetting(spaced, "labelDensity", "minimal");
  const contrasted = updateSetting(relabeled, "highContrast", true);
  assert.equal(contrasted.analysisVersion, 1);
});

test("analytical alternatives create versions and change interpretation", () => {
  const state = createInitialState();
  const changed = updateSetting(state, "aliasIncluded", false);
  assert.equal(changed.analysisVersion, 2);
  assert.equal(deriveAnalysis(changed.settings).splitConfidence, "low");
  assert.equal(deriveAnalysis(changed.settings).communities, 1);
  assert.ok(visibleRelationships(changed.settings).every((item) => !["r1", "r5", "r6"].includes(item.id)));
});

test("reset restores analytical defaults and preserves visual choices", () => {
  let state = createInitialState();
  state = updateSetting(state, "aliasIncluded", false);
  state = updateSetting(state, "windowDays", 14);
  state = updateSetting(state, "spacing", 1.3);
  const reset = resetAnalysis(state);

  assert.equal(reset.settings.aliasIncluded, true);
  assert.equal(reset.settings.windowDays, 30);
  assert.equal(reset.settings.spacing, 1.3);
  assert.equal(reset.analysisVersion, 4);
});

test("report includes temporal cutoffs, contrary evidence, and exact dependencies", () => {
  const report = reportModel(createInitialState());
  assert.match(report.before, /January 18/);
  assert.match(report.after, /March 18/);
  assert.match(report.knownAt, /23:59/);
  assert.equal(report.fixture, "HarborLanternInterchangeV1@1.0.0");
  assert.match(report.contraryEvidence, /alias/i);
  assert.equal(report.dependencies.length, visibleRelationships(DEFAULT_SETTINGS).length);
});

test("default report passes reconstructability preflight", () => {
  const result = runPreflight(createInitialState());
  assert.equal(result.passed, true);
  assert.equal(result.checks.length, 7);
  assert.ok(result.checks.every(([, passed]) => passed));
});
