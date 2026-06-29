import {
  evaluateCommunitySplit,
  labelPropagationCommunities,
} from "../predictive/community-baselines.mjs";

export const CASE = Object.freeze({
  id: "DOJO-TRAIN-001",
  name: "Dojo club split benchmark",
  synthetic: false,
  benchmarkDerived: true,
  question:
    "Can an automatic community detector recover a club split and identify bridge members that need cautious review?",
  eventRange: "Benchmark season · weeks 1-8",
  knownAt: "2026-06-01T12:00:00Z",
});

export const STEPS = Object.freeze([
  {
    id: "select",
    label: "Select benchmark",
    eyebrow: "Step 1 · Training sandbox",
    title: "Use a benchmark-derived club split",
    explanation:
      "This fixture is inspired by Zachary's karate club fission benchmark. It teaches community detection; it is not a real criminal or operational network.",
    task: "Confirm the benchmark scope and keep bridge members marked as uncertain.",
  },
  {
    id: "validate",
    label: "Validate labels",
    eyebrow: "Step 2 · Grounding",
    title: "Separate teaching labels from evidence",
    explanation:
      "The expected factions are benchmark annotations used for evaluation. They do not prove motive, wrongdoing, or real-world group identity.",
    task: "Open the evidence table and inspect one co-attendance relationship before trusting the automatic grouping.",
  },
  {
    id: "run",
    label: "Run community model",
    eyebrow: "Step 3 · Automatic analysis",
    title: "Run deterministic label propagation",
    explanation:
      "The local model spreads faction labels through the interaction graph from two known anchors. It is deterministic and small enough to audit.",
    task: "Review agreement, bridge-member uncertainty, and the relationship dependencies behind the split.",
  },
  {
    id: "review",
    label: "Review bridges",
    eyebrow: "Step 4 · Uncertainty",
    title: "Do not force every member into a hard story",
    explanation:
      "Bridge members interact with both sides. The app surfaces them as uncertain instead of converting ambiguity into a confident conclusion.",
    task: "Toggle one relationship filter or graph view, then verify the interpretation still includes caveats.",
  },
  {
    id: "report",
    label: "Export training report",
    eyebrow: "Step 5 · Report",
    title: "Write a benchmark training finding",
    explanation:
      "The report records the local algorithm, benchmark source note, agreement score, uncertain nodes, and prohibited-use limits.",
    task: "Acknowledge the next review action, mark ready, run preflight, and export the training report.",
  },
]);

export const NODES = Object.freeze([
  { id: "dojo-1", type: "person", label: "Instructor Hi", x: 16, y: 47, role: "hi-anchor", expectedCommunity: "hi" },
  { id: "dojo-2", type: "person", label: "Member 2", x: 25, y: 28, role: "hi-faction", expectedCommunity: "hi" },
  { id: "dojo-3", type: "person", label: "Member 3", x: 28, y: 56, role: "hi-faction", expectedCommunity: "hi" },
  { id: "dojo-4", type: "person", label: "Member 4", x: 38, y: 42, role: "bridge", expectedCommunity: "hi", uncertain: true },
  { id: "dojo-5", type: "person", label: "Member 5", x: 47, y: 22, role: "bridge", expectedCommunity: "hi", uncertain: true },
  { id: "dojo-6", type: "person", label: "Member 6", x: 58, y: 35, role: "officer-faction", expectedCommunity: "officer" },
  { id: "dojo-7", type: "person", label: "Member 7", x: 66, y: 58, role: "officer-faction", expectedCommunity: "officer" },
  { id: "dojo-8", type: "person", label: "Officer", x: 83, y: 45, role: "officer-anchor", expectedCommunity: "officer" },
]);

const EDGE_DEFS = [
  ["dk-001", "dojo-1", "dojo-2", "sparred with", "before", "high"],
  ["dk-002", "dojo-1", "dojo-3", "trained with", "before", "high"],
  ["dk-003", "dojo-2", "dojo-3", "co-attended", "before", "moderate"],
  ["dk-004", "dojo-3", "dojo-4", "coached", "before", "moderate"],
  ["dk-005", "dojo-4", "dojo-5", "co-attended", "before", "moderate"],
  ["dk-006", "dojo-5", "dojo-6", "co-attended", "after", "low"],
  ["dk-007", "dojo-6", "dojo-7", "trained with", "after", "high"],
  ["dk-008", "dojo-7", "dojo-8", "trained with", "after", "high"],
  ["dk-009", "dojo-6", "dojo-8", "administration meeting", "after", "high"],
  ["dk-010", "dojo-4", "dojo-6", "bridge attendance", "after", "low"],
  ["dk-011", "dojo-5", "dojo-8", "dues discussion", "after", "low"],
  ["dk-012", "dojo-2", "dojo-4", "informal training", "before", "moderate"],
];

