const DEFAULT_PREDICTION_TIME = "2026-04-04T18:00:00Z";

export const RED_TEAM_SCENARIOS = Object.freeze([
  { id: "legitimate-high-degree", label: "Legitimate high-degree actors", expectedMaxRank: 0.55, severity: "high" },
  { id: "delayed-reports", label: "Delayed reports", expectedMaxRank: 0.6, severity: "high" },
  { id: "duplicated-entities", label: "Duplicated entities", expectedMaxRank: 0.58, severity: "medium" },
  { id: "missing-data", label: "Missing data", expectedMaxRank: 0.62, severity: "medium" },
  { id: "smurfing", label: "Smurfing / split transfers", expectedMaxRank: 0.65, severity: "high" },
  { id: "circular-flows", label: "Circular flows", expectedMaxRank: 0.6, severity: "high" },
  { id: "shared-infrastructure", label: "Shared infrastructure", expectedMaxRank: 0.55, severity: "high" },
]);

const DEFAULT_DEPENDENCIES = Object.freeze([
  {
    id: "tx-004",
    eventTime: "2026-04-01T10:41:00Z",
    knownAt: "2026-04-04T18:00:00Z",
    labelKnownAt: "2026-04-05T00:00:00Z",
    scalerFitAt: "2026-04-04T12:00:00Z",
  },
  {
    id: "tx-006",
    eventTime: "2026-04-01T12:18:00Z",
    knownAt: "2026-04-04T18:00:00Z",
    labelKnownAt: "2026-04-05T00:00:00Z",
    scalerFitAt: "2026-04-04T12:00:00Z",
  },
]);

const DEFAULT_FOLDS = Object.freeze([
  { trainUntil: "2026-04-01T11:30:00Z", validateFrom: "2026-04-01T11:30:00Z", validateUntil: "2026-04-02T11:30:00Z" },
  { trainUntil: "2026-04-02T11:30:00Z", validateFrom: "2026-04-02T11:30:00Z", validateUntil: "2026-04-03T11:30:00Z" },
  { trainUntil: "2026-04-03T11:30:00Z", validateFrom: "2026-04-03T11:30:00Z", validateUntil: "2026-04-04T11:30:00Z" },
]);

