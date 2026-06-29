import test from "node:test";
import assert from "node:assert/strict";

import {
  CASE,
  DEFAULT_SETTINGS,
  NODES,
  RELATIONSHIPS,
  STEPS,
  deriveAnalysis,
  reportModel,
  runCommunityBaseline,
  runPreflight,
  visibleRelationships,
} from "../../packages/guided-workflow/dojo-karate-split.mjs";

test("dojo split workflow exposes a complete benchmark-derived journey", () => {
  assert.equal(CASE.benchmarkDerived, true);
  assert.equal(CASE.synthetic, false);
  assert.equal(STEPS.length, 5);
  assert.ok(NODES.length >= 8);
  assert.ok(RELATIONSHIPS.length >= 10);
  assert.ok(STEPS.every((step) => step.explanation && step.task));
});

test("dojo local community model is deterministic and preserves uncertainty", () => {
  const first = runCommunityBaseline(DEFAULT_SETTINGS);
  const second = runCommunityBaseline(DEFAULT_SETTINGS);
  assert.deepEqual(first.labels, second.labels);
  assert.ok(first.evaluation.agreement >= 0.8);
  assert.deepEqual(first.evaluation.uncertainNodes, ["dojo-4", "dojo-5"]);
  assert.equal(first.evaluation.calibrated, false);
});

test("bridge toggle changes visible benchmark evidence and interpretation remains cautious", () => {
  const withBridge = visibleRelationships(DEFAULT_SETTINGS);
  const withoutBridge = visibleRelationships({ ...DEFAULT_SETTINGS, aliasIncluded: false });
  assert.ok(withBridge.length > withoutBridge.length);
  const analysis = deriveAnalysis(DEFAULT_SETTINGS);
  assert.match(analysis.interpretation, /deterministic local community model/i);
  assert.match(analysis.alternative, /Bridge attendance/i);
});

test("dojo report is gated and avoids criminal proof language", () => {
  const state = {
    selectedId: "dk-010",
    settings: { ...DEFAULT_SETTINGS },
    findingReady: true,
    journey: {
      evidenceInspected: true,
      reasoningInspected: true,
      alternativeReviewed: true,
      recommendationAcknowledged: true,
    },
  };
  const report = reportModel(state);
  assert.match(report.method, /Deterministic label propagation/i);
  assert.match(report.limitations, /bridge members remain uncertain/i);
  assert.doesNotMatch(report.assessment, /proved|criminal gang proof|ground truth organization/i);
  assert.equal(runPreflight(state).passed, true);
});
