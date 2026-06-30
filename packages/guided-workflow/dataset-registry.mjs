const externalAdapter = "External adapter only. Download, license acceptance, schema mapping, leakage checks, and local artifact validation must happen outside the static GitHub Pages app.";

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
    name: "Temporal Graph Benchmark / TGB 2.0 adapters",
    domain: "large temporal graph benchmarks",
    availability: "external-adapter",
    synthetic: false,
    benchmarkDerived: true,
    sourceNote: "TGB/TGB 2.0 and TGX maintained temporal graph benchmark catalogs; candidate families include Wikipedia, Reddit, review, trade, genre, flight, token, and other temporal link/node prediction tasks.",
    licenseNote: "Dataset-specific licenses include noncommercial terms; do not vendor without review.",
    dataBoundary: externalAdapter,
    taskTypes: ["temporal link prediction", "node prediction", "temporal evaluation", "chronological split validation"],
    allowedClaims: ["adapter candidate", "benchmark evaluation target", "temporal model testbed"],
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
    dataBoundary: "Do not embed named or sensitive criminal-network rows until original source, consent/license, and person-identifiability risks are reviewed.",
    taskTypes: ["illicit-transaction benchmark", "temporal graph classification", "transaction risk scoring evaluation"],
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
    dataBoundary: "Generator output is not bundled. Generate, sample, and validate artifacts locally before importing CSV/JSON into the website.",
    taskTypes: ["synthetic AML generation", "hard-negative benchmark expansion", "transaction anomaly scoring"],
    allowedClaims: ["future generator integration", "synthetic AML benchmark source"],
    prohibitedClaims: ["real banking data", "production profitability", "validated SOTA"],
  },
  {
    id: "paysim-mobile-money-adapter",
    name: "PaySim mobile-money fraud adapter",
    domain: "synthetic mobile-money fraud transactions",
    availability: "external-adapter",
    synthetic: true,
    benchmarkDerived: true,
    sourceNote: "PaySim is a synthetic mobile-money transaction simulator/dataset commonly used for fraud experiments.",
    licenseNote: "Often distributed through third-party portals; require source and license review before download.",
    dataBoundary: externalAdapter,
    taskTypes: ["transaction fraud classification", "imbalance stress test", "hard-negative transaction review"],
    allowedClaims: ["candidate synthetic fraud benchmark"],
    prohibitedClaims: ["real banking data", "profitability claim", "production fraud model"],
  },
  {
    id: "ieee-cis-fraud-adapter",
    name: "IEEE-CIS transaction fraud adapter",
    domain: "tabular transaction fraud benchmark",
    availability: "external-adapter",
    synthetic: false,
    benchmarkDerived: true,
    sourceNote: "IEEE-CIS is a widely used transaction fraud benchmark for tabular risk features rather than graph-native evidence.",
    licenseNote: "Kaggle/competition terms and credentials are required; do not redistribute in this repo.",
    dataBoundary: externalAdapter,
    taskTypes: ["tabular fraud baseline", "feature leakage stress test", "graph-enrichment comparison"],
    allowedClaims: ["external benchmark adapter candidate"],
    prohibitedClaims: ["included data", "graph SOTA claim", "production fraud decision"],
  },
  {
    id: "dgraph-fin-adapter",
    name: "DGraph-Fin financial graph adapter",
    domain: "large financial graph anomaly benchmark",
    availability: "external-adapter",
    synthetic: false,
    benchmarkDerived: true,
    sourceNote: "DGraph-Fin is a large-scale financial graph benchmark used for graph anomaly detection research.",
    licenseNote: "External dataset terms and storage constraints require review before use.",
    dataBoundary: externalAdapter,
    taskTypes: ["node anomaly detection", "financial risk scoring", "graph neural network evaluation"],
    allowedClaims: ["large-scale adapter target", "offline evaluation dataset"],
    prohibitedClaims: ["embedded data", "calibrated operational score", "person-level conclusion"],
  },
  {
    id: "gadbench-adapter",
    name: "GADBench graph anomaly suite adapter",
    domain: "graph anomaly detection benchmark suite",
    availability: "external-adapter",
    synthetic: false,
    benchmarkDerived: true,
    sourceNote: "GADBench-style suites cover public anomaly datasets such as YelpChi, Amazon, Weibo, Reddit, and other graph anomaly baselines.",
    licenseNote: "Each constituent dataset has separate provenance and licensing; adapter must preserve dataset-specific terms.",
    dataBoundary: externalAdapter,
    taskTypes: ["graph anomaly detection", "false-positive stress testing", "model-family benchmark"],
    allowedClaims: ["adapter-suite candidate", "offline benchmark portfolio"],
    prohibitedClaims: ["single operational truth source", "embedded labels", "production SOTA"],
  },
  {
    id: "orbitaal-aml-adapter",
    name: "ORBITAAL-style AML benchmark adapter",
    domain: "anti-money-laundering transaction graph benchmark",
    availability: "external-adapter",
    synthetic: false,
    benchmarkDerived: true,
    sourceNote: "ORBITAAL-style AML benchmarks target laundering-pattern detection on transaction graphs.",
    licenseNote: "Use only after source, license, and sensitivity review; do not copy benchmark rows into the static app.",
    dataBoundary: externalAdapter,
    taskTypes: ["AML transaction graph evaluation", "motif/path risk scoring", "temporal GNN candidate testing"],
    allowedClaims: ["adapter candidate for AML evaluation"],
    prohibitedClaims: ["included AML data", "law-enforcement conclusion", "production model"],
  },
  {
    id: "snap-temporal-communication-adapter",
    name: "SNAP temporal communication adapters",
    domain: "temporal communication graph baselines",
    availability: "external-adapter",
    synthetic: false,
    benchmarkDerived: true,
    sourceNote: "SNAP temporal datasets such as email-Eu-core-temporal and email-Enron support temporal communication experiments.",
    licenseNote: "Public research data still contains communication-derived records; review sensitivity before use.",
    dataBoundary: externalAdapter,
    taskTypes: ["temporal link prediction", "communication community analysis", "missingness stress test"],
    allowedClaims: ["communication benchmark adapter"],
    prohibitedClaims: ["criminal network", "embedded personal communication data", "production monitoring"],
  },
  {
    id: "sociopatterns-contact-adapter",
    name: "SocioPatterns contact-network adapters",
    domain: "temporal proximity/contact networks",
    availability: "external-adapter",
    synthetic: false,
    benchmarkDerived: true,
    sourceNote: "SocioPatterns contact datasets provide temporal proximity interactions useful for dynamic community and contact-network tests.",
    licenseNote: "Review dataset terms and participant privacy before use.",
    dataBoundary: externalAdapter,
    taskTypes: ["dynamic community detection", "contact-network temporal split", "bridge uncertainty testing"],
    allowedClaims: ["temporal contact benchmark adapter"],
    prohibitedClaims: ["covert group evidence", "embedded participant data", "operational conclusion"],
  },
  {
    id: "networkrepository-crime-adapter",
    name: "Network Repository crime/co-offending adapters",
    domain: "criminology and co-offending graph references",
    availability: "external-adapter",
    synthetic: false,
    benchmarkDerived: true,
    sourceNote: "Network Repository and criminology mirrors include crime, co-offending, and organizational network references useful for topology tests.",
    licenseNote: "Do not embed named or sensitive criminal-network rows until original source, consent/license, and person-identifiability risks are reviewed.",
    dataBoundary: "Do not embed named or sensitive criminal-network rows until original source, consent/license, and person-identifiability risks are reviewed.",
    taskTypes: ["community topology stress test", "co-offending graph adapter", "sensitivity and wording review"],
    allowedClaims: ["topology benchmark candidate"],
    prohibitedClaims: ["real gang detection", "proof of criminal membership", "embedded sensitive network"],
  },
  {
    id: "ucinet-crime-network-adapter",
    name: "UCINET classic crime-network adapters",
    domain: "small criminology network references",
    availability: "external-adapter",
    synthetic: false,
    benchmarkDerived: true,
    sourceNote: "Classic UCINET-style crime-network examples are useful for tiny topology and centrality sanity checks.",
    licenseNote: "Use only after original dataset and license review; named historical networks can be sensitive.",
    dataBoundary: externalAdapter,
    taskTypes: ["centrality sanity check", "community split example", "explanation wording test"],
    allowedClaims: ["small topology adapter candidate"],
    prohibitedClaims: ["current operational intelligence", "criminal gang proof", "included sensitive data"],
  },
  {
    id: "synthetic-criminal-network-generator",
    name: "Synthetic criminal-network generator",
    domain: "safe generated covert-network scenarios",
    availability: "external-generator",
    synthetic: true,
    benchmarkDerived: false,
    sourceNote: "Purpose-built synthetic generator target for safe gang/community, hierarchy, bridge, and transaction-link scenarios.",
    licenseNote: "Generated project fixtures may be embedded only after curation and prohibited-claim review.",
    dataBoundary: "Generate locally, review for safe fictional labels, then import as curated fixture or CSV/JSON.",
    taskTypes: ["community detection", "suspicious transaction simulation", "risk scoring walkthrough", "ELI5 training examples"],
    allowedClaims: ["safe synthetic scenario target"],
    prohibitedClaims: ["real criminal data", "validated against operational gangs", "production prediction"],
  },
]);