const DEFAULT_CANDIDATES = Object.freeze([
  candidate("recency-frequency", "Recency/frequency baseline", "deterministic baseline", {
    precisionAtBudget: 0.67,
    calibrationError: 0.18,
    hardNegativeFalsePositiveRate: 0.21,
    randomNegativePrecision: 0.73,
    latencyMs: 4,
    explanationCoverage: 1,
    robustness: 0.72,
    overrelianceGate: "needs-human-study",
    featureFamilies: ["recency", "frequency", "degree"],
    redTeamScores: { "legitimate-high-degree": 0.62, "shared-infrastructure": 0.58 },
  }),
  candidate("edgebank-style", "EdgeBank-style repeat baseline", "deterministic baseline", {
    precisionAtBudget: 0.58,
    calibrationError: 0.24,
    hardNegativeFalsePositiveRate: 0.28,
    randomNegativePrecision: 0.76,
    latencyMs: 6,
    explanationCoverage: 1,
    robustness: 0.69,
    overrelianceGate: "needs-human-study",
    featureFamilies: ["historical edge repeat", "recency"],
    redTeamScores: { "duplicated-entities": 0.64, "delayed-reports": 0.67 },
  }),
  candidate("temporal-motifs", "Temporal motif baseline", "deterministic baseline", {
    precisionAtBudget: 0.69,
    calibrationError: 0.16,
    hardNegativeFalsePositiveRate: 0.19,
    randomNegativePrecision: 0.72,
    latencyMs: 11,
    explanationCoverage: 1,
    robustness: 0.74,
    overrelianceGate: "needs-human-study",
    featureFamilies: ["fan-in/fan-out motif", "burst timing", "bridge motif"],
    redTeamScores: { "smurfing": 0.58, "circular-flows": 0.55 },
  }),
  candidate("calibrated-logistic", "Calibrated logistic candidate", "classical ML", {
    precisionAtBudget: 0.7,
    calibrationError: 0.12,
    hardNegativeFalsePositiveRate: 0.18,
    randomNegativePrecision: 0.8,
    latencyMs: 9,
    explanationCoverage: 0.93,
    robustness: 0.68,
    overrelianceGate: "needs-human-study",
    featureFamilies: ["calibrated linear weights", "motifs", "missingness indicators"],
    redTeamScores: { "missing-data": 0.57, "legitimate-high-degree": 0.52 },
  }),
  candidate("calibrated-gbm", "Calibrated GBM candidate", "classical ML", {
    precisionAtBudget: 0.71,
    calibrationError: 0.11,
    hardNegativeFalsePositiveRate: 0.18,
    randomNegativePrecision: 0.84,
    latencyMs: 14,
    explanationCoverage: 0.88,
    robustness: 0.66,
    overrelianceGate: "needs-human-study",
    featureFamilies: ["tree interactions", "motifs", "transaction timing"],
    redTeamScores: { "circular-flows": 0.54, "shared-infrastructure": 0.51 },
  }),
  candidate("tgat-candidate", "TGAT temporal attention candidate", "temporal GNN", {
    precisionAtBudget: 0.75,
    calibrationError: 0.27,
    hardNegativeFalsePositiveRate: 0.31,
    randomNegativePrecision: 0.9,
    latencyMs: 118,
    explanationCoverage: 0.57,
    robustness: 0.52,
    overrelianceGate: "failed",
    featureFamilies: ["temporal attention", "node memory", "time encodings"],
    redTeamScores: { "delayed-reports": 0.79, "shared-infrastructure": 0.72 },
  }),
  candidate("tgn-candidate", "TGN event-stream candidate", "temporal GNN", {
    precisionAtBudget: 0.76,
    calibrationError: 0.29,
    hardNegativeFalsePositiveRate: 0.34,
    randomNegativePrecision: 0.91,
    latencyMs: 120,
    explanationCoverage: 0.54,
    robustness: 0.51,
    overrelianceGate: "failed",
    featureFamilies: ["memory module", "message passing", "time encodings"],
    redTeamScores: { "legitimate-high-degree": 0.81, "delayed-reports": 0.76 },
  }),
  candidate("graphmixer-dygformer", "GraphMixer / DyGFormer candidate", "temporal GNN", {
    precisionAtBudget: 0.74,
    calibrationError: 0.2,
    hardNegativeFalsePositiveRate: 0.26,
    randomNegativePrecision: 0.88,
    latencyMs: 142,
    explanationCoverage: 0.63,
    robustness: 0.56,
    overrelianceGate: "failed",
    featureFamilies: ["sequence mixer", "neighbor sequences", "time encodings"],
    redTeamScores: { "smurfing": 0.7, "missing-data": 0.67 },
  }),
  candidate("cawn", "CAWN causal anonymous walk candidate", "temporal GNN", {
    precisionAtBudget: 0.72,
    calibrationError: 0.19,
    hardNegativeFalsePositiveRate: 0.24,
    randomNegativePrecision: 0.86,
    latencyMs: 94,
    explanationCoverage: 0.62,
    robustness: 0.58,
    overrelianceGate: "failed",
    featureFamilies: ["anonymous walks", "time-aware neighborhoods"],
    redTeamScores: { "duplicated-entities": 0.69, "circular-flows": 0.66 },
  }),
  candidate("jodie", "JODIE dynamic embedding candidate", "temporal GNN", {
    precisionAtBudget: 0.7,
    calibrationError: 0.22,
    hardNegativeFalsePositiveRate: 0.27,
    randomNegativePrecision: 0.85,
    latencyMs: 78,
    explanationCoverage: 0.5,
    robustness: 0.55,
    overrelianceGate: "failed",
    featureFamilies: ["projected embeddings", "interaction sequence"],
    redTeamScores: { "delayed-reports": 0.71, "missing-data": 0.69 },
  }),
  candidate("evolvegcn", "EvolveGCN snapshot candidate", "temporal GNN", {
    precisionAtBudget: 0.68,
    calibrationError: 0.21,
    hardNegativeFalsePositiveRate: 0.25,
    randomNegativePrecision: 0.81,
    latencyMs: 136,
    explanationCoverage: 0.59,
    robustness: 0.57,
    overrelianceGate: "failed",
    featureFamilies: ["snapshot GCN", "evolving weights"],
    redTeamScores: { "missing-data": 0.7, "circular-flows": 0.63 },
  }),
  candidate("transaction-gnn", "Transaction-specific GNN candidate", "financial graph ML", {
    precisionAtBudget: 0.78,
    calibrationError: 0.15,
    hardNegativeFalsePositiveRate: 0.22,
    randomNegativePrecision: 0.93,
    latencyMs: 160,
    explanationCoverage: 0.7,
    robustness: 0.6,
    overrelianceGate: "failed",
    featureFamilies: ["heterogeneous transaction graph", "amount/time encodings"],
    redTeamScores: { "legitimate-high-degree": 0.68, "shared-infrastructure": 0.71 },
  }),
  candidate("dynamic-community", "Dynamic community hypothesis candidate", "dynamic community method", {
    precisionAtBudget: 0.69,
    calibrationError: 0.17,
    hardNegativeFalsePositiveRate: 0.19,
    randomNegativePrecision: 0.77,
    latencyMs: 25,
    explanationCoverage: 0.9,
    robustness: 0.67,
    overrelianceGate: "needs-human-study",
    featureFamilies: ["split/merge lineage", "bridge concentration", "community birth"],
    redTeamScores: { "duplicated-entities": 0.52, "missing-data": 0.56 },
  }),
]);

