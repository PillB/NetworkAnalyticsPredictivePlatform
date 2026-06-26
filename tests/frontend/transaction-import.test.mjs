import test from "node:test";
import assert from "node:assert/strict";

import {
  SAMPLE_TRANSACTION_CSV,
  createImportedFraudWorkflow,
  parseCsv,
  previewTransactionImport,
} from "../../packages/guided-workflow/transaction-import.mjs";

test("CSV parser handles headers and rows", () => {
  const parsed = parseCsv(SAMPLE_TRANSACTION_CSV);
  assert.ok(parsed.headers.includes("transaction_id"));
  assert.ok(parsed.rows.length >= 8);
});

test("transaction import maps required columns and rejects invalid rows", () => {
  const preview = previewTransactionImport(SAMPLE_TRANSACTION_CSV, { fileName: "sample.csv" });
  assert.equal(preview.contract, "TransactionImportV1");
  assert.equal(preview.fileName, "sample.csv");
  assert.equal(preview.mappedColumns.at, "timestamp");
  assert.equal(preview.mappedColumns.origin, "origin_id");
  assert.equal(preview.summary.accepted, 8);
  assert.equal(preview.summary.rejected, 1);
  assert.match(preview.rejectedRows[0].reasons.join(" "), /Invalid timestamp/);
});

test("imported workflow exposes graph, detection, report, and preflight contracts", () => {
  const preview = previewTransactionImport(SAMPLE_TRANSACTION_CSV);
  const workflow = createImportedFraudWorkflow(preview);
  assert.equal(workflow.imported, true);
  assert.ok(workflow.nodes.some((node) => node.id === "acct-777"));
  assert.ok(workflow.relationships.some((relationship) => relationship.id === "imp-004"));
  const detection = workflow.detectFraudRings();
  assert.equal(detection.topAccount.accountId, "acct-777");
  assert.ok(detection.topAccount.indicators.includes("multiple inbound origins"));
  assert.ok(detection.topAccount.dependencies.includes("imp-004"));
  const state = {
    stepIndex: 0,
    selectedId: "imp-004",
    settings: { ...workflow.defaults },
    analysisVersion: 1,
    findingReady: true,
    preflightRun: false,
  };
  assert.match(workflow.reportModel(state).scope, /accepted/);
  assert.equal(workflow.runPreflight(state).passed, true);
});
