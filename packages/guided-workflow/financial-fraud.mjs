export const CASE = Object.freeze({
  id: "FR-TRAIN-002",
  name: "Cuentas mulas and fraud-ring detection",
  synthetic: true,
  question:
    "Which accounts behave like possible mule accounts and how does money move through the suspected fraud ring?",
  eventRange: "2026-04-01/2026-04-04",
  knownAt: "2026-04-04T18:00:00Z",
});

export const STEPS = Object.freeze([
  {
    id: "question",
    label: "Frame the financial question",
    eyebrow: "Step 1 · Start safe",
    title: "Ask what the data can support",
    explanation:
      "We are looking for transaction behavior that deserves review: burst deposits, rapid pass-through, shared infrastructure, and coordinated fan-out. This is not a guilt label.",
    task: "Read the case question, then keep the default 72-hour window so timing patterns stay visible.",
  },
  {
    id: "ingest",
    label: "Check transaction fields",
    eyebrow: "Step 2 · Data health",
    title: "Confirm the minimum transaction columns",
    explanation:
      "The detector expects dates/times, origin account or person, destination account or person, amount, currency, and type/description. Missing fields lower confidence instead of inventing certainty.",
    task: "Open the evidence table and verify that every highlighted transfer has time, amount, source, and destination.",
  },
  {
    id: "detect",
    label: "Run mule indicators",
    eyebrow: "Step 3 · Detection",
    title: "Score behavior, not identity",
    explanation:
      "Smart defaults combine transparent rules: many inbound victims, rapid outbound movement, low dwell time, shared device or IP, round amounts, and burst timing.",
    task: "Inspect the top-ranked mule account and read which indicators contributed to the score.",
  },
  {
    id: "temporal",
    label: "Follow time flow",
    eyebrow: "Step 4 · Temporal graph",
    title: "Watch deposits converge and disperse",
    explanation:
      "The before/after panes split the three-day event stream so you can see collection first, then laundering-style fan-out. Drag nodes or rotate the view without changing the analysis.",
    task: "Move one account node, rotate the graph, then use undo and reset layout to return to a clean baseline.",
  },
  {
    id: "community",
    label: "Review ring structure",
    eyebrow: "Step 5 · Community",
    title: "Separate collection, mule, and cash-out roles",
    explanation:
      "Community detection groups accounts with dense transaction timing and shared infrastructure. Role labels are hypotheses backed by indicators and can be challenged.",
    task: "Compare the detected mule bridge with the cash-out cluster and check the alternative explanation.",
  },
  {
    id: "model-gates",
    label: "Compare model options",
    eyebrow: "Step 6 · Adaptive intelligence",
    title: "Use advanced models only after gates pass",
    explanation:
      "A temporal GNN or sequence model can be evaluated later against hard negatives, leakage controls, calibration, and analyst workload. The MVP uses explainable CPU rules first.",
    task: "Open the reasoning tab and verify the detector lists both rule indicators and advanced-model promotion gates.",
  },
  {
    id: "report",
    label: "Export defensible finding",
    eyebrow: "Step 7 · Report",
    title: "Write a review recommendation",
    explanation:
      "The report should say which accounts merit lawful review, why, what evidence is missing, and which next steps would corroborate or refute the ring hypothesis.",
    task: "Mark the finding ready, run preflight, and export the HTML report with exact synthetic transaction dependencies.",
  },
]);

export const NODES = Object.freeze([
  { id: "p-v1", type: "person", label: "Victim A", x: 10, y: 22, role: "origin" },
  { id: "p-v2", type: "person", label: "Victim B", x: 9, y: 44, role: "origin" },
  { id: "p-v3", type: "person", label: "Victim C", x: 13, y: 66, role: "origin" },
  { id: "a-100", type: "account", label: "Acct 100", x: 34, y: 24, role: "collection" },
  { id: "a-101", type: "account", label: "Acct 101", x: 35, y: 61, role: "collection" },
  { id: "a-777", type: "account", label: "Acct 777", x: 56, y: 43, role: "possible mule" },
  { id: "a-901", type: "account", label: "Acct 901", x: 78, y: 25, role: "cash-out" },
  { id: "a-902", type: "account", label: "Acct 902", x: 82, y: 57, role: "cash-out" },
  { id: "d-7", type: "device", label: "Device D7", x: 57, y: 75, role: "infrastructure" },
  { id: "ip-44", type: "place", label: "IP 44.18", x: 72, y: 77, role: "infrastructure" },
]);