export const DATASET_INTEGRATION_STEPS = Object.freeze([
  "Confirm source, license, redistribution rights, sensitivity, and whether rows describe real people or organizations.",
  "Download outside the static site and preserve source checksums, schema notes, label definitions, and time cutoffs.",
  "Map rows into NAPP entities, relationships, timestamps, amounts, labels, and source dependencies with explicit rejected-row reporting.",
  "Run leakage checks, hard-negative splits, calibration gates, and wording gates before any model claim.",
  "Import a curated CSV/JSON slice through the website, preview mapping, apply accepted rows, run local analysis, inspect evidence, acknowledge recommendations, and run report preflight.",
]);

export function listDatasets() {
  return DATASETS.map((dataset) => ({ ...dataset }));
}

export function datasetCoverageSummary() {
  const datasets = listDatasets();
  return {
    total: datasets.length,
    embedded: datasets.filter((dataset) => dataset.availability === "embedded").length,
    externalAdapters: datasets.filter((dataset) => dataset.availability === "external-adapter").length,
    externalGenerators: datasets.filter((dataset) => dataset.availability === "external-generator").length,
  };
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

const transactionDemoCsv = (prefix, focus = "acct-777") => `transaction_id,timestamp,origin_id,origin_kind,destination_id,destination_kind,amount,currency,type,description,expected_account_id,expected_review_priority
${prefix}-001,2026-05-10T09:00:00Z,source-a,person,collector-1,account,1200,USD,fraud complaint transfer,Dataset-adapter demo inbound,${focus},true
${prefix}-002,2026-05-10T09:08:00Z,source-b,person,collector-2,account,980,USD,fraud complaint transfer,Dataset-adapter demo inbound,${focus},true
${prefix}-003,2026-05-10T09:50:00Z,collector-1,account,${focus},account,1180,USD,internal transfer,Rapid consolidation,${focus},true
${prefix}-004,2026-05-10T09:58:00Z,collector-2,account,${focus},account,965,USD,internal transfer,Rapid consolidation,${focus},true
${prefix}-005,2026-05-10T10:20:00Z,${focus},account,cashout-1,account,1075,USD,cash-out transfer,Cash-out fan-out,${focus},true
${prefix}-006,2026-05-10T10:28:00Z,${focus},account,cashout-2,account,1015,USD,cash-out transfer,Cash-out fan-out,${focus},true
${prefix}-007,2026-05-10T11:20:00Z,merchant-processor,account,customer-refund,person,120,USD,refund,Hard-negative legitimate refund,${focus},false
${prefix}-008,2026-05-10T11:25:00Z,shared-device-1,device,${focus},account,0,N/A,login event,Infrastructure context only,${focus},true`;

function recommendedUseCase(dataset) {
  if (dataset.id === "synthetic-criminal-network-generator") return "dojo";
  const text = `${dataset.domain} ${dataset.taskTypes.join(" ")}`.toLowerCase();
  if (/transaction|fraud|aml|money|financial|risk|anomaly/.test(text)) return "fraud";
  if (/community|contact|crime|co-offending|centrality|dojo/.test(text)) return "dojo";
  return "harbor";
}

export function datasetUseCaseResults(datasetId) {
  const dataset = getDataset(datasetId);
  const recommended = recommendedUseCase(dataset);
  const embedded = embeddedWorkflowId(datasetId);
  const statusFor = (useCase) => {
    if (embedded) return embedded === useCase ? "runs-now" : "supporting-benchmark";
    if (recommended !== useCase) return "requires-adapter-mapping";
    return useCase === "fraud" ? "matched-safe-demo-slice" : "matched-safe-demo-flow";
  };
  return [
    {
      useCase: "harbor",
      label: "Temporal split investigation",
      status: statusFor("harbor"),
      result: recommended === "harbor"
        ? "Temporal comparison, no-split/unified review, auto split, and report preflight."
        : "Use for temporal stress tests after mapping relationships and known-at cutoffs.",
      aiMl: "Deterministic temporal/community reasoning; no LLM or production model.",
    },
    {
      useCase: "dojo",
      label: "Community detection benchmark",
      status: statusFor("dojo"),
      result: recommended === "dojo"
        ? "Deterministic label-propagation community analysis with bridge-member uncertainty."
        : "Use for topology and community sanity checks after adapter mapping.",
      aiMl: "CPU deterministic community baseline; calibrated false; no GenAI.",
    },
    {
      useCase: "fraud",
      label: "Transaction anomaly and local ML",
      status: statusFor("fraud"),
      result: recommended === "fraud"
        ? "Safe synthetic slice can be imported, previewed, scored, trained locally, and report-gated."
        : "Only use if the source is converted into transaction CSV/JSON with labels and cutoffs.",
      aiMl: "Deterministic anomaly scorer plus browser-local logistic review-priority model; calibrated false; no LLM/API.",
    },
  ];
}

export function datasetDataUseStatus(datasetId) {
  const dataset = getDataset(datasetId);
  const embedded = embeddedWorkflowId(datasetId);
  if (embedded) {
    const counts = {
      harbor: "all 7 embedded entities, 9 relationships, and 6 dated evidence records",
      fraud: "all 12 embedded entities and 13 transaction/context relationships",
      dojo: "all 34 benchmark-derived members and 78 club interactions",
    };
    return {
      status: "all-embedded-data",
      canUseAllRowsInBrowser: true,
      label: `Full-data mode: the ${embedded} workflow uses ${counts[embedded]}.`,
    };
  }
  return {
    status: "external-adapter-required",
    canUseAllRowsInBrowser: false,
    label: `Full-data mode: ${dataset.name} rows are not bundled. Use the adapter steps to download, license-check, map, validate, and import all source nodes, edges, timestamps, labels, and features outside this static demo.`,
  };
}

export function recommendedUseCaseForDataset(datasetId) {
  return embeddedWorkflowId(datasetId) ?? recommendedUseCase(getDataset(datasetId));
}

export function safeDemoSliceForDataset(datasetId) {
  const dataset = getDataset(datasetId);
  const recommended = recommendedUseCase(dataset);
  if (embeddedWorkflowId(datasetId)) return null;
  const prefix = datasetId.split("-").slice(0, 2).join("-").replaceAll(/[^a-z0-9]/gi, "").slice(0, 12) || "adapter";
  if (recommended !== "fraud") {
    const workflow = recommended;
    const counts = workflow === "dojo"
      ? { nodes: 34, edges: 78, datapoints: 78 }
      : { nodes: 7, edges: 9, datapoints: 15 };
    return {
      kind: "matched-flow",
      format: "workflow",
      workflow,
      label: `${dataset.name} safe ${workflow} demo flow`,
      caveat: "This opens the closest embedded workflow with all of its curated nodes, edges, and datapoints. It is not a row sample from the external dataset.",
      ...counts,
    };
  }
  return {
    kind: "transaction-import",
    format: "csv",
    label: `${dataset.name} safe synthetic transaction slice`,
    caveat: "This is a schema-compatible synthetic slice inspired by the adapter family. It is not a row sample from the external dataset.",
    rows: 8,
    content: transactionDemoCsv(prefix),
  };
}
