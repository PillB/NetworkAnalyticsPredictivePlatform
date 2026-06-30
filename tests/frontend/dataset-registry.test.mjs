import test from "node:test";
import assert from "node:assert/strict";

import {
  DATASET_INTEGRATION_STEPS,
  datasetCoverageSummary,
  datasetDataUseStatus,
  datasetUseCaseResults,
  embeddedWorkflowId,
  getDataset,
  listDatasets,
  recommendedUseCaseForDataset,
  safeDemoSliceForDataset,
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

test("external datasets are mapped to use cases and safe runnable demo routes", () => {
  assert.equal(recommendedUseCaseForDataset("dgraph-fin-adapter"), "fraud");
  assert.equal(recommendedUseCaseForDataset("sociopatterns-contact-adapter"), "dojo");
  assert.equal(recommendedUseCaseForDataset("tgb-adapter-catalog"), "harbor");
  assert.equal(recommendedUseCaseForDataset("synthetic-criminal-network-generator"), "dojo");
  const dgraphRows = datasetUseCaseResults("dgraph-fin-adapter");
  assert.ok(dgraphRows.some((row) => row.useCase === "fraud" && /local ML|anomaly/i.test(`${row.result} ${row.aiMl}`)));
  assert.ok(dgraphRows.some((row) => row.useCase === "harbor" && row.status === "requires-adapter-mapping"));
  const harborRows = datasetUseCaseResults("harbor-lantern-v1");
  assert.ok(harborRows.some((row) => row.useCase === "harbor" && row.status === "runs-now"));
  assert.ok(harborRows.every((row) => row.status !== "matched-adapter-demo"));
  const demo = safeDemoSliceForDataset("dgraph-fin-adapter");
  assert.equal(demo.kind, "transaction-import");
  assert.equal(demo.format, "csv");
  assert.match(demo.caveat, /not a row sample/i);
  assert.match(demo.content, /expected_review_priority/);
  const contactDemo = safeDemoSliceForDataset("sociopatterns-contact-adapter");
  assert.equal(contactDemo.kind, "matched-flow");
  assert.equal(contactDemo.workflow, "dojo");
  assert.equal(contactDemo.nodes, 34);
  const temporalDemo = safeDemoSliceForDataset("tgb-adapter-catalog");
  assert.equal(temporalDemo.kind, "matched-flow");
  assert.equal(temporalDemo.workflow, "harbor");
});

test("every dataset has an explicit full-data status and every external dataset has a runnable demo route", () => {
  for (const dataset of listDatasets()) {
    const dataUse = datasetDataUseStatus(dataset.id);
    assert.ok(dataUse.label.includes(dataset.availability === "embedded" ? "Full-data mode" : dataset.name));
    if (dataset.availability === "embedded") {
      assert.equal(dataUse.status, "all-embedded-data");
      assert.equal(dataUse.canUseAllRowsInBrowser, true);
      assert.equal(safeDemoSliceForDataset(dataset.id), null);
    } else {
      assert.equal(dataUse.status, "external-adapter-required");
      assert.equal(dataUse.canUseAllRowsInBrowser, false);
      const demo = safeDemoSliceForDataset(dataset.id);
      assert.ok(demo, `${dataset.id} should have a runnable safe demo route`);
      assert.match(demo.caveat, /not a row sample|closest embedded workflow/i);
      assert.ok(datasetUseCaseResults(dataset.id).some((row) => /matched-safe-demo-(slice|flow)/.test(row.status)));
    }
  }
});
