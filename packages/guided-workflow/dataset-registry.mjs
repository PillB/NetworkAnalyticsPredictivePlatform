const DATASETS = Object.freeze([
  {
    id: "harbor-lantern-v1",
    name: "Harbor Lantern temporal split",
    domain: "temporal community investigation",
    availability: "embedded",
    synthetic: true,
    benchmarkDerived: false,
    sourceNote: "Original fictional fixture authored for this training application.",
    licenseNote: "Project training fixture; no operational data.",
    taskTypes: ["temporal comparison", "community lineage", "report preflight"],
    allowedClaims: ["guided training workflow", "synthetic temporal reasoning"],
    prohibitedClaims: ["real criminal network", "production prediction", "ground-truth guilt"],
  },
  {
    id: "financial-fraud-synthetic-v1",
    name: "Synthetic cuentas mulas transaction flow",
    domain: "financial transaction anomaly review",
    availability: "embedded",
    synthetic: true,
    benchmarkDerived: false,
    sourceNote: "Original synthetic transaction-flow fixture with hard-negative patterns.",
    licenseNote: "Project training fixture; no operational banking data.",
    taskTypes: ["transaction anomaly scoring", "mule-account review priority", "local model training"],
    allowedClaims: ["browser-local training", "uncalibrated review-priority indicator"],
    prohibitedClaims: ["profitability", "production fraud prediction", "person-level guilt"],
  },
  {
    id: "dojo-karate-split-v1",
    name: "Dojo club split benchmark",
    domain: "community detection benchmark",
    availability: "embedded",
    synthetic: false,
    benchmarkDerived: true,
    sourceNote: "Benchmark-derived teaching fixture inspired by Zachary's karate club fission dataset.",
    licenseNote: "Small attributed benchmark-derived fixture; keep citation and do not claim operational data.",
    taskTypes: ["community detection", "split agreement", "bridge-member uncertainty"],
    allowedClaims: ["benchmark-derived community walkthrough", "deterministic label-propagation agreement"],
    prohibitedClaims: ["criminal gang proof", "real covert network", "production SOTA model"],
  },
  {
    id: "tgb-adapter-catalog",
    name: "Temporal Graph Benchmark adapters",
    domain: "large temporal graph benchmarks",
    availability: "external-adapter",
    synthetic: false,
    benchmarkDerived: true,
    sourceNote: "TGB/TGX maintained temporal graph benchmark catalog; large datasets require explicit download.",
    licenseNote: "Dataset-specific licenses include noncommercial terms; do not vendor without review.",
    taskTypes: ["temporal link prediction", "node prediction", "temporal evaluation"],
    allowedClaims: ["adapter candidate", "benchmark evaluation target"],
    prohibitedClaims: ["embedded dataset", "validated SOTA result", "production model"],
  },
  {
    id: "elliptic-aml-adapter",
    name: "Elliptic / Elliptic++ crypto graph adapters",
    domain: "crypto transaction illicit-label benchmark",
    availability: "external-adapter",
    synthetic: false,
    benchmarkDerived: true,
    sourceNote: "Public crypto graph benchmarks with licit/illicit/unknown labels and temporal steps.",
    licenseNote: "External hosting/license review required before use; do not embed here.",
    taskTypes: ["illicit-transaction benchmark", "temporal graph classification"],
    allowedClaims: ["future adapter target", "requires leakage-safe evaluation"],
    prohibitedClaims: ["included training data", "calibrated fraud prediction", "person-level conclusion"],
  },
  {
    id: "ibm-amlsim-generator",
    name: "IBM AMLSim synthetic generator adapter",
    domain: "synthetic AML transaction generation",
    availability: "external-generator",
    synthetic: true,
    benchmarkDerived: true,
    sourceNote: "AMLSim can generate synthetic transaction networks with known AML typologies.",
    licenseNote: "Apache-2.0 code, generated outputs should be produced outside this static repo.",
    taskTypes: ["synthetic AML generation", "hard-negative benchmark expansion"],
    allowedClaims: ["future generator integration", "synthetic AML benchmark source"],
    prohibitedClaims: ["real banking data", "production profitability", "validated SOTA"],
  },
]);

export function listDatasets() {
  return DATASETS.map((dataset) => ({ ...dataset }));
}

export function getDataset(id) {
  const dataset = DATASETS.find((entry) => entry.id === id);
  if (!dataset) throw new Error(`Unknown dataset: ${id}`);
  return { ...dataset };
}

export function embeddedWorkflowId(datasetId) {
  const map = {
    "harbor-lantern-v1": "harbor",
    "financial-fraud-synthetic-v1": "fraud",
    "dojo-karate-split-v1": "dojo",
  };
  return map[datasetId] ?? null;
}
