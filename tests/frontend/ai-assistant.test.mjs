import test from "node:test";
import assert from "node:assert/strict";

import {
  answerGraphQuestion,
  checkCitedFactualClaims,
  coachNextStep,
  draftNeutralReport,
  findEvidenceGaps,
  prepareAssistantNote,
  redTeamReview,
  retrieveGraphEvidence,
  suggestEntityResolutions,
  suggestNextReviewAction,
  suggestSafeQuery,
} from "../../packages/ai-assistant/analyst-copilot.mjs";
import {
  buildCandidateModelCard,
  buildTemporalFolds,
  detectTemporalLeakage,
  evaluatePredictiveModelCandidates,
  evaluateRedTeamGates,
  enableCandidate,
  simulateHardNegativeBenchmark,
} from "../../packages/predictive/model-gates.mjs";
import * as FinancialFraud from "../../packages/guided-workflow/financial-fraud.mjs";
import { createChartWorkspace, setTaskState } from "../../packages/graph-renderer/chart-workspace.mjs";

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
  assert.equal(answer.retrieval.contract, "GraphRAGRetrievalV1");
  assert.ok(answer.citations.length > 0);
  assert.match(answer.answer, /\[tx-/);
  assert.match(answer.answer, /review aid only/i);
  assert.equal(answer.audit.configVersion, "ai-step-9-local-v2");
  assert.ok(answer.uncertainty.some((item) => /processor|refund|shared|Synthetic/i.test(item)));
});