const GATES = Object.freeze({
  minPrecisionGain: 0.05,
  maxCalibrationError: 0.12,
  maxHardNegativeFalsePositiveRate: 0.2,
  maxLatencyMs: 150,
  minExplanationCoverage: 0.85,
  minRobustness: 0.65,
});

function candidate(id, label, family, metrics) {
  return {
    id,
    label,
    family,
    target: "relationship/event/subgraph/community review hypotheses",
    population: "authorized visible synthetic graph projection",
    horizon: "next review window",
    metrics,
    dependencies: DEFAULT_DEPENDENCIES,
  };
}

function time(value) {
  return Number.isFinite(Date.parse(value)) ? Date.parse(value) : Number.NaN;
}

export function detectTemporalLeakage(dependencies = [], predictionTime = DEFAULT_PREDICTION_TIME) {
  const cutoff = time(predictionTime);
  const violations = [];
  if (!Number.isFinite(cutoff)) {
    violations.push({
      dependencyId: "prediction-time",
      field: "predictionTime",
      value: predictionTime,
      reason: "invalid prediction time",
    });
  }
  for (const dependency of dependencies) {
    for (const [field, label] of [
      ["eventTime", "future event dependency"],
      ["knownAt", "future known-at dependency"],
      ["labelKnownAt", "future label dependency"],
      ["scalerFitAt", "future scaler fit"],
      ["featureWindowEnd", "future feature window"],
    ]) {
      if (!dependency[field]) continue;
      const parsed = time(dependency[field]);
      if (!Number.isFinite(parsed)) {
        violations.push({
          dependencyId: dependency.id ?? "unknown",
          field,
          value: dependency[field],
          reason: `invalid ${field} timestamp`,
        });
      } else if (Number.isFinite(cutoff) && parsed > cutoff) {
        violations.push({
          dependencyId: dependency.id ?? "unknown",
          field,
          value: dependency[field],
          reason: label,
        });
      }
    }
  }
  return {
    contract: "TemporalLeakageReportV1",
    predictionTime,
    leakageSafe: violations.length === 0,
    violations,
  };
}

