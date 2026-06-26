import test from "node:test";
import assert from "node:assert/strict";

import {
  applyScenePreset,
  executeGraphPhrase,
  graphRuleLegend,
  parseGraphPhrase,
  validateScenePreset,
} from "../../packages/graph-renderer/bloom-exploration.mjs";
import {
  DEFAULT_SETTINGS as FRAUD_SETTINGS,
  NODES as FRAUD_NODES,
  nodeById as fraudNodeById,
  visibleRelationships as fraudVisibleRelationships,
} from "../../packages/guided-workflow/financial-fraud.mjs";
import {
  DEFAULT_SETTINGS as HARBOR_SETTINGS,
  NODES as HARBOR_NODES,
  nodeById as harborNodeById,
  visibleRelationships as harborVisibleRelationships,
} from "../../packages/guided-workflow/harbor-lantern.mjs";
import { createChartWorkspace } from "../../packages/graph-renderer/chart-workspace.mjs";

const fraudSource = {
  nodes: FRAUD_NODES,
  nodeById: fraudNodeById,
  visibleRelationships: fraudVisibleRelationships,
};
const harborSource = {
  nodes: HARBOR_NODES,
  nodeById: harborNodeById,
  visibleRelationships: harborVisibleRelationships,
};

test("Bloom phrase parser maps connected-node phrases to deterministic operations", () => {
  const parsed = parseGraphPhrase("show accounts connected to Acct 777", fraudSource);

  assert.equal(parsed.supported, true);
  assert.equal(parsed.operation, "connected-by-type");
  assert.equal(parsed.nodeType, "account");
  assert.equal(parsed.targetId, "a-777");
  assert.match(parsed.label, /Acct 777/);
});

test("Bloom phrase parser maps path phrases to visible endpoints", () => {
  const parsed = parseGraphPhrase("paths between Acct 100 and Acct 901", fraudSource);

  assert.equal(parsed.supported, true);
  assert.equal(parsed.operation, "path-between");
  assert.equal(parsed.startId, "a-100");
  assert.equal(parsed.endId, "a-901");
});

test("unsupported Bloom phrase refuses instead of guessing", () => {
  const parsed = parseGraphPhrase("arrest everyone connected to acct 777", fraudSource);

  assert.equal(parsed.supported, false);
  assert.match(parsed.reason, /Supported examples/i);
});

test("scene preset validation rejects unsafe or inaccessible presets", () => {
  assert.equal(validateScenePreset("financial-flow", { useCase: "harbor" }).valid, false);
  assert.equal(validateScenePreset("infrastructure-review", { useCase: "fraud", canSeeInfrastructure: false }).valid, false);

  const applied = applyScenePreset("financial-flow", { useCase: "fraud", canSeeInfrastructure: true });
  assert.equal(applied.valid, true);
  assert.equal(applied.settings.relationFilter, "transfers");
  assert.equal(applied.settings.visualStyle, "boardroom");
});

test("path phrase execution returns evidence dependencies and cutoff-ready explanation", () => {
  const result = executeGraphPhrase(
    createChartWorkspace(),
    "paths between Acct 100 and Acct 901",
    fraudSource,
    FRAUD_SETTINGS,
  );

  assert.equal(result.ok, true);
  assert.ok(result.workspace.pathNodeIds.includes("a-100"));
  assert.ok(result.workspace.pathNodeIds.includes("a-901"));
  assert.ok(result.dependencies.length >= 2);
  assert.ok(result.dependencies.every((dependency) => dependency.source && dependency.knownAt && dependency.eventTime));
  assert.match(result.explanation, /known-at cutoff/i);
});

test("community phrase explains review hypothesis and uses authorized visible relationships", () => {
  const result = executeGraphPhrase(
    createChartWorkspace(),
    "show community mule bridge",
    fraudSource,
    FRAUD_SETTINGS,
  );

  assert.equal(result.ok, true);
  assert.ok(result.dependencies.length >= 1);
  assert.match(result.explanation, /review hypothesis, not a determination/i);
});

test("rule legends cover evidence class, entity type, community uncertainty, and time window", () => {
  assert.match(graphRuleLegend("evidence-class").join(" "), /ledger-backed/i);
  assert.match(graphRuleLegend("entity-type").join(" "), /Accounts, devices, places/i);
  assert.match(graphRuleLegend("community-uncertainty").join(" "), /hypotheses/i);
  assert.match(graphRuleLegend("time-window").join(" "), /known-at cutoffs/i);
});

test("harbor scene preset remains bounded to the visible projection", () => {
  const result = executeGraphPhrase(
    createChartWorkspace(),
    "paths between Northstar Imports and Halcyon Freight",
    harborSource,
    HARBOR_SETTINGS,
  );

  assert.equal(result.ok, true);
  assert.ok(result.dependencies.every((dependency) => dependency.source && dependency.knownAt));
});