export const RELATIONSHIPS = Object.freeze(EDGE_DEFS.map(([id, subject, object, predicate, period, confidence], index) => ({
  id,
  subject,
  object,
  predicate,
  relation: predicate.includes("bridge") || confidence === "low" ? "bridge" : predicate.includes("admin") || predicate.includes("dues") ? "administration" : "training",
  periods: [period],
  status: period === "after" ? "appeared" : "observed",
  eventTime: `2026-05-${String(index + 1).padStart(2, "0")} 12:00 UTC`,
  knownAt: "2026-06-01 12:00 UTC",
  evidenceClass: "benchmark-derived interaction",
  confidence,
  reliability: "published benchmark-derived fixture",
  credibility: "B1",
  source: `${id} · dojo interaction`,
  reasoning: `${NODES.find((node) => node.id === subject).label} ${predicate} ${NODES.find((node) => node.id === object).label}.`,
  caveat: "This is a community-detection teaching fixture; split labels are benchmark annotations, not operational facts.",
  communityBefore: period === "before" ? "Hi-side training cluster" : "not observed",
  communityAfter: period === "after" ? "Officer-side administration cluster" : "prior interaction",
})));

export const DEFAULT_SETTINGS = Object.freeze({
  comparisonMode: "side-by-side",
  relationFilter: "all",
  windowDays: 8,
  labelDensity: "comfortable",
  spacing: 1,
  showCommunities: true,
  highContrast: false,
  aliasIncluded: true,
});

export function nodeById(id) {
  return NODES.find((node) => node.id === id);
}

export function relationshipById(id) {
  return RELATIONSHIPS.find((relationship) => relationship.id === id);
}

export function visibleRelationships(settings = DEFAULT_SETTINGS) {
  return RELATIONSHIPS.filter((relationship) => {
    if (!settings.aliasIncluded && relationship.relation === "bridge") return false;
    if (settings.relationFilter !== "all" && relationship.relation !== settings.relationFilter) return false;
    return true;
  });
}

export function runCommunityBaseline(settings = DEFAULT_SETTINGS) {
  const relationships = visibleRelationships(settings);
  const result = labelPropagationCommunities({
    nodes: NODES,
    edges: relationships.map((relationship) => ({ source: relationship.subject, target: relationship.object })),
    anchors: { "dojo-1": "hi", "dojo-8": "officer" },
  });
  const expected = Object.fromEntries(NODES.map((node) => [node.id, node.expectedCommunity]));
  const uncertain = NODES.filter((node) => node.uncertain).map((node) => node.id);
  return {
    ...result,
    evaluation: evaluateCommunitySplit({
      predicted: result.labels,
      expected,
      uncertain,
    }),
    dependencies: relationships.map((relationship) => relationship.id),
  };
}

export function deriveAnalysis(settings = DEFAULT_SETTINGS) {
  const run = runCommunityBaseline(settings);
  return {
    splitConfidence: "benchmark agreement",
    interpretation: `The deterministic local community model reaches ${(run.evaluation.agreement * 100).toFixed(0)}% agreement on non-bridge benchmark labels while keeping bridge members uncertain.`,
    communities: Object.keys(run.communities).length,
    changedMemberships: run.evaluation.uncertainNodes.length,
    evidenceCoverage: `${run.dependencies.length}/${RELATIONSHIPS.length} interactions`,
    alternative:
      "Bridge attendance and administrative interactions can reflect scheduling, rank, or friendship instead of a true faction split.",
    versionReason: "Benchmark-derived dojo split local community model",
  };
}

export function reportModel(state) {
  const analysis = deriveAnalysis(state.settings);
  const run = runCommunityBaseline(state.settings);
  return {
    title: "Dojo club split · Community benchmark report",
    question: CASE.question,
    scope: "Benchmark-derived teaching fixture · Zachary karate club style split",
    before: "Weeks 1-4 interaction snapshot",
    after: "Weeks 5-8 interaction snapshot",
    knownAt: "June 1, 2026 at 12:00 UTC",
    fixture: "DojoKarateSplit@1.0.0",
    assessment: `${analysis.interpretation} This is a training benchmark result, not evidence of a criminal group or real-world faction conduct.`,
    contraryEvidence: analysis.alternative,
    method: "Deterministic label propagation with two benchmark anchors; calibrated production prediction disabled.",
    limitations: "Small benchmark-derived fixture; labels are teaching annotations and bridge members remain uncertain.",
    nextAction: "Compare bridge-member interactions against source records and rerun with bridge edges hidden before drawing any training conclusion.",
    dependencies: run.dependencies,
  };
}

export function runPreflight(state) {
  const report = reportModel(state);
  const journey = state.journey ?? {};
  const checks = [
    ["Evidence has been inspected", journey.evidenceInspected === true],
    ["Reasoning and uncertainty have been reviewed", journey.reasoningInspected === true],
    ["Alternative explanation has been reviewed", journey.alternativeReviewed === true],
    ["Recommended next review action has been acknowledged", journey.recommendationAcknowledged === true],
    ["Finding is marked ready", state.findingReady === true],
    ["Benchmark source scope is recorded", /benchmark/i.test(report.scope)],
    ["Known-at cutoff is recorded", Boolean(report.knownAt)],
    ["Local model method is recorded", /Deterministic label propagation/i.test(report.method)],
    ["Bridge-member uncertainty is disclosed", /bridge members remain uncertain/i.test(report.limitations)],
    ["Prohibited criminal-group interpretation is avoided", !/proved|criminal gang proof|ground truth organization/i.test(report.assessment)],
    ["Source dependencies are attached", report.dependencies.length > 0],
  ];
  return { checks, passed: checks.every(([, passed]) => passed) };
}