export function buildTemporalFolds(events = [], options = {}) {
  const horizonMs = Number(options.horizonMs ?? 86_400_000);
  const stepMs = Number(options.stepMs ?? horizonMs);
  const trainWindowMs = Number(options.trainWindowMs ?? horizonMs * 2);
  const sorted = [...events]
    .map((event) => ({ ...event, atMs: time(event.at ?? event.eventTime ?? event.knownAt) }))
    .filter((event) => Number.isFinite(event.atMs))
    .sort((a, b) => a.atMs - b.atMs || String(a.id).localeCompare(String(b.id)));
  if (!sorted.length) {
    return {
      contract: "TemporalFoldReplayV1",
      folds: DEFAULT_FOLDS.map((fold, index) => ({
        id: `fold-${index + 1}`,
        ...fold,
        horizon: "24h",
        candidatePopulation: [],
        replaySeed: `temporal-replay-${index + 1}`,
      })),
      deterministicReplayHash: "fold-1|fold-2|fold-3",
    };
  }
  const start = sorted[0].atMs + trainWindowMs;
  const end = sorted.at(-1).atMs;
  const folds = [];
  for (let trainUntilMs = start; trainUntilMs < end; trainUntilMs += stepMs) {
    const validateUntilMs = trainUntilMs + horizonMs;
    folds.push({
      id: `fold-${folds.length + 1}`,
      trainUntil: new Date(trainUntilMs).toISOString(),
      validateFrom: new Date(trainUntilMs).toISOString(),
      validateUntil: new Date(validateUntilMs).toISOString(),
      horizon: `${Math.round(horizonMs / 3_600_000)}h`,
      candidatePopulation: sorted
        .filter((event) => event.atMs <= trainUntilMs)
        .map((event) => event.id)
        .sort(),
      replaySeed: `temporal-replay-${folds.length + 1}-${sorted.length}`,
    });
  }
  const deterministicReplayHash = folds.map((fold) => `${fold.id}:${fold.candidatePopulation.join(",")}`).join("|");
  return { contract: "TemporalFoldReplayV1", folds, deterministicReplayHash };
}

export function evaluateRedTeamGates(candidateItem, scenarios = RED_TEAM_SCENARIOS) {
  const scores = candidateItem.metrics.redTeamScores ?? {};
  const failures = scenarios
    .map((scenario) => ({
      ...scenario,
      observedRank: Number(scores[scenario.id] ?? 0),
      passed: Number(scores[scenario.id] ?? 0) <= scenario.expectedMaxRank,
    }))
    .filter((scenario) => !scenario.passed);
  return {
    contract: "PredictiveRedTeamGateV1",
    passed: failures.length === 0,
    failures,
    scenarios: scenarios.map((scenario) => ({
      id: scenario.id,
      label: scenario.label,
      observedRank: Number(scores[scenario.id] ?? 0),
      expectedMaxRank: scenario.expectedMaxRank,
    })),
  };
}

export function simulateHardNegativeBenchmark(candidateItems = DEFAULT_CANDIDATES, fixture = {}) {
  return {
    contract: "HardNegativeBenchmarkSimulationV1",
    fixture: fixture.name ?? "synthetic-fraud-hard-negatives",
    rows: candidateItems.map((candidateItem) => ({
      candidateId: candidateItem.id,
      randomNegativePrecision: candidateItem.metrics.randomNegativePrecision,
      hardNegativeFalsePositiveRate: candidateItem.metrics.hardNegativeFalsePositiveRate,
      gap: Number((candidateItem.metrics.randomNegativePrecision - candidateItem.metrics.precisionAtBudget).toFixed(3)),
      passed: candidateItem.metrics.hardNegativeFalsePositiveRate <= GATES.maxHardNegativeFalsePositiveRate,
    })),
  };
}

function baselinePrecision(candidates) {
  return Math.max(
    ...candidates
      .filter((candidateItem) => candidateItem.family === "deterministic baseline")
      .map((candidateItem) => candidateItem.metrics.precisionAtBudget),
  );
}

export function buildCandidateModelCard(candidateItem, context = {}) {
  const leakageReport = candidateItem.leakageReport ?? detectTemporalLeakage(candidateItem.dependencies, context.predictionTime);
  const redTeam = candidateItem.redTeam ?? evaluateRedTeamGates(candidateItem);
  return {
    contract: "PredictiveModelCardV1",
    id: candidateItem.id,
    label: candidateItem.label,
    family: candidateItem.family,
    target: candidateItem.target,
    population: candidateItem.population,
    horizon: candidateItem.horizon,
    trainingWindow: context.trainingWindow ?? "rolling temporal folds",
    foldCount: context.foldCount ?? 3,
    featureFamilies: candidateItem.metrics.featureFamilies ?? [],
    leakageReport,
    baselineLift: Number((candidateItem.metrics.precisionAtBudget - (context.baselinePrecisionAtBudget ?? 0)).toFixed(3)),
    calibration: { expectedCalibrationError: candidateItem.metrics.calibrationError, maxAllowed: GATES.maxCalibrationError },
    hardNegative: {
      falsePositiveRate: candidateItem.metrics.hardNegativeFalsePositiveRate,
      maxAllowed: GATES.maxHardNegativeFalsePositiveRate,
      randomNegativePrecision: candidateItem.metrics.randomNegativePrecision,
    },
    explanationCoverage: candidateItem.metrics.explanationCoverage,
    redTeam,
    prohibitedUse: "Never person-level guilt, criminality, dangerousness, or enforcement action.",
  };
}