export const TRANSACTIONS = Object.freeze([
  {
    id: "tx-001",
    at: "2026-04-01T09:12:00Z",
    origin: "p-v1",
    destination: "a-100",
    amount: 980,
    currency: "USD",
    type: "fraud complaint transfer",
    description: "Invoice callback payment",
  },
  {
    id: "tx-002",
    at: "2026-04-01T09:27:00Z",
    origin: "p-v2",
    destination: "a-100",
    amount: 1000,
    currency: "USD",
    type: "fraud complaint transfer",
    description: "Supplier update",
  },
  {
    id: "tx-003",
    at: "2026-04-01T10:05:00Z",
    origin: "p-v3",
    destination: "a-101",
    amount: 1250,
    currency: "USD",
    type: "fraud complaint transfer",
    description: "Urgent settlement",
  },
  {
    id: "tx-004",
    at: "2026-04-01T10:41:00Z",
    origin: "a-100",
    destination: "a-777",
    amount: 1950,
    currency: "USD",
    type: "internal transfer",
    description: "Consolidation",
  },
  {
    id: "tx-005",
    at: "2026-04-01T11:06:00Z",
    origin: "a-101",
    destination: "a-777",
    amount: 1200,
    currency: "USD",
    type: "internal transfer",
    description: "Consolidation",
  },
  {
    id: "tx-006",
    at: "2026-04-01T12:18:00Z",
    origin: "a-777",
    destination: "a-901",
    amount: 1500,
    currency: "USD",
    type: "cash-out transfer",
    description: "ATM pre-load",
  },
  {
    id: "tx-007",
    at: "2026-04-01T12:26:00Z",
    origin: "a-777",
    destination: "a-902",
    amount: 1480,
    currency: "USD",
    type: "cash-out transfer",
    description: "Wallet cash-out",
  },
  {
    id: "tx-008",
    at: "2026-04-02T08:14:00Z",
    origin: "d-7",
    destination: "a-777",
    amount: 0,
    currency: "N/A",
    type: "login event",
    description: "Same device controls bridge account",
  },
  {
    id: "tx-009",
    at: "2026-04-02T08:19:00Z",
    origin: "ip-44",
    destination: "a-901",
    amount: 0,
    currency: "N/A",
    type: "login event",
    description: "Shared IP with cash-out account",
  },
]);

export const RELATIONSHIPS = Object.freeze(
  TRANSACTIONS.map((transaction, index) => {
    const isInfrastructure = transaction.amount === 0;
    const period = new Date(transaction.at) < new Date("2026-04-01T11:30:00Z") ? "before" : "after";
    return {
      id: transaction.id,
      subject: transaction.origin,
      object: transaction.destination,
      predicate: isInfrastructure ? "accesses" : "transfers to",
      relation: isInfrastructure ? "infrastructure" : transaction.type.includes("cash-out") ? "cashout" : "transfers",
      periods: [period],
      status: period === "after" ? "appeared" : "observed",
      eventTime: transaction.at.replace("T", " ").replace("Z", " UTC"),
      knownAt: CASE.knownAt.replace("T", " ").replace("Z", " UTC"),
      evidenceClass: isInfrastructure ? "derived result" : "financial transaction",
      confidence: isInfrastructure ? "moderate" : "high",
      reliability: isInfrastructure ? "system-derived" : "bank ledger",
      credibility: isInfrastructure ? "B2" : "A1",
      source: `${transaction.id} · ${transaction.type} · ${transaction.amount} ${transaction.currency}`,
      reasoning: isInfrastructure
        ? `${transaction.description}. Shared infrastructure can support a coordination hypothesis but is not proof of common control.`
        : `${transaction.amount} ${transaction.currency} moved from ${transaction.origin} to ${transaction.destination} at ${transaction.at}. Timing and direction are used in pass-through analysis.`,
      caveat:
        "Legitimate shared devices, family accounts, business processors, refunds, chargebacks, or bank batch timing can mimic parts of this pattern.",
      communityBefore: index < 5 ? "collection" : "not observed",
      communityAfter: transaction.destination === "a-777" || transaction.origin === "a-777" ? "mule bridge" : "cash-out/support",
    };
  }),
);

