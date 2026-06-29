import { buildAccountFeatureRows } from "./local-trainer.mjs";

const SUPPRESSOR_PATTERNS = [
  [/payroll|salary/i, "payroll or salary hub pattern"],
  [/refund|reversal|chargeback/i, "refund or reversal pattern"],
  [/processor|merchant|settlement/i, "legitimate processor pattern"],
  [/batch/i, "bank batch timing pattern"],
];

function contributionRows(row) {
  return [
    row.features.inboundOrigins >= 2 && ["multiple inbound origins", 18],
    row.features.outboundDestinations >= 2 && ["fan-out destinations", 18],
    row.features.passThroughRatio >= 0.75 && ["high pass-through ratio", 18],
    row.features.rapidPassThrough && ["rapid pass-through", 18],
    row.features.roundAmountShare >= 0.5 && ["round amount concentration", 10],
    row.features.infrastructureTouch && ["shared infrastructure touch", 10],
    row.features.bridgeCentrality >= 4 && ["bridge-like counterparty span", 8],
  ].filter(Boolean).map(([feature, points]) => ({ feature, points }));
}

function suppressorsFor(row, transactionText = "") {
  return SUPPRESSOR_PATTERNS
    .filter(([pattern]) => pattern.test(transactionText))
    .map(([, label]) => label);
}

export function scoreTransactionAnomalies({
  nodes = [],
  transactions = [],
  labels = {},
  settings = {},
} = {}) {
  const rows = buildAccountFeatureRows({ nodes, transactions, labels, settings });
  const transactionText = transactions
    .map((tx) => `${tx.id} ${tx.type ?? ""} ${tx.description ?? ""}`)
    .join(" ");
  const predictions = rows.map((row) => {
    const contributions = contributionRows(row);
    const suppressors = suppressorsFor(row, transactionText);
    const rawScore = contributions.reduce((sum, item) => sum + item.points, 0);
    const score = Math.max(0, Math.min(100, rawScore - suppressors.length * 22));
    return {
      accountId: row.accountId,
      label: row.label,
      score,
      status: score >= 70 ? "review-priority" : score >= 40 ? "watch" : "background",
      calibrated: false,
      contributions,
      suppressors,
      dependencies: row.dependencies,
      explanation: contributions.length
        ? `${row.label} combines ${contributions.map((item) => item.feature).join(", ")}.`
        : `${row.label} has no strong anomaly indicators in the visible training rows.`,
    };
  }).sort((a, b) => b.score - a.score || a.accountId.localeCompare(b.accountId));
  return {
    contract: "TransactionAnomalyScorerV1",
    algorithm: "deterministic temporal transaction anomaly scorer",
    calibrated: false,
    productionPredictionsEnabled: false,
    rows: rows.length,
    predictions,
    benchmark: {
      labeledRows: Object.keys(labels).length,
      hardNegativeRequired: true,
      leakageReportRequired: true,
    },
    limitations: [
      "Scores are uncalibrated review-priority indicators for training.",
      "Hard-negative and leakage-safe evaluation are required before any production use.",
    ],
    prohibitedUse: "Do not use as proof of fraud, guilt, profitability, or a production prediction.",
  };
}
