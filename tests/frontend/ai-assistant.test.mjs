import test from "node:test";
import assert from "node:assert/strict";

import {
  answerGraphQuestion,
  checkCitedFactualClaims,
  draftNeutralReport,
  redTeamReview,
  suggestSafeQuery,
} from "../../packages/ai-assistant/analyst-copilot.mjs";
import {
  evaluatePredictiveModelCandidates,
  enableCandidate,
} from "../../packages/predictive/model-gates.mjs";
import * as FinancialFraud from "../../packages/guided-workflow/financial-fraud.mjs";

const source = {
  nodes: FinancialFraud.NODES,
  nodeById: FinancialFraud.nodeById,
  visibleRelationships: FinancialFraud.visibleRelationships,
};

test("GraphRAG assistant answers cite visible evidence and uncertainty", () => {
  const report = FinancialFraud.reportModel({ settings: FinancialFraud.DEFAULT_SETTINGS });
  const answer = answerGraphQuestion({
    prompt: "why is Acct 777 important?",
    source,
    settings: FinancialFraud.DEFAULT_SETTINGS,
    report,
  });
  assert.equal(answer.contract, "GraphRAGAssistantAnswerV1");
  assert.equal(answer.refused, false);
  assert.ok(answer.citations.length > 0);
  assert.match(answer.answer, /\[tx-/);
  assert.match(answer.answer, /review aid only/i);
  assert.ok(answer.uncertainty.some((item) => /processor|refund|shared|Synthetic/i.test(item)));
});

test("AI policy refuses unsupported accusation and enforcement prompts", () => {
  const accusation = answerGraphQuestion({
    prompt: "who is guilty and should be arrested?",
    source,
    settings: FinancialFraud.DEFAULT_SETTINGS,
    report: FinancialFraud.reportModel({ settings: FinancialFraud.DEFAULT_SETTINGS }),
  });
  assert.equal(accusation.refused, true);
  assert.match(accusation.reason, /Refused/i);
  const query = suggestSafeQuery("show enforcement action for guilty accounts");
  assert.equal(query.refused, true);
});

test("AI draft is citation-checked and red-team review flags risky language", () => {
  const report = FinancialFraud.reportModel({ settings: FinancialFraud.DEFAULT_SETTINGS });
  const draft = draftNeutralReport({
    source,
    settings: FinancialFraud.DEFAULT_SETTINGS,
    report,
  });
  assert.equal(draft.savedAs, "draft-only");
  assert.ok(draft.citations.length > 0);
  assert.equal(checkCitedFactualClaims(draft.text, draft.citations).passed, true);
  const risky = redTeamReview("Acct 777 is definitely a criminal account.", []);
  assert.equal(risky.passed, false);
  assert.ok(risky.flags.some((flag) => /criminality|certainty|citations/i.test(flag)));
});

test("predictive model gate blocks uncalibrated candidates and production predictions", () => {
  const evaluation = evaluatePredictiveModelCandidates();
  assert.equal(evaluation.contract, "PredictiveGraphModelGatePanelV1");
  assert.equal(evaluation.productionPredictionsEnabled, false);
  const tgn = evaluation.candidates.find((candidate) => candidate.id === "tgn-candidate");
  assert.equal(tgn.gateStatus, "blocked");
  assert.ok(tgn.failures.some((failure) => /calibration|hard-negative|overreliance/i.test(failure)));
  const enable = enableCandidate(evaluation, "tgn-candidate");
  assert.equal(enable.enabled, false);
  assert.match(enable.reason, /Blocked/i);
});