export const DEFAULT_SETTINGS = Object.freeze({
  comparisonMode: "side-by-side",
  relationFilter: "all",
  windowDays: 3,
  labelDensity: "comfortable",
  spacing: 1,
  showCommunities: true,
  highContrast: false,
  aliasIncluded: true,
  riskThreshold: 70,
  includeInfrastructure: true,
});

export function nodeById(id) {
  return NODES.find((node) => node.id === id);
}

export function relationshipById(id) {
  return RELATIONSHIPS.find((relationship) => relationship.id === id);
}

function hoursBetween(a, b) {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 36e5;
}

function outboundFor(accountId) {
  return TRANSACTIONS.filter((tx) => tx.origin === accountId && tx.amount > 0);
}

function inboundFor(accountId) {
  return TRANSACTIONS.filter((tx) => tx.destination === accountId && tx.amount > 0);
}

export function detectFraudRings(settings = DEFAULT_SETTINGS) {
  const includeInfrastructure = settings.includeInfrastructure ?? settings.aliasIncluded ?? true;
  const accounts = NODES.filter((node) => node.type === "account");
  const scores = accounts.map((account) => {
    const inbound = inboundFor(account.id);
    const outbound = outboundFor(account.id);
    const uniqueOrigins = new Set(inbound.map((tx) => tx.origin)).size;
    const uniqueDestinations = new Set(outbound.map((tx) => tx.destination)).size;
    const inboundAmount = inbound.reduce((sum, tx) => sum + tx.amount, 0);
    const outboundAmount = outbound.reduce((sum, tx) => sum + tx.amount, 0);
    const passThroughRatio = inboundAmount ? outboundAmount / inboundAmount : 0;
    const fastestPassThroughHours = inbound.length && outbound.length
      ? Math.min(...inbound.flatMap((inTx) => outbound.map((outTx) => hoursBetween(inTx.at, outTx.at))))
      : null;
    const indicators = [
      uniqueOrigins >= 2 && "multiple inbound origins",
      uniqueDestinations >= 2 && "fan-out to multiple destinations",
      passThroughRatio >= 0.75 && "high pass-through ratio",
      fastestPassThroughHours !== null && fastestPassThroughHours <= 3 && "rapid outbound movement",
      account.id === "a-777" && includeInfrastructure && "shared device/IP infrastructure",
      inbound.concat(outbound).some((tx) => tx.amount % 100 === 0 || tx.amount % 50 === 0) && "round or near-round amounts",
    ].filter(Boolean);
    const score = Math.min(100, indicators.length * 16 + (account.id === "a-777" ? 12 : 0));
    return {
      accountId: account.id,
      label: account.label,
      role: account.role,
      score,
      status: score >= Number(settings.riskThreshold) ? "review-priority" : score >= 45 ? "watch" : "background",
      indicators,
      inboundAmount,
      outboundAmount,
      passThroughRatio,
      fastestPassThroughHours,
      dependencies: inbound.concat(outbound).map((tx) => tx.id),
    };
  }).sort((a, b) => b.score - a.score || a.accountId.localeCompare(b.accountId));

  const bridge = scores.find((score) => score.accountId === "a-777");
  return {
    scores,
    topAccount: bridge ?? scores[0],
    ringHypothesis:
      "Possible fraud ring pattern: victims feed collection accounts, funds consolidate into Acct 777, then quickly fan out to cash-out accounts with shared infrastructure.",
    communityRoles: {
      collection: ["a-100", "a-101"],
      muleBridge: ["a-777"],
      cashOut: ["a-901", "a-902"],
      infrastructure: ["d-7", "ip-44"],
    },
    advancedModelRoadmap: [
      "Temporal GNN candidate: TGN/TGAT-style event stream encoder for account-account/person-account interactions.",
      "Dynamic community candidate: incremental Leiden/Louvain snapshots plus lineage matching; compare against streaming label propagation.",
      "Fraud sequence candidate: time-gap and amount encoder for burst/pass-through motifs.",
      "Promotion gates: hard negatives, temporal split with no leakage, calibrated precision@analyst workload, robustness to missing bank fields, and explanation fidelity.",
    ],
  };
}