test("GraphRAG retriever returns authorized-only evidence", () => {
  const restricted = { ...FinancialFraud.DEFAULT_SETTINGS, relationFilter: "transfers", includeInfrastructure: false };
  const retrieval = retrieveGraphEvidence({
    prompt: "why is Acct 777 important?",
    source,
    settings: restricted,
    report: FinancialFraud.reportModel({ settings: restricted }),
  });
  assert.equal(retrieval.authorizedProjection, "current visible graph projection only");
  assert.ok(retrieval.rows.length > 0);
  assert.ok(retrieval.rows.every((row) => row.id.startsWith("tx-") && !/login event/i.test(row.source)));
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

test("AI query preview, entity resolution, gap finder, coach, and active-learning helpers are deterministic", () => {
  const preview = suggestSafeQuery("show path between Acct 100 and Acct 777", source);
  assert.equal(preview.contract, "AIQueryPreviewV1");
  assert.equal(preview.preview.operation, "graph-phrase");
  assert.match(preview.preview.phrase, /Acct 100/i);

  const entityResolution = suggestEntityResolutions({ source, settings: FinancialFraud.DEFAULT_SETTINGS });
  assert.equal(entityResolution.contract, "EntityResolutionSuggestionsV1");
  assert.ok(entityResolution.suggestions.some((item) => /Acct/i.test(item.label)));
  assert.match(entityResolution.suggestions[0].requiredDecision, /analyst-confirmation/i);

  const workspace = setTaskState(createChartWorkspace(), "Verify KYC records", "todo");
  const gaps = findEvidenceGaps({
    source,
    settings: FinancialFraud.DEFAULT_SETTINGS,
    report: FinancialFraud.reportModel({ settings: FinancialFraud.DEFAULT_SETTINGS }),
    workspace,
  });
  assert.equal(gaps.contract, "ContradictionGapFinderV1");
  assert.ok(gaps.gaps.some((gap) => /Open review tasks/i.test(gap.issue)));

  const coach = coachNextStep({ step: FinancialFraud.STEPS[0], workspace, mode: "novice" });
  assert.equal(coach.contract, "AITutorialCoachV1");
  assert.match(coach.couldGoWrong, /Hidden data|delayed reports/i);

  const action = suggestNextReviewAction({ source, settings: FinancialFraud.DEFAULT_SETTINGS, workspace });
  assert.equal(action.contract, "AIActiveLearningSuggestionV1");
  assert.equal(action.action, "complete-open-task");
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
  const note = prepareAssistantNote(draft, draft.citations);
  assert.equal(note.contract, "AISaveAsNotePreviewV1");
  assert.equal(note.allowed, true);
  assert.match(note.note, /AI draft; not evidence/i);
  assert.equal(note.audit.saved, true);
  const risky = redTeamReview("Acct 777 is definitely a criminal account.", []);
  assert.equal(risky.passed, false);
  assert.ok(risky.flags.some((flag) => /criminality|certainty|citations/i.test(flag)));
});

test("predictive model gate blocks uncalibrated candidates and production predictions", () => {
  const evaluation = evaluatePredictiveModelCandidates();
  assert.equal(evaluation.contract, "PredictiveGraphModelGatePanelV2");
  assert.equal(evaluation.productionPredictionsEnabled, false);
  assert.ok(evaluation.temporalFolds.folds.length >= 1);
  assert.ok(evaluation.hardNegativeBenchmark.rows.length >= 1);
  const tgn = evaluation.candidates.find((candidate) => candidate.id === "tgn-candidate");
  assert.equal(tgn.gateStatus, "blocked");
  assert.equal(tgn.modelCard.contract, "PredictiveModelCardV1");
  assert.ok(tgn.failures.some((failure) => /calibration|hard-negative|overreliance/i.test(failure)));
  const enable = enableCandidate(evaluation, "tgn-candidate");
  assert.equal(enable.enabled, false);
  assert.match(enable.reason, /Blocked/i);
});

test("predictive leakage detector rejects future labels features and scalers", () => {
  const report = detectTemporalLeakage([
    { id: "future-event", eventTime: "2026-04-05T00:00:00Z" },
    { id: "future-known", knownAt: "2026-04-05T00:00:00Z" },
    { id: "future-label", labelKnownAt: "2026-04-05T00:00:00Z" },
    { id: "future-scaler", scalerFitAt: "2026-04-05T00:00:00Z" },
    { id: "future-window", featureWindowEnd: "2026-04-05T00:00:00Z" },
  ], "2026-04-04T18:00:00Z");
  assert.equal(report.leakageSafe, false);
  assert.ok(report.violations.some((violation) => /future event/i.test(violation.reason)));
  assert.ok(report.violations.some((violation) => /future label/i.test(violation.reason)));
  assert.ok(report.violations.some((violation) => /future scaler/i.test(violation.reason)));
  assert.ok(report.violations.some((violation) => /future feature window/i.test(violation.reason)));
});

test("predictive leakage detector fails closed on invalid timestamps", () => {
  const report = detectTemporalLeakage([
    { id: "bad-known", knownAt: "not-a-date" },
    { id: "bad-window", featureWindowEnd: "invalid-window" },
  ], "not-a-prediction-time");
  assert.equal(report.leakageSafe, false);
  assert.ok(report.violations.some((violation) => /invalid prediction time/i.test(violation.reason)));
  assert.ok(report.violations.some((violation) => /invalid knownAt timestamp/i.test(violation.reason)));
  assert.ok(report.violations.some((violation) => /invalid featureWindowEnd timestamp/i.test(violation.reason)));
});

test("temporal folds replay deterministically", () => {
  const events = FinancialFraud.RELATIONSHIPS.map((relationship) => ({
    id: relationship.id,
    at: relationship.eventTime.replace(" UTC", "Z").replace(" ", "T"),
  }));
  const first = buildTemporalFolds(events, { horizonMs: 3_600_000, trainWindowMs: 3_600_000, stepMs: 3_600_000 });
  const second = buildTemporalFolds(events, { horizonMs: 3_600_000, trainWindowMs: 3_600_000, stepMs: 3_600_000 });
  assert.equal(first.deterministicReplayHash, second.deterministicReplayHash);
  assert.ok(first.folds.every((fold) => fold.replaySeed));
});

test("hard-negative benchmark, model card, and red-team gates are exposed", () => {
  const evaluation = evaluatePredictiveModelCandidates();
  const benchmark = simulateHardNegativeBenchmark(evaluation.candidates);
  assert.equal(benchmark.contract, "HardNegativeBenchmarkSimulationV1");
  assert.ok(benchmark.rows.some((row) => row.passed === false));

  const tgn = evaluation.candidates.find((candidate) => candidate.id === "tgn-candidate");
  const card = buildCandidateModelCard(tgn, { baselinePrecisionAtBudget: evaluation.baselinePrecisionAtBudget });
  assert.equal(card.contract, "PredictiveModelCardV1");
  assert.match(card.prohibitedUse, /Never person-level guilt/i);
  assert.equal(card.redTeam.passed, false);

  const redTeam = evaluateRedTeamGates(tgn);
  assert.equal(redTeam.contract, "PredictiveRedTeamGateV1");
  assert.equal(redTeam.passed, false);
});
