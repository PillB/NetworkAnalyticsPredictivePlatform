import test from "node:test";
import assert from "node:assert/strict";

import {
  embeddedWorkflowId,
  getDataset,
  listDatasets,
} from "../../packages/guided-workflow/dataset-registry.mjs";

test("dataset registry separates embedded fixtures from external benchmark adapters", () => {
  const datasets = listDatasets();
  assert.ok(datasets.some((dataset) => dataset.id === "dojo-karate-split-v1"));
  assert.ok(datasets.some((dataset) => dataset.availability === "external-adapter"));
  for (const dataset of datasets) {
    assert.equal(typeof dataset.synthetic, "boolean");
    assert.equal(typeof dataset.benchmarkDerived, "boolean");
    assert.ok(dataset.sourceNote);
    assert.ok(dataset.licenseNote);
    assert.ok(dataset.prohibitedClaims.length > 0);
  }
  assert.equal(embeddedWorkflowId("dojo-karate-split-v1"), "dojo");
  assert.equal(embeddedWorkflowId("tgb-adapter-catalog"), null);
  assert.match(getDataset("elliptic-aml-adapter").licenseNote, /review/i);
});
