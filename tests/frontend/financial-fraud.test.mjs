import test from "node:test";
import assert from "node:assert/strict";

import {
  CASE,
  DEFAULT_SETTINGS,
  NODES,
  RELATIONSHIPS,
  STEPS,
  TRANSACTIONS,
  deriveAnalysis,
  detectFraudRings,
  reportModel,
  runPreflight,
  visibleRelationships,
} from "../../packages/guided-workflow/financial-fraud.mjs";
import {
  buildPeriodModel,
  graphSummary,
  semanticRows,
} from "../../packages/graph-renderer/graph-model.mjs";

const source = {
  nodes: NODES,
  nodeById: (id) => NODES.find((node) => node.id === id),
  visibleRelationships,
};

test("financial fraud workflow provides a complete seven-step hand-held journey", () => {
  assert.equal(CASE.synthetic, true);
  assert.equal(STEPS.length, 7);
  assert.deepEqual(
    STEPS.map((step) => step.id),
    ["question", "ingest", "detect", "temporal", "community", "model-gates", "report"],
  );
  assert.ok(STEPS.every((step) => step.explanation && step.task));
});

test("transaction fixture contains the required mule-ring detection fields", () => {
  assert.ok(TRANSACTIONS.length >= 8);
  for (const transaction of TRANSACTIONS) {
    assert.ok(transaction.id);
    assert.match(transaction.at, /^2026-04-/);
    assert.ok(transaction.origin);
    assert.ok(transaction.destination);
    assert.equal(typeof transaction.amount, "number");
    assert.ok(transaction.currency);
    assert.ok(transaction.type);
    assert.ok(transaction.description);
  }
});

test("detector ranks possible mule account using transparent behavioral indicators", () => {
  const detection = detectFraudRings(DEFAULT_SETTINGS);
  assert.equal(detection.topAccount.accountId, "a-777");
  assert.equal(detection.topAccount.status, "review-priority");
  assert.ok(detection.topAccount.score >= 85);
  assert.ok(detection.topAccount.indicators.includes("multiple inbound origins"));
  assert.ok(detection.topAccount.indicators.includes("fan-out to multiple destinations"));
  assert.ok(detection.topAccount.indicators.includes("rapid outbound movement"));
  assert.ok(detection.advancedModelRoadmap.some((item) => /Temporal GNN/i.test(item)));
});

test("financial workflow uses review-priority wording instead of proof or confidence claims", () => {
  assert.doesNotMatch(CASE.question, /suspected fraud ring/i);
  const analysis = deriveAnalysis(DEFAULT_SETTINGS);
  assert.match(analysis.interpretation, /uncalibrated rule-count index/i);
  assert.doesNotMatch(analysis.splitConfidence, /confidence/i);
});

test("infrastructure toggle changes the visible graph and confidence context", () => {
  const withInfrastructure = graphSummary(DEFAULT_SETTINGS, source);
  const withoutInfrastructureSettings = {
    ...DEFAULT_SETTINGS,
    includeInfrastructure: false,
    aliasIncluded: false,
  };
  const withoutInfrastructure = graphSummary(withoutInfrastructureSettings, source);
  assert.ok(withInfrastructure.after.edges.length > withoutInfrastructure.after.edges.length);
  assert.equal(deriveAnalysis(DEFAULT_SETTINGS).evidenceCoverage, "83%");
  assert.equal(deriveAnalysis(withoutInfrastructureSettings).evidenceCoverage, "71%");
});

test("financial semantic table mirrors visible transaction graph", () => {
  const graphIds = new Set([
    ...buildPeriodModel("before", DEFAULT_SETTINGS, source).edges.map((edge) => edge.id),
    ...buildPeriodModel("after", DEFAULT_SETTINGS, source).edges.map((edge) => edge.id),
  ]);
  const tableIds = new Set(semanticRows(DEFAULT_SETTINGS, source).map((row) => row.id));
  assert.deepEqual(tableIds, graphIds);
});

test("financial report is neutral, gated, and reconstructable", () => {
  const state = {
    stepIndex: 0,
    selectedId: "tx-004",
    settings: { ...DEFAULT_SETTINGS },
    analysisVersion: 1,
    findingReady: true,
    preflightRun: false,
    journey: {
      evidenceInspected: true,
      reasoningInspected: true,
      alternativeReviewed: true,
      recommendationAcknowledged: true,
    },
  };
  const report = reportModel(state);
  assert.match(report.assessment, /suggested review step/i);
  assert.match(report.assessment, /not a determination/i);
  assert.doesNotMatch(report.assessment, /confidence/i);
  assert.match(report.nextAction, /Acct 777/i);
  assert.match(report.nextAction, /KYC/i);
  assert.match(report.method, /TGNN|gated/i);
  assert.match(report.limitations, /uncalibrated/i);
  assert.ok(report.dependencies.includes("tx-004"));
  assert.equal(runPreflight(state).passed, true);
});

test("financial report preflight fails before the novice journey gates are complete", () => {
  const state = {
    stepIndex: 0,
    selectedId: "tx-004",
    settings: { ...DEFAULT_SETTINGS },
    analysisVersion: 1,
    findingReady: false,
    preflightRun: false,
  };
  const result = runPreflight(state);
  assert.equal(result.passed, false);
  assert.ok(result.checks.some(([label, passed]) => /Recommended next review action/.test(label) && !passed));
});