export function evaluatePredictiveModelCandidates(candidates = DEFAULT_CANDIDATES, options = {}) {
  const baseline = baselinePrecision(candidates);
  const folds = buildTemporalFolds(options.events ?? []);
  const benchmark = simulateHardNegativeBenchmark(candidates, options.fixture);
  const evaluated = candidates.map((candidateItem) => {
    const metrics = candidateItem.metrics;
    const leakageReport = detectTemporalLeakage(candidateItem.dependencies, options.predictionTime ?? DEFAULT_PREDICTION_TIME);
    const redTeam = evaluateRedTeamGates(candidateItem, options.redTeamScenarios ?? RED_TEAM_SCENARIOS);
    const benchmarkRow = benchmark.rows.find((row) => row.candidateId === candidateItem.id);
    const leakageSafe = leakageReport.leakageSafe;
    const failures = [
      !leakageSafe && "leakage gate failed",
      ...leakageReport.violations.map((violation) => violation.reason),
      metrics.precisionAtBudget < baseline + GATES.minPrecisionGain && candidateItem.family !== "deterministic baseline" && "does not beat deterministic baseline enough",
      metrics.calibrationError > GATES.maxCalibrationError && "calibration error too high",
      metrics.hardNegativeFalsePositiveRate > GATES.maxHardNegativeFalsePositiveRate && "hard-negative false positives too high",
      metrics.latencyMs > GATES.maxLatencyMs && "latency budget exceeded",
      metrics.explanationCoverage < GATES.minExplanationCoverage && "explanation coverage too low",
      metrics.robustness < GATES.minRobustness && "robustness gate failed",
      metrics.overrelianceGate !== "passed" && "analyst overreliance gate not passed",
      !redTeam.passed && "red-team scenario gate failed",
      benchmarkRow && !benchmarkRow.passed && "hard-negative benchmark failed",
    ].filter(Boolean);
    const withReports = {
      ...candidateItem,
      metrics: { ...metrics, leakageSafe },
      leakageReport,
      redTeam,
      hardNegativeBenchmark: benchmarkRow,
    };
    return {
      ...withReports,
      gateStatus: failures.length ? "blocked" : "eligible",
      enabled: false,
      failures: [...new Set(failures)],
      decisionSupportOnly: true,
      prohibitedUse: "Never person-level guilt, criminality, dangerousness, or enforcement action.",
      modelCard: buildCandidateModelCard(withReports, {
        baselinePrecisionAtBudget: baseline,
        foldCount: folds.folds.length,
        predictionTime: options.predictionTime ?? DEFAULT_PREDICTION_TIME,
      }),
    };
  });
  return {
    contract: "PredictiveGraphModelGatePanelV2",
    gates: GATES,
    baselinePrecisionAtBudget: baseline,
    temporalFolds: folds,
    hardNegativeBenchmark: benchmark,
    candidates: evaluated,
    productionPredictionsEnabled: evaluated.every((candidateItem) => candidateItem.gateStatus === "eligible") && evaluated.some((candidateItem) => candidateItem.family !== "deterministic baseline"),
    summary: "Predictive outputs remain disabled until baseline, calibration, robustness, explanation, latency, leakage, red-team, and analyst-overreliance gates pass.",
  };
}

export function enableCandidate(evaluation, candidateId) {
  const candidateItem = evaluation.candidates.find((item) => item.id === candidateId);
  if (!candidateItem) return { enabled: false, reason: "Unknown candidate." };
  if (!evaluation.productionPredictionsEnabled || candidateItem.gateStatus !== "eligible") {
    return {
      enabled: false,
      reason: `Blocked: ${candidateItem.failures.join("; ")}.`,
      candidate: candidateItem,
    };
  }
  return {
    enabled: true,
    reason: "Eligible for supervised pilot display only; still decision-support.",
    candidate: candidateItem,
  };
}

export { DEFAULT_CANDIDATES, GATES };
