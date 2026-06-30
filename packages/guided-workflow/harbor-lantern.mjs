import fixture from "../../data/fixtures/harbor-lantern.v1.json" with { type: "json" };

if (fixture.schema !== "HarborLanternInterchangeV1" || fixture.fixtureVersion !== "1.0.0") {
  throw new Error(`Unsupported Harbor Lantern fixture: ${fixture.schema}@${fixture.fixtureVersion}`);
}
if (fixture.case.synthetic !== true) {
  throw new Error("Harbor Lantern training data must remain explicitly synthetic");
}

export const FIXTURE_SCHEMA = fixture.schema;
export const FIXTURE_VERSION = fixture.fixtureVersion;
export let CASE = Object.freeze(fixture.case);
export let STEPS = Object.freeze(fixture.guidedSteps);
export let NODES = Object.freeze(fixture.nodes);
export let RELATIONSHIPS = Object.freeze(fixture.relationships);
export let DEFAULT_SETTINGS = Object.freeze(fixture.defaults);
export let WORKBENCH_TRANSPORT = "canonical-static";

export function configureWorkbenchBootstrap(bootstrap) {
  if (bootstrap.contract !== "WorkbenchBootstrapV1") {
    throw new Error("Expected WorkbenchBootstrapV1");
  }
  if (
    bootstrap.fixture_schema !== FIXTURE_SCHEMA ||
    bootstrap.fixture_version !== FIXTURE_VERSION
  ) {
    throw new Error("Workbench bootstrap does not match the supported fixture contract");
  }
  CASE = Object.freeze(bootstrap.case);
  STEPS = Object.freeze(bootstrap.guided_steps);
  NODES = Object.freeze(bootstrap.nodes);
  RELATIONSHIPS = Object.freeze(bootstrap.relationships);
  DEFAULT_SETTINGS = Object.freeze(bootstrap.defaults);
  WORKBENCH_TRANSPORT = bootstrap.transport ?? "authorized-api";
}

export function createInitialState() {
  return {
    stepIndex: 0,
    selectedId: "r1",
    settings: { ...DEFAULT_SETTINGS },
    analysisVersion: 1,
    findingReady: false,
    preflightRun: false,
    journey: {
      evidenceInspected: false,
      reasoningInspected: false,
      alternativeReviewed: false,
      recommendationAcknowledged: false,
    },
  };
}

export function nodeById(id) {
  return NODES.find((node) => node.id === id);
}

export function relationshipById(id) {
  return RELATIONSHIPS.find((relationship) => relationship.id === id);
}

export function visibleRelationships(settings = DEFAULT_SETTINGS) {
  return RELATIONSHIPS.filter((relationship) => {
    if (!settings.aliasIncluded && ["r1", "r5", "r6"].includes(relationship.id)) return false;
    if (settings.relationFilter !== "all" && relationship.relation !== settings.relationFilter) return false;
    return true;
  });
}

export function deriveAnalysis(settings = DEFAULT_SETTINGS) {
  const aliasIncluded = settings.aliasIncluded;
  const shortWindow = Number(settings.windowDays) === 14;
  const splitConfidence = !aliasIncluded ? "low" : shortWindow ? "low–moderate" : "moderate";
  const interpretation = !aliasIncluded
    ? "The apparent second branch is too weak to support a split interpretation."
    : shortWindow
      ? "The shorter window makes the pattern look abrupt, but it also removes useful context."
      : "The observed network is consistent with a possible temporary split.";

  return {
    splitConfidence,
    interpretation,
    communities: aliasIncluded ? 2 : 1,
    changedMemberships: aliasIncluded ? 3 : 1,
    evidenceCoverage: shortWindow ? "61%" : aliasIncluded ? "78%" : "72%",
    alternative:
      "A source-coverage gap from February 24–March 2 could make gradual drift look like a discrete split.",
    versionReason:
      settings.aliasIncluded === DEFAULT_SETTINGS.aliasIncluded &&
      Number(settings.windowDays) === DEFAULT_SETTINGS.windowDays &&
      settings.relationFilter === DEFAULT_SETTINGS.relationFilter
        ? "Recommended analysis"
        : "Alternative analytical assumptions",
  };
}

export function isAnalyticalSetting(key) {
  return ["aliasIncluded", "windowDays", "relationFilter"].includes(key);
}

export function updateSetting(state, key, value) {
  const currentValue = state.settings[key];
  if (String(currentValue) === String(value)) return state;
  return {
    ...state,
    settings: { ...state.settings, [key]: value },
    analysisVersion: state.analysisVersion + (isAnalyticalSetting(key) ? 1 : 0),
    preflightRun: false,
  };
}

export function resetAnalysis(state) {
  const changed = ["aliasIncluded", "windowDays", "relationFilter"].some(
    (key) => String(state.settings[key]) !== String(DEFAULT_SETTINGS[key]),
  );
  return {
    ...state,
    settings: {
      ...state.settings,
      aliasIncluded: DEFAULT_SETTINGS.aliasIncluded,
      windowDays: DEFAULT_SETTINGS.windowDays,
      relationFilter: DEFAULT_SETTINGS.relationFilter,
      comparisonMode: DEFAULT_SETTINGS.comparisonMode,
      splitCount: DEFAULT_SETTINGS.splitCount,
      splitBoundaryPercent: DEFAULT_SETTINGS.splitBoundaryPercent,
      splitStrategy: DEFAULT_SETTINGS.splitStrategy,
    },
    analysisVersion: state.analysisVersion + (changed ? 1 : 0),
    preflightRun: false,
  };
}

export function reportModel(state) {
  const analysis = deriveAnalysis(state.settings);
  const dependencies = visibleRelationships(state.settings).map((item) => item.source);
  return {
    title: "Harbor Lantern · Guided analysis report",
    question: CASE.question,
    scope: "Synthetic training data · January 1–March 31, 2026",
    before: "January 18–February 16, 2026",
    after: "February 17–March 18, 2026",
    knownAt: "March 18, 2026 at 23:59",
    fixture: `${FIXTURE_SCHEMA}@${FIXTURE_VERSION}`,
    assessment: `${analysis.interpretation} Confidence is ${analysis.splitConfidence} and sensitive to an unresolved alias and a source-coverage gap.`,
    contraryEvidence:
      "The disputed alias may join two people incorrectly, and no direct observation establishes that the Northstar–Halcyon relationship ended.",
    method: `Independent community snapshots with explicit lineage matching · analysis v${state.analysisVersion}`,
    limitations: `${analysis.evidenceCoverage} estimated source coverage; missing observations are not negative evidence.`,
    nextAction:
      "Lawfully corroborate the Elena Voss alias and the February 24-March 2 source-coverage gap before making any operational inference.",
    dependencies,
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
    ["Both event-time windows are recorded", Boolean(report.before && report.after)],
    ["Known-at cutoff is recorded", Boolean(report.knownAt)],
    ["Canonical fixture version is recorded", Boolean(report.fixture)],
    ["Neutral community language is used", /possible|consistent/i.test(report.assessment)],
    ["Contrary evidence is included", Boolean(report.contraryEvidence)],
    ["Confidence and limitations are disclosed", Boolean(report.limitations)],
    ["Source dependencies are attached", report.dependencies.length > 0],
  ];
  return {
    checks,
    passed: checks.every(([, passed]) => passed),
  };
}
