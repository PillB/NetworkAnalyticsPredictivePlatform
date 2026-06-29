import {
  DEFAULT_SETTINGS as FRAUD_DEFAULT_SETTINGS,
  NODES as FRAUD_NODES,
  TRANSACTIONS as FRAUD_TRANSACTIONS,
} from "../guided-workflow/financial-fraud.mjs";

const FEATURE_NAMES = Object.freeze([
  "inboundOrigins",
  "outboundDestinations",
  "passThroughRatio",
  "rapidPassThrough",
  "roundAmountShare",
  "infrastructureTouch",
  "bridgeCentrality",
]);

function sigmoid(value) {
  return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, value))));
}

function hoursBetween(a, b) {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 36e5;
}

function accountIds(nodes, transactions) {
  const ids = new Set(nodes.filter((node) => node.type === "account").map((node) => node.id));
  for (const tx of transactions) {
    if (String(tx.origin).startsWith("acct") || String(tx.origin).startsWith("a-")) ids.add(tx.origin);
    if (String(tx.destination).startsWith("acct") || String(tx.destination).startsWith("a-")) ids.add(tx.destination);
  }
  return [...ids].sort();
}

export function buildAccountFeatureRows({
  nodes = FRAUD_NODES,
  transactions = FRAUD_TRANSACTIONS,
  labels = {},
  settings = FRAUD_DEFAULT_SETTINGS,
} = {}) {
  const includeInfrastructure = settings.includeInfrastructure ?? true;
  return accountIds(nodes, transactions).map((accountId) => {
    const inbound = transactions.filter((tx) => tx.destination === accountId && Number(tx.amount) > 0);
    const outbound = transactions.filter((tx) => tx.origin === accountId && Number(tx.amount) > 0);
    const infra = transactions.filter((tx) =>
      Number(tx.amount) === 0 && (tx.origin === accountId || tx.destination === accountId)
    );
    const inboundAmount = inbound.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const outboundAmount = outbound.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const fastest = inbound.length && outbound.length
      ? Math.min(...inbound.flatMap((inTx) => outbound.map((outTx) => hoursBetween(inTx.at, outTx.at))))
      : 999;
    const allMoney = inbound.concat(outbound);
    const roundCount = allMoney.filter((tx) => Number(tx.amount) % 100 === 0 || Number(tx.amount) % 50 === 0).length;
    const uniqueCounterparties = new Set(allMoney.flatMap((tx) => [tx.origin, tx.destination]).filter((id) => id !== accountId));
    const features = {
      inboundOrigins: new Set(inbound.map((tx) => tx.origin)).size,
      outboundDestinations: new Set(outbound.map((tx) => tx.destination)).size,
      passThroughRatio: inboundAmount ? Math.min(1.5, outboundAmount / inboundAmount) : 0,
      rapidPassThrough: fastest <= 3 ? 1 : 0,
      roundAmountShare: allMoney.length ? roundCount / allMoney.length : 0,
      infrastructureTouch: includeInfrastructure && infra.length ? 1 : 0,
      bridgeCentrality: uniqueCounterparties.size,
    };
    return {
      accountId,
      label: nodes.find((node) => node.id === accountId)?.label ?? accountId,
      features,
      featureVector: FEATURE_NAMES.map((name) => features[name]),
      labelValue: labels[accountId],
      dependencies: allMoney.concat(infra).map((tx) => tx.id),
    };
  });
}

function trainingScenarios() {
  return [
    { id: "known-mule-bridge", x: [3, 2, 0.95, 1, 0.8, 1, 5], y: 1 },
    { id: "smurfed-mule-bridge", x: [4, 3, 1.05, 1, 0.5, 0, 7], y: 1 },
    { id: "cashout-bridge", x: [2, 2, 0.88, 1, 0.7, 1, 4], y: 1 },
    { id: "collection-only", x: [3, 1, 0.2, 0, 0.6, 0, 4], y: 0 },
    { id: "cashout-only", x: [1, 0, 0, 0, 0.8, 0, 1], y: 0 },
    { id: "payroll-hub", x: [1, 8, 1.0, 1, 0.9, 0, 9], y: 0 },
    { id: "refund-processor", x: [8, 8, 1.0, 0, 0.4, 0, 16], y: 0 },
    { id: "shared-device-family", x: [1, 1, 0.5, 0, 0.2, 1, 2], y: 0 },
    { id: "batch-settlement", x: [2, 6, 1.1, 1, 0.7, 0, 8], y: 0 },
  ];
}

