import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_SETTINGS,
  NODES,
  TRANSACTIONS,
} from "../../packages/guided-workflow/financial-fraud.mjs";
import {
  buildAccountFeatureRows,
  trainLocalReviewModel,
} from "../../packages/predictive/local-trainer.mjs";

const labels = Object.fromEntries(
  NODES
    .filter((node) => node.type === "account")
    .map((node) => [node.id, node.id === "a-777"]),
);

test("local trainer produces deterministic account review-priority predictions", () => {
  const rows = buildAccountFeatureRows({
    nodes: NODES,
    transactions: TRANSACTIONS,
    labels,
    settings: DEFAULT_SETTINGS,
  });
  const first = trainLocalReviewModel({ rows });
  const second = trainLocalReviewModel({ rows });

  assert.deepEqual(first.model.weights, second.model.weights);
  assert.deepEqual(first.predictions, second.predictions);
  assert.equal(first.algorithm, "browser-local logistic review-priority model");
  assert.equal(first.modelFamily, "classical ML over temporal graph features");
});

test("local trainer ranks Acct 777 first with evidence dependencies and safe wording", () => {
  const rows = buildAccountFeatureRows({
    nodes: NODES,
    transactions: TRANSACTIONS,
    labels,
    settings: DEFAULT_SETTINGS,
  });
  const run = trainLocalReviewModel({ rows });
  const top = run.predictions[0];

  assert.equal(top.accountId, "a-777");
  assert.equal(top.status, "review-priority");
  assert.ok(top.score >= 0.6);
  assert.ok(top.dependencies.includes("tx-004"));
  assert.ok(top.contributions.some((item) => item.feature === "rapidPassThrough"));
  assert.match(run.limitations.join(" "), /review-priority predictions/i);
  assert.doesNotMatch(JSON.stringify(run), /should be arrested|proved|verdict/i);
});
