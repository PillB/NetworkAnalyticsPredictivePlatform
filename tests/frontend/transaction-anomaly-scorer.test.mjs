import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_SETTINGS,
  NODES,
  TRANSACTIONS,
} from "../../packages/guided-workflow/financial-fraud.mjs";
import { scoreTransactionAnomalies } from "../../packages/predictive/transaction-anomaly-scorer.mjs";

test("transaction anomaly scorer ranks Acct 777 first with dependencies", () => {
  const run = scoreTransactionAnomalies({
    nodes: NODES,
    transactions: TRANSACTIONS,
    settings: DEFAULT_SETTINGS,
  });
  assert.equal(run.contract, "TransactionAnomalyScorerV1");
  assert.equal(run.calibrated, false);
  assert.equal(run.productionPredictionsEnabled, false);
  assert.equal(run.predictions[0].accountId, "a-777");
  assert.equal(run.predictions[0].status, "review-priority");
  assert.ok(run.predictions[0].dependencies.includes("tx-004"));
  assert.ok(run.predictions[0].contributions.length > 0);
  assert.doesNotMatch(JSON.stringify(run), /state of the art|SOTA|pretrained|production fraud prediction/i);
});

test("transaction anomaly scorer suppresses obvious hard-negative descriptions", () => {
  const transactions = [
    { id: "hn-1", at: "2026-04-01T09:00:00Z", origin: "employer", destination: "payroll-hub", amount: 1000, currency: "USD", type: "payroll", description: "salary batch" },
    { id: "hn-2", at: "2026-04-01T09:02:00Z", origin: "payroll-hub", destination: "employee-1", amount: 1000, currency: "USD", type: "payroll", description: "salary batch" },
    { id: "hn-3", at: "2026-04-01T09:03:00Z", origin: "payroll-hub", destination: "employee-2", amount: 1000, currency: "USD", type: "payroll", description: "salary batch" },
  ];
  const nodes = [
    { id: "payroll-hub", type: "account", label: "Payroll Hub" },
    { id: "employee-1", type: "account", label: "Employee 1" },
    { id: "employee-2", type: "account", label: "Employee 2" },
  ];
  const run = scoreTransactionAnomalies({ nodes, transactions });
  const hub = run.predictions.find((prediction) => prediction.accountId === "payroll-hub");
  assert.notEqual(hub.status, "review-priority");
  assert.ok(hub.suppressors.includes("payroll or salary hub pattern"));
});