function standardizer(rows) {
  const means = FEATURE_NAMES.map((_, index) => rows.reduce((sum, row) => sum + row.x[index], 0) / rows.length);
  const scales = FEATURE_NAMES.map((_, index) => {
    const variance = rows.reduce((sum, row) => sum + (row.x[index] - means[index]) ** 2, 0) / rows.length;
    return Math.sqrt(variance) || 1;
  });
  return {
    transform: (x) => x.map((value, index) => (value - means[index]) / scales[index]),
    means,
    scales,
  };
}

export function trainLocalReviewModel({
  rows = buildAccountFeatureRows(),
  epochs = 240,
  learningRate = 0.18,
} = {}) {
  const scenarioRows = trainingScenarios();
  const labeledRows = rows
    .filter((row) => typeof row.labelValue === "boolean")
    .map((row) => ({ id: row.accountId, x: row.featureVector, y: row.labelValue ? 1 : 0 }));
  const trainRows = scenarioRows.concat(labeledRows);
  const scaler = standardizer(trainRows);
  let weights = FEATURE_NAMES.map(() => 0);
  let bias = 0;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    for (const row of trainRows) {
      const x = scaler.transform(row.x);
      const prediction = sigmoid(bias + weights.reduce((sum, weight, index) => sum + weight * x[index], 0));
      const error = prediction - row.y;
      weights = weights.map((weight, index) => weight - learningRate * error * x[index] / trainRows.length);
      bias -= learningRate * error / trainRows.length;
    }
  }
  const predictions = rows.map((row) => {
    const x = scaler.transform(row.featureVector);
    const score = sigmoid(bias + weights.reduce((sum, weight, index) => sum + weight * x[index], 0));
    const contributions = FEATURE_NAMES.map((name, index) => ({
      feature: name,
      value: row.features[name],
      contribution: Number((weights[index] * x[index]).toFixed(3)),
    })).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    return {
      accountId: row.accountId,
      label: row.label,
      score: Number(score.toFixed(3)),
      status: score >= 0.67 ? "review-priority" : score >= 0.4 ? "watch" : "background",
      contributions,
      dependencies: row.dependencies,
    };
  }).sort((a, b) => b.score - a.score || a.accountId.localeCompare(b.accountId));
  const validation = scenarioRows.map((row) => {
    const x = scaler.transform(row.x);
    const score = sigmoid(bias + weights.reduce((sum, weight, index) => sum + weight * x[index], 0));
    return { id: row.id, label: row.y, score, predicted: score >= 0.5 ? 1 : 0 };
  });
  const tp = validation.filter((row) => row.label === 1 && row.predicted === 1).length;
  const fp = validation.filter((row) => row.label === 0 && row.predicted === 1).length;
  const fn = validation.filter((row) => row.label === 1 && row.predicted === 0).length;
  const tn = validation.filter((row) => row.label === 0 && row.predicted === 0).length;
  return {
    contract: "LocalReviewModelRunV1",
    algorithm: "browser-local logistic review-priority model",
    modelFamily: "classical ML over temporal graph features",
    featureNames: FEATURE_NAMES,
    trainingRows: trainRows.length,
    epochs,
    learningRate,
    metrics: {
      precision: Number((tp / Math.max(1, tp + fp)).toFixed(3)),
      recall: Number((tp / Math.max(1, tp + fn)).toFixed(3)),
      falsePositiveScenarios: fp,
      trueNegativeScenarios: tn,
    },
    model: {
      bias: Number(bias.toFixed(4)),
      weights: Object.fromEntries(FEATURE_NAMES.map((name, index) => [name, Number(weights[index].toFixed(4))])),
      scaler: {
        means: Object.fromEntries(FEATURE_NAMES.map((name, index) => [name, Number(scaler.means[index].toFixed(4))])),
        scales: Object.fromEntries(FEATURE_NAMES.map((name, index) => [name, Number(scaler.scales[index].toFixed(4))])),
      },
    },
    predictions,
    limitations: [
      "Runs locally on synthetic training scenarios and visible transaction features.",
      "Scores are review-priority predictions, not guilt, criminality, dangerousness, or enforcement recommendations.",
      "Production use still requires authorized training data, calibration, overreliance testing, and governance review.",
    ],
  };
}

export { FEATURE_NAMES };
