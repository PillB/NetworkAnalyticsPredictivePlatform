const DEFAULT_CANDIDATES = Object.freeze([
  {
    id: "recency-frequency",
    label: "Recency/frequency baseline",
    family: "deterministic baseline",
    metrics: {
      precisionAtBudget: 0.67,
      calibrationError: 0.18,
      hardNegativeFalsePositiveRate: 0.21,
      latencyMs: 4,
      explanationCoverage: 1,
      leakageSafe: true,
      robustness: 0.72,
      overrelianceGate: "needs-human-study",
    },
  },
  {
    id: "edgebank-style",
    label: "EdgeBank-style repeat baseline",
    family: "deterministic baseline",
    metrics: {
      precisionAtBudget: 0.58,
      calibrationError: 0.24,
      hardNegativeFalsePositiveRate: 0.28,
      latencyMs: 6,
      explanationCoverage: 1,
      leakageSafe: true,
      robustness: 0.69,
      overrelianceGate: "needs-human-study",
    },
  },
  {
    id: "calibrated-gbm",
    label: "Calibrated GBM candidate",
    family: "classical ML",
    metrics: {
      precisionAtBudget: 0.71,
      calibrationError: 0.11,
      hardNegativeFalsePositiveRate: 0.18,
      latencyMs: 14,
      explanationCoverage: 0.88,
      leakageSafe: true,
      robustness: 0.66,
      overrelianceGate: "needs-human-study",
    },
  },
  {
    id: "tgn-candidate",
    label: "TGN/TGAT event-stream candidate",
    family: "temporal GNN",
    metrics: {
      precisionAtBudget: 0.76,
      calibrationError: 0.29,
      hardNegativeFalsePositiveRate: 0.34,
      latencyMs: 120,
      explanationCoverage: 0.54,
      leakageSafe: true,
      robustness: 0.51,
      overrelianceGate: "failed",
    },
  },
]);

const GATES = Object.freeze({
  minPrecisionGain: 0.05,
  maxCalibrationError: 0.12,
  maxHardNegativeFalsePositiveRate: 0.2,
  maxLatencyMs: 150,
  minExplanationCoverage: 0.85,
  minRobustness: 0.65,
});

function baselinePrecision(candidates) {
  return Math.max(
    ...candidates
      .filter((candidate) => candidate.family === "deterministic baseline")
      .map((candidate) => candidate.metrics.precisionAtBudget),
  );
}

export function evaluatePredictiveModelCandidates(candidates = DEFAULT_CANDIDATES) {
  const baseline = baselinePrecision(candidates);
  const evaluated = candidates.map((candidate) => {
    const metrics = candidate.metrics;
    const failures = [
      !metrics.leakageSafe && "leakage gate failed",
      metrics.precisionAtBudget < baseline + GATES.minPrecisionGain && candidate.family !== "deterministic baseline" && "does not beat deterministic baseline enough",
      metrics.calibrationError > GATES.maxCalibrationError && "calibration error too high",
      metrics.hardNegativeFalsePositiveRate > GATES.maxHardNegativeFalsePositiveRate && "hard-negative false positives too high",
      metrics.latencyMs > GATES.maxLatencyMs && "latency budget exceeded",
      metrics.explanationCoverage < GATES.minExplanationCoverage && "explanation coverage too low",
      metrics.robustness < GATES.minRobustness && "robustness gate failed",
      metrics.overrelianceGate !== "passed" && "analyst overreliance gate not passed",
    ].filter(Boolean);
    return {
      ...candidate,
      gateStatus: failures.length ? "blocked" : "eligible",
      enabled: false,
      failures,
      decisionSupportOnly: true,
      prohibitedUse: "Never person-level guilt, criminality, dangerousness, or enforcement action.",
    };
  });
  return {
    contract: "PredictiveGraphModelGatePanelV1",
    gates: GATES,
    baselinePrecisionAtBudget: baseline,
    candidates: evaluated,
    productionPredictionsEnabled: false,
    summary: "All predictive outputs remain disabled until baseline, calibration, robustness, explanation, latency, and analyst-overreliance gates pass.",
  };
}

export function enableCandidate(evaluation, candidateId) {
  const candidate = evaluation.candidates.find((item) => item.id === candidateId);
  if (!candidate) return { enabled: false, reason: "Unknown candidate." };
  if (candidate.gateStatus !== "eligible") {
    return {
      enabled: false,
      reason: `Blocked: ${candidate.failures.join("; ")}.`,
      candidate,
    };
  }
  return {
    enabled: true,
    reason: "Eligible for supervised pilot display only; still decision-support.",
    candidate,
  };
}

export { DEFAULT_CANDIDATES };
