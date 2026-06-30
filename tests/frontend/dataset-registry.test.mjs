import test from "node:test";
import assert from "node:assert/strict";

import {
  DATASET_INTEGRATION_STEPS,
  datasetCoverageSummary,
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

test("dataset registry covers graph, fraud, temporal, and criminology adapter families", () => {
  const datasets = listDatasets();
  const ids = new Set(datasets.map((dataset) => dataset.id));
  for (const required of [
    "tgb-adapter-catalog",
    "elliptic-aml-adapter",
    "ibm-amlsim-generator",
    "paysim-mobile-money-adapter",
    "ieee-cis-fraud-adapter",
    "dgraph-fin-adapter",
    "gadbench-adapter",
    "orbitaal-aml-adapter",
    "snap-temporal-communication-adapter",
    "sociopatterns-contact-adapter",
    "networkrepository-crime-adapter",
    "ucinet-crime-network-adapter",
    "synthetic-criminal-network-generator",
  ]) {
    assert.ok(ids.has(required), `${required} should be cataloged`);
  }
  const summary = datasetCoverageSummary();
  assert.equal(summary.embedded, 3);
  assert.ok(summary.externalAdapters >= 10);
  assert.ok(DATASET_INTEGRATION_STEPS.length >= 5);
  assert.match(getDataset("networkrepository-crime-adapter").dataBoundary, /Do not embed/i);
});