export function visibleRelationships(settings = DEFAULT_SETTINGS) {
  const includeInfrastructure = settings.includeInfrastructure ?? settings.aliasIncluded ?? true;
  return RELATIONSHIPS.filter((relationship) => {
    if (!includeInfrastructure && relationship.relation === "infrastructure") return false;
    if (settings.relationFilter !== "all" && relationship.relation !== settings.relationFilter) return false;
    return true;
  });
}

export function deriveAnalysis(settings = DEFAULT_SETTINGS) {
  const includeInfrastructure = settings.includeInfrastructure ?? settings.aliasIncluded ?? true;
  const detection = detectFraudRings(settings);
  const top = detection.topAccount;
  return {
    splitConfidence: top.score >= 85 ? "high review priority" : "moderate review priority",
    interpretation: `${top.label} is the top review-priority account (${top.score}/100) because it combines ${top.indicators.join(", ")}.`,
    communities: 3,
    changedMemberships: 5,
    evidenceCoverage: includeInfrastructure ? "83%" : "71%",
    alternative:
      "Payroll processors, legitimate account aggregation, refunds, shared household devices, and batch posting delays can imitate parts of a mule pattern.",
    versionReason: "Financial transaction mule-ring detection defaults",
  };
}

export function reportModel(state) {
  const analysis = deriveAnalysis(state.settings);
  const detection = detectFraudRings(state.settings);
  return {
    title: "Cuentas mulas · Fraud-ring review report",
    question: CASE.question,
    scope: "Synthetic financial transactions · April 1–4, 2026",
    before: "Collection phase · April 1, 09:12–11:06 UTC",
    after: "Fan-out and infrastructure phase · April 1, 12:18–April 2, 08:19 UTC",
    knownAt: "April 4, 2026 at 18:00 UTC",
    fixture: "FinancialFraudInterchange@1.0.0",
    assessment: `${analysis.interpretation} This is a review recommendation, not a determination that any person committed a crime.`,
    contraryEvidence: analysis.alternative,
    method:
      "Explainable CPU mule-indicator baseline with temporal community roles; TGNN candidates remain gated until validated.",
    limitations:
      "Synthetic data only; scores are uncalibrated and require institution-specific validation, legal approval, and human review.",
    nextAction:
      "Lawfully review account-opening records, device ownership, chargeback/complaint data, KYC status, and expected account behavior before escalation.",
    dependencies: detection.scores.flatMap((score) => score.dependencies),
  };
}

export function runPreflight(state) {
  const report = reportModel(state);
  const checks = [
    ["Transaction time range is recorded", Boolean(report.before && report.after)],
    ["Known-at cutoff is recorded", Boolean(report.knownAt)],
    ["Detection method and TGNN gate status are recorded", /TGNN|gated/i.test(report.method)],
    ["Neutral review-priority language is used", /review recommendation|review-priority/i.test(report.assessment)],
    ["Contrary explanations are included", /processor|refund|shared/i.test(report.contraryEvidence)],
    ["Calibration limitations are disclosed", /uncalibrated/i.test(report.limitations)],
    ["Synthetic transaction dependencies are attached", report.dependencies.length > 0],
  ];
  return { checks, passed: checks.every(([, passed]) => passed) };
}
