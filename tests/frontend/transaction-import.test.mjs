import test from "node:test";
import assert from "node:assert/strict";

import {
  LEGITIMATE_PROCESSOR_BENCHMARK_JSON,
  SAMPLE_TRANSACTION_CSV,
  SAMPLE_TRANSACTION_JSON,
  createImportedFraudWorkflow,
  parseCsv,
  parseJson,
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
  assert.match(preview.rejectedRows[0].reasons.join(" "), /Invalid timestamp|timezone/);
  assert.equal(preview.provenance.mappingMode, "inferred");
});

test("JSON import supports explicit field mapping and shared validation", () => {
  const parsed = parseJson(SAMPLE_TRANSACTION_JSON);
  assert.ok(parsed.headers.includes("transaction_id"));
  assert.equal(parsed.rows.length, 4);
  const preview = previewTransactionImport(SAMPLE_TRANSACTION_JSON, {
    format: "json",
    fileName: "sample.json",
    mapping: {
      id: "transaction_id",
      at: "timestamp",
      origin: "origin_id",
      destination: "destination_id",
      amount: "amount",
      currency: "currency",
      type: "type",
    },
  });
  assert.equal(preview.format, "json");
  assert.equal(preview.summary.accepted, 3);
  assert.equal(preview.summary.rejected, 1);
  assert.match(preview.rejectedRows[0].reasons.join(" "), /timezone/);
  assert.match(preview.rejectedRows[0].reasons.join(" "), /Unsupported currency: DOGE/);
  assert.equal(preview.provenance.mappingMode, "explicit-with-inference-fallback");
});

test("timestamps without explicit timezone and unsupported currencies are rejected", () => {
  const preview = previewTransactionImport(
    "transaction_id,timestamp,origin_id,destination_id,amount,currency,type\nbad-1,2026-05-01T10:00:00,a,b,12,BTC,transfer",
  );
  assert.equal(preview.summary.accepted, 0);
  assert.match(preview.rejectedRows[0].reasons.join(" "), /timezone/);
  assert.match(preview.rejectedRows[0].reasons.join(" "), /Unsupported currency: BTC/);
});

test("legitimate processor benchmark stays out of review-priority status", () => {
  const preview = previewTransactionImport(LEGITIMATE_PROCESSOR_BENCHMARK_JSON, {
    format: "json",
    fileName: "legitimate-processor.json",
  });
  assert.equal(preview.summary.accepted, 5);
  const workflow = createImportedFraudWorkflow(preview);
  const detection = workflow.detectFraudRings();
  assert.notEqual(detection.topAccount.status, "review-priority");
  assert.ok(detection.scores.some((score) => score.contraryEvidence.includes("payroll or salary hub pattern")));
  assert.ok(detection.scores.some((score) => score.contraryEvidence.includes("refund or reversal pattern")));
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
