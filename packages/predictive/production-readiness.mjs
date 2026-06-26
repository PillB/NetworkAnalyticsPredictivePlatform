import {
  GATES,
  detectTemporalLeakage,
  evaluateRedTeamGates,
} from "./model-gates.mjs";

function hashText(value) {
  const text = JSON.stringify(value ?? "");
  let hash = 0;
  for (const character of text) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return `training-${Math.abs(hash).toString(16)}`;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function computeCalibrationCurve(predictions = [], options = {}) {
  const binCount = Math.max(2, Number(options.bins ?? 10));
  const bins = Array.from({ length: binCount }, (_, index) => ({
    index,
    minScore: index / binCount,
    maxScore: (index + 1) / binCount,
    count: 0,
    meanScore: 0,
    empiricalRate: 0,
    absoluteGap: 0,
  }));
  let brier = 0;
  for (const prediction of predictions) {
    const score = finiteNumber(prediction.score);
    const label = finiteNumber(prediction.label);
    if (score === null || label === null) continue;
    const clamped = Math.max(0, Math.min(1, score));
    const index = Math.min(binCount - 1, Math.floor(clamped * binCount));
    const bin = bins[index];
    bin.count += 1;
    bin.meanScore += clamped;
    bin.empiricalRate += label;
    brier += (clamped - label) ** 2;
  }
  const total = bins.reduce((sum, bin) => sum + bin.count, 0);
  let expectedCalibrationError = 0;
  for (const bin of bins) {
    if (!bin.count) continue;
    bin.meanScore = Number((bin.meanScore / bin.count).toFixed(4));
    bin.empiricalRate = Number((bin.empiricalRate / bin.count).toFixed(4));
    bin.absoluteGap = Number(Math.abs(bin.meanScore - bin.empiricalRate).toFixed(4));
    expectedCalibrationError += (bin.count / total) * bin.absoluteGap;
  }
  return {
    contract: "CalibrationCurveV1",
    bins,
    total,
    expectedCalibrationError: Number(expectedCalibrationError.toFixed(4)),
    brierScore: total ? Number((brier / total).toFixed(4)) : null,
    passed: total > 0 && expectedCalibrationError <= GATES.maxCalibrationError,
  };
}

export function createNeuralTrainingRunPlan({
  candidateId,
  family = "temporal GNN",
  folds = [],
  framework = "adapter-required",
  acceleration = "cpu-first",
  seed = 20260404,
} = {}) {
  return {
    contract: "NeuralTrainingRunPlanV1",
    candidateId,
    family,
    framework,
    acceleration,
    seed,
    deterministicReplayRequired: true,
    dataContract: "authorized temporal graph projection only",
    requiredArtifacts: [
      "training manifest",
      "fold metrics",
      "calibration curve",
      "leakage report",
      "red-team report",
      "model card",
      "overreliance study evidence",
    ],
    foldIds: folds.map((fold) => fold.id),
    status: framework === "adapter-required" ? "blocked-no-training-adapter" : "ready-for-offline-training",
  };
}

export function validateTrainedModelArtifact(manifest = {}) {
  const required = [
    "candidateId",
    "artifactHash",
    "trainingDataHash",
    "foldMetrics",
    "predictions",
    "dependencies",
    "redTeamScores",
    "overrelianceStudy",
  ];
  const missing = required.filter((field) => !manifest[field]);
  const leakage = detectTemporalLeakage(manifest.dependencies ?? [], manifest.predictionTime);
  const calibration = computeCalibrationCurve(manifest.predictions ?? [], { bins: manifest.calibrationBins ?? 10 });
  const redTeam = evaluateRedTeamGates({
    id: manifest.candidateId,
    metrics: { redTeamScores: manifest.redTeamScores ?? {} },
  });
  return {
    contract: "TrainedModelArtifactValidationV1",
    artifactId: manifest.candidateId ?? "unknown",
    missing,
    leakage,
    calibration,
    redTeam,
    artifactHash: manifest.artifactHash ?? null,
    trainingDataHash: manifest.trainingDataHash ?? null,
    passed: missing.length === 0 && leakage.leakageSafe && calibration.passed && redTeam.passed,
  };
}

export function validateModelProviderConfig(config = {}) {
  const failures = [
    !config.provider && "provider is required",
    !config.endpoint && "endpoint is required",
    config.secretsInConfig && "secrets must not be stored in model config",
    config.dataPolicy !== "no-operational-data-without-authorization" && "data policy must fail closed",
    !["local-offline", "private-vpc", "approved-managed-provider"].includes(config.deploymentMode) && "deployment mode is not approved",
  ].filter(Boolean);
  return {
    contract: "ModelProviderConfigValidationV1",
    provider: config.provider ?? "unconfigured",
    deploymentMode: config.deploymentMode ?? "unconfigured",
    failures,
    passed: failures.length === 0,
  };
}

export function evaluateProductionPromotion(manifest = {}, context = {}) {
  const artifact = validateTrainedModelArtifact(manifest);
  const provider = validateModelProviderConfig(context.providerConfig ?? {});
  const overreliancePassed = manifest.overrelianceStudy?.status === "passed";
  const failures = [
    !artifact.passed && "trained artifact validation failed",
    !provider.passed && "model provider validation failed",
    !overreliancePassed && "representative overreliance study not passed",
    manifest.target?.includes("person-level guilt") && "prohibited target",
  ].filter(Boolean);
  return {
    contract: "PredictiveProductionPromotionGateV1",
    productionPredictionsEnabled: false,
    eligibleForPilot: failures.length === 0,
    failures,
    artifact,
    provider,
    manifestHash: hashText(manifest),
    decision: failures.length
      ? "blocked-production-display"
      : "eligible-for-supervised-pilot-only",
    prohibitedUse: "Never person-level guilt, criminality, dangerousness, or enforcement action.",
  };
}
