import {
  DEFAULT_SETTINGS,
  CASE,
  NODES,
  STEPS,
  createInitialState,
  deriveAnalysis,
  nodeById,
  relationshipById,
  reportModel,
  resetAnalysis,
  runPreflight,
  updateSetting,
  visibleRelationships,
  configureWorkbenchBootstrap,
} from "../../packages/guided-workflow/harbor-lantern.mjs";
import * as FinancialFraud from "../../packages/guided-workflow/financial-fraud.mjs";
import {
  SAMPLE_TRANSACTION_CSV,
  SAMPLE_TRANSACTION_JSON,
  createImportedFraudWorkflow,
  parseTransactionInput,
  previewTransactionImport,
} from "../../packages/guided-workflow/transaction-import.mjs";
import {
  answerGraphQuestion,
  draftNeutralReport,
  redTeamReview,
} from "../../packages/ai-assistant/analyst-copilot.mjs";
import {
  enableCandidate,
  evaluatePredictiveModelCandidates,
} from "../../packages/predictive/model-gates.mjs";
import {
  loadWorkbenchBootstrap,
} from "../../packages/api-client/workbench-client.mjs";
import {
  graphSummary,
  semanticRows,
} from "../../packages/graph-renderer/graph-model.mjs";
import {
  setNodeIcon,
  setNodeImage,
  resetNodeVisual,
  pushLayoutCheckpoint,
  snapshotGraphView,
  validateNodeImage,
} from "../../packages/graph-renderer/layout-model.mjs";
import { renderGraph } from "../../packages/graph-renderer/svg-renderer.mjs";
import {
  addAnnotation,
  addCaseNote,
  addComment,
  addManualEdge,
  addManualEntity,
  commitWorkspaceChange,
  createChartWorkspace,
  editManualEdge,
  expandNeighbors,
  exportBriefingChart,
  exportCasePacket,
  explainExpansion,
  explainPath,
  moveManualEntity,
  pinSearchResult,
  redactChartItem,
  redoWorkspaceChange,
  restoreRedactions,
  restoreWorkspaceSnapshot,
  saveLayout,
  saveSearch,
  saveWorkspaceSnapshot,
  searchGraph,
  selectedLayout,
  semanticChartRows,
  setReviewStatus,
  setPath,
  setTaskState,
  undoWorkspaceChange,
} from "../../packages/graph-renderer/chart-workspace.mjs";
import {
  applyScenePreset,
  executeGraphPhrase,
  graphRuleLegend,
} from "../../packages/graph-renderer/bloom-exploration.mjs";

const workbenchBootstrap = await loadWorkbenchBootstrap();
configureWorkbenchBootstrap(workbenchBootstrap);

let activeUseCase = "harbor";
let state = createInitialState();
let activeInspectorTab = "evidence";
let graphView = { positions: {}, rotation: 0, nodeVisuals: {}, undo: [], redo: [] };
let chartWorkspace = createChartWorkspace();
let importPreview = null;
let importedFraudWorkflow = null;
let assistantDraft = null;
let bloomExploration = { phrase: "", result: null, presetId: "financial-flow", ruleStyle: "default" };
const modelEvaluation = evaluatePredictiveModelCandidates();
const workspaceStorageKey = "napp-investigation-workspace-v1";

const elements = Object.fromEntries(
  [
    "stepList", "stepEyebrow", "stepTitle", "stepExplanation", "stepTask", "backStep",
    "useCaseMode", "caseId", "caseRange", "caseKnownAt", "question-title",
    "graphHeading", "communityHeading", "aliasControlLabel", "aliasControlHelp",
    "nextStep", "scopeToggle", "scopeDrawer", "comparisonMode", "relationFilter",
    "windowDays", "labelDensity", "visualStyle", "visualControls", "visualPopover", "spacing",
    "spacingOutput", "showCommunities", "highContrast", "rotateLeft", "rotateRight",
    "graphUndo", "graphRedo", "resetLayout", "resetAnalysis", "beforeGraph",
    "nodeVisualTarget", "nodeIconPreset", "nodeImageUpload", "resetNodeVisual",
    "afterGraph", "graphComparison", "overlayPanel", "appearedCount", "missingCount",
    "inspectorContent", "splitConfidence", "communityInterpretation", "communityAlternative",
    "aliasIncluded", "communityCount", "membershipCount", "coverageValue", "reportPreview",
    "reportStatus", "markFinding", "runPreflight", "preflightResults", "exportReport",
    "priorityQueue", "evidenceRows", "tableCount", "statusMessage", "helpButton",
    "helpDialog", "closeHelp", "chartSearch", "pinFirstResult", "saveSearch", "expandSelected",
    "findPath", "annotationText", "addAnnotation", "layoutName", "saveLayout",
    "restoreLayout", "workspaceUndo", "workspaceRedo", "chartSearchResults", "chartRows", "chartNotes",
    "workspaceComment", "addWorkspaceComment", "caseNoteText", "addCaseNote", "taskLabel", "taskStatus",
    "setTaskStatus", "reviewStatus", "setReviewStatus", "saveWorkspaceSnapshot", "restoreWorkspaceSnapshot", "prepareCasePacket",
    "bloomPhrase", "runBloomPhrase", "scenePreset", "applyScenePreset", "resetScenePreset", "bloomExplanation",
    "manualEntityLabel", "manualEntityType", "addManualEntity", "manualEdgeSource", "manualEdgeTarget",
    "manualEntityStyle", "moveManualEntity", "manualEdgeLabel", "manualEdgeStyle", "addManualEdge", "redactChartItem", "restoreRedactions", "exportChart",
    "transactionImportPanel", "transactionFormat", "transactionCsv", "loadSampleCsv",
    "loadSampleJson", "previewImport", "applyImport", "importPreview", "mappingControls",
    "scopePurpose", "scopePeriod", "scopeFocus", "scopeReason", "beforePeriodLabel",
    "afterPeriodLabel", "beforeKnownAt", "afterKnownAt", "modelGatePanel", "assistantPrompt",
    "askAssistant", "draftReport", "redTeamDraft", "assistantOutput", "manualChartCanvas",
  ].map((id) => [id, document.getElementById(id)]),
);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setStatus(message) {
  elements.statusMessage.textContent = message;
}

function financialInitialState() {
  return {
    stepIndex: 0,
    selectedId: "tx-004",
    settings: { ...FinancialFraud.DEFAULT_SETTINGS },
    analysisVersion: 1,
    findingReady: false,
    preflightRun: false,
  };
}

function activeWorkflow() {
  if (activeUseCase === "fraud") {
    if (importedFraudWorkflow) {
      return {
        ...importedFraudWorkflow,
        exportName: "imported-cuentas-mulas-fraud-ring",
        relationOptions: [
          ["all", "All recommended"],
          ["transfers", "Transfers"],
          ["cashout", "Cash-out"],
          ["infrastructure", "Infrastructure"],
        ],
        question: importedFraudWorkflow.case.question,
        graphHeading: "Imported financial transaction network",
        communityHeading: "Imported mule/ring hypothesis",
        confidenceLabel: "Review priority",
        aliasLabel: "Include infrastructure events",
        aliasHelp: "Recommended: include, but treat as supporting context",
        periodLabels: {
          before: "Imported collection phase",
          after: "Imported fan-out/support phase",
          knownAt: (importedFraudWorkflow.case.knownAt ?? "import known-at").replace("T", " · ").replace("Z", ""),
        },
        scopeDefaults: {
          purpose: "Training financial transaction review",
          period: importedFraudWorkflow.case.eventRange ?? "Imported transaction range",
          focus: "Accepted imported rows only",
          reason: "Imported rows are split by transaction order/time to separate collection from fan-out.",
        },
      };
    }
    return {
      case: FinancialFraud.CASE,
      steps: FinancialFraud.STEPS,
      nodes: FinancialFraud.NODES,
      defaults: FinancialFraud.DEFAULT_SETTINGS,
      nodeById: FinancialFraud.nodeById,
      relationshipById: FinancialFraud.relationshipById,
      visibleRelationships: FinancialFraud.visibleRelationships,
      deriveAnalysis: FinancialFraud.deriveAnalysis,
      reportModel: FinancialFraud.reportModel,
      runPreflight: FinancialFraud.runPreflight,
      exportName: "cuentas-mulas-fraud-ring",
      relationOptions: [
        ["all", "All recommended"],
        ["transfers", "Transfers"],
        ["cashout", "Cash-out"],
        ["infrastructure", "Infrastructure"],
      ],
      question: FinancialFraud.CASE.question,
      graphHeading: "Financial transaction network",
      communityHeading: "Possible mule bridge",
      confidenceLabel: "Review priority",
      aliasLabel: "Include infrastructure events",
      aliasHelp: "Recommended: include, but treat as supporting context",
      periodLabels: {
        before: "Apr 1 · 09:12–11:06",
        after: "Apr 1 · 12:18–Apr 2 · 08:19",
        knownAt: "Known by Apr 4 · 18:00",
      },
      scopeDefaults: {
        purpose: "Training financial transaction review",
        period: "April 1–4, 2026",
        focus: "72-hour transaction window",
        reason: "This split separates collection into Acct 777 from later fan-out and support events.",
      },
    };
  }
  return {
    case: CASE,
    steps: STEPS,
    nodes: NODES,
    defaults: DEFAULT_SETTINGS,
    nodeById,
    relationshipById,
    visibleRelationships,
    deriveAnalysis,
    reportModel,
    runPreflight,
    exportName: "harbor-lantern-analysis",
    relationOptions: [
      ["all", "All recommended"],
      ["communications", "Communications"],
      ["transfers", "Transfers"],
      ["devices", "Shared devices"],
      ["employment", "Employment"],
      ["shipment", "Shipment involvement"],
    ],
    question: CASE.question,
    graphHeading: "Observed network",
    communityHeading: "Possible temporary split",
    confidenceLabel: "Confidence",
    aliasLabel: "Include disputed Elena Voss alias",
    aliasHelp: "Recommended: include, but mark distinctly",
    periodLabels: {
      before: "Jan 18–Feb 16",
      after: "Feb 17–Mar 18",
      knownAt: "Known by Mar 18 · 23:59",
    },
    scopeDefaults: {
      purpose: "Training investigation",
      period: "January 1–March 31, 2026",
      focus: "30 days before shipment",
      reason: "Equal adjacent windows make change easier to compare.",
    },
  };
}

function graphSource() {
  const workflow = activeWorkflow();
  return {
    nodes: workflow.nodes,
    nodeById: workflow.nodeById,
    visibleRelationships: workflow.visibleRelationships,
  };
}

function bloomUseCase() {
  return activeUseCase === "fraud" && importedFraudWorkflow ? "imported-fraud" : activeUseCase;
}

function bloomCanSeeInfrastructure() {
  return graphSource().visibleRelationships(state.settings).some((relationship) =>
    ["device", "place"].includes(graphSource().nodeById(relationship.subject)?.type)
      || ["device", "place"].includes(graphSource().nodeById(relationship.object)?.type),
  );
}

function snapshotLayout() {
  return snapshotGraphView(graphView);
}

function restoreLayout(snapshot) {
  graphView = {
    ...graphView,
    positions: structuredClone(snapshot.positions),
    rotation: snapshot.rotation,
    nodeVisuals: structuredClone(snapshot.nodeVisuals ?? graphView.nodeVisuals ?? {}),
  };
}

function pushLayoutHistory() {
  graphView = pushLayoutCheckpoint(graphView);
}

function resetGraphView() {
  graphView = { positions: {}, rotation: 0, nodeVisuals: {}, undo: [], redo: [] };
}

function renderSteps() {
  const steps = activeWorkflow().steps;
  elements.stepList.innerHTML = steps.map((step, index) => `
    <li>
      <button class="step-button${index < state.stepIndex ? " is-complete" : ""}"
        type="button" data-step="${index}" ${index === state.stepIndex ? 'aria-current="step"' : ""}>
        <span class="step-number">${index < state.stepIndex ? "✓" : index + 1}</span>
        <span class="step-label">${escapeHtml(step.label)}</span>
      </button>
    </li>
  `).join("");
}

function renderCoach() {
  const step = activeWorkflow().steps[state.stepIndex];
  elements.stepEyebrow.textContent = step.eyebrow;
  elements.stepTitle.textContent = step.title;
  elements.stepExplanation.textContent = step.explanation;
  elements.stepTask.textContent = step.task;
  elements.backStep.disabled = state.stepIndex === 0;
  elements.nextStep.textContent = state.stepIndex === activeWorkflow().steps.length - 1 ? "Review complete" : "Continue";
}

function renderControls() {
  const workflow = activeWorkflow();
  elements.transactionImportPanel.hidden = activeUseCase !== "fraud";
  elements.useCaseMode.value = activeUseCase;
  elements.caseId.textContent = workflow.case.displayId ?? workflow.case.id;
  elements.caseRange.textContent = workflow.case.eventRange ?? "Jan 18–Mar 18, 2026";
  elements.caseKnownAt.textContent = (workflow.case.knownAt ?? workflow.case.scope?.knownAt ?? "2026-03-18T23:59:00Z")
    .replace("T", " · ")
    .replace("Z", "");
  elements["question-title"].textContent = workflow.question;
  elements.graphHeading.textContent = workflow.graphHeading;
  elements.communityHeading.textContent = workflow.communityHeading;
  elements.scopePurpose.textContent = workflow.scopeDefaults.purpose;
  elements.scopePeriod.textContent = workflow.scopeDefaults.period;
  elements.scopeFocus.textContent = workflow.scopeDefaults.focus;
  elements.scopeReason.textContent = workflow.scopeDefaults.reason;
  elements.beforePeriodLabel.textContent = workflow.periodLabels.before;
  elements.afterPeriodLabel.textContent = workflow.periodLabels.after;
  elements.beforeKnownAt.textContent = workflow.periodLabels.knownAt;
  elements.afterKnownAt.textContent = workflow.periodLabels.knownAt;
  elements.aliasControlLabel.textContent = workflow.aliasLabel;
  elements.aliasControlHelp.textContent = workflow.aliasHelp;
  const currentRelation = String(state.settings.relationFilter);
  elements.relationFilter.innerHTML = workflow.relationOptions
    .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`)
    .join("");
  if (!workflow.relationOptions.some(([value]) => value === currentRelation)) {
    state = { ...state, settings: { ...state.settings, relationFilter: "all" } };
  }
  Object.entries({
    comparisonMode: state.settings.comparisonMode,
    relationFilter: state.settings.relationFilter,
    windowDays: state.settings.windowDays,
    labelDensity: state.settings.labelDensity,
    visualStyle: state.settings.visualStyle ?? "classic",
    spacing: state.settings.spacing,
    showCommunities: state.settings.showCommunities,
    highContrast: state.settings.highContrast,
    aliasIncluded: state.settings.aliasIncluded,
  }).forEach(([key, value]) => {
    const element = elements[key];
    if (element.type === "checkbox") element.checked = Boolean(value);
    else element.value = String(value);
  });
  elements.spacingOutput.textContent = state.settings.spacing;
  elements.graphUndo.disabled = graphView.undo.length === 0;
  elements.graphRedo.disabled = graphView.redo.length === 0;
  const currentTarget = elements.nodeVisualTarget.value || workflow.nodes[0]?.id || "";
  elements.nodeVisualTarget.innerHTML = workflow.nodes
    .map((node) => `<option value="${escapeHtml(node.id)}">${escapeHtml(node.label)}</option>`)
    .join("");
  elements.nodeVisualTarget.value = workflow.nodes.some((node) => node.id === currentTarget)
    ? currentTarget
    : workflow.nodes[0]?.id ?? "";
  elements.nodeIconPreset.value = graphView.nodeVisuals[elements.nodeVisualTarget.value]?.icon ?? "default";
  document.documentElement.dataset.contrast = state.settings.highContrast ? "high" : "standard";
  document.documentElement.dataset.visualStyle = state.settings.visualStyle ?? "classic";
  document.querySelector(".version-chip").textContent = `Analysis v${state.analysisVersion}`;
}

function renderImportPreview() {
  if (activeUseCase !== "fraud") return;
  renderMappingControls();
  elements.applyImport.disabled = !importPreview || importPreview.summary.accepted === 0;
  if (!importPreview) {
    elements.importPreview.innerHTML = `
      <div class="workspace-item"><b>No import preview yet</b><small>Load the sample or paste CSV, then preview.</small></div>
    `;
    return;
  }
  const mapped = Object.entries(importPreview.mappedColumns)
    .filter(([, column]) => column)
    .map(([field, column]) => `${field} → ${column}`)
    .join("<br>");
  const rejected = importPreview.rejectedRows.slice(0, 4)
    .map((row) => `row ${row.rowNumber}: ${row.reasons.join("; ")}`)
    .join("<br>") || "None";
  elements.importPreview.innerHTML = `
    <div class="workspace-item"><b>${importPreview.summary.accepted} accepted</b><small>${importPreview.summary.rejected} rejected of ${importPreview.summary.totalRows} rows</small></div>
    <div class="workspace-item"><b>${escapeHtml(importPreview.format.toUpperCase())} mapped fields</b><small>${mapped || "No required columns mapped"}</small></div>
    <div class="workspace-item"><b>Rejected rows</b><small>${escapeHtml(rejected)}</small></div>
  `;
}

function currentMappingOverrides() {
  return Object.fromEntries(
    [...elements.mappingControls.querySelectorAll("[data-mapping-field]")]
      .map((select) => [select.dataset.mappingField, select.value])
      .filter(([, value]) => value),
  );
}

function renderMappingControls() {
  const parsed = parseTransactionInput(elements.transactionCsv.value, { format: elements.transactionFormat.value });
  const headers = parsed.headers ?? [];
  const fields = ["id", "at", "origin", "destination", "amount", "currency", "type", "originKind", "destinationKind", "description"];
  if (!headers.length) {
    elements.mappingControls.innerHTML = `<div class="mapping-empty">Paste or load data to map fields.</div>`;
    return;
  }
  const existing = currentMappingOverrides();
  const options = (selected) => [
    `<option value="">Infer</option>`,
    ...headers.map((header) => `<option value="${escapeHtml(header)}" ${existing[selected] === header ? "selected" : ""}>${escapeHtml(header)}</option>`),
  ].join("");
  elements.mappingControls.innerHTML = fields.map((field) => `
    <label>
      <span>${escapeHtml(field)}</span>
      <select data-mapping-field="${escapeHtml(field)}">${options(field)}</select>
    </label>
  `).join("");
}

function renderGraphs() {
  const source = graphSource();
  const summary = graphSummary(state.settings, source);
  const options = {
    selectedId: state.selectedId,
    comparisonMode: state.settings.comparisonMode,
    labelDensity: state.settings.labelDensity,
    spacing: state.settings.spacing,
    showCommunities: state.settings.showCommunities,
    positions: graphView.positions,
    rotation: graphView.rotation,
    nodeVisuals: graphView.nodeVisuals,
    visualStyle: state.settings.visualStyle ?? "classic",
    onSelect: selectRelationship,
    onNodeMoveStart: pushLayoutHistory,
    onNodeMovePreview: previewNodeMove,
    onNodeMoveEnd: commitNodeMove,
  };
  renderGraph(elements.beforeGraph, summary.before, options);
  renderGraph(elements.afterGraph, summary.after, options);
  elements.appearedCount.textContent = `${summary.appeared.length} appeared later`;
  elements.missingCount.textContent = `${summary.noLongerObserved.length} no longer observed`;

  const overlay = state.settings.comparisonMode === "overlay";
  elements.overlayPanel.hidden = !overlay;
  document.querySelectorAll(".graph-panel").forEach((panel) => { panel.hidden = overlay; });
  if (overlay) {
    elements.overlayPanel.innerHTML = `
      <p class="kicker">Overlay summary · positions remain anchored</p>
      <h3>${summary.appeared.length + summary.noLongerObserved.length} observed relationship changes</h3>
      <ul>
        ${summary.appeared.map((edge) => `<li><b>Appeared later:</b> ${escapeHtml(edge.sourceNode.label)} ${escapeHtml(edge.predicate)} ${escapeHtml(edge.targetNode.label)}</li>`).join("")}
        ${summary.noLongerObserved.map((edge) => `<li><b>No longer observed:</b> ${escapeHtml(edge.sourceNode.label)} ${escapeHtml(edge.predicate)} ${escapeHtml(edge.targetNode.label)}</li>`).join("")}
      </ul>
      <p>“No longer observed” describes this dataset and cutoff. It does not establish that a relationship ended.</p>
    `;
  }
}

function inspectorEvidence(item) {
  return `
    <p class="kicker">Selected assertion</p>
    <h2 class="inspector-title" id="inspectorTitle">${escapeHtml(item.source)}</h2>
    <p>${escapeHtml(item.predicate)} · ${escapeHtml(item.periods.length === 2 ? "observed in both periods" : `${item.periods[0]} period only`)}</p>
    <div class="evidence-badges">
      <span>${escapeHtml(item.evidenceClass)}</span>
      <span class="${item.status === "uncertain" ? "uncertain" : ""}">${escapeHtml(item.confidence)} confidence</span>
    </div>
    <dl class="inspector-list">
      <div><dt>Event time · when it happened</dt><dd>${escapeHtml(item.eventTime)}</dd></div>
      <div><dt>Known at · when analysts could use it</dt><dd>${escapeHtml(item.knownAt)}</dd></div>
      <div><dt>Source reliability</dt><dd>${escapeHtml(item.reliability)}</dd></div>
      <div><dt>Information credibility</dt><dd>${escapeHtml(item.credibility)}</dd></div>
      <div><dt>Original reference</dt><dd>${escapeHtml(item.source)} · synthetic unrestricted</dd></div>
      <div><dt>Transformation history</dt><dd>Source assertion → authorized projection → graph edge → report dependency</dd></div>
    </dl>
  `;
}

function inspectorReasoning(item) {
  return `
    <p class="kicker">Plain-language reasoning</p>
    <h2 class="inspector-title" id="inspectorTitle">Why is this connection shown?</h2>
    <div class="reason-box"><b>Reason</b><br>${escapeHtml(item.reasoning)}</div>
    <div class="reason-box warning"><b>What could go wrong?</b><br>${escapeHtml(item.caveat)}</div>
    <dl class="inspector-list">
      <div><dt>What changes if excluded?</dt><dd>${["r1", "r5", "r6"].includes(item.id) ? "The possible split loses support and confidence falls." : "Relationship and community counts are recalculated in a new analysis version."}</dd></div>
      <div><dt>Can it be undone?</dt><dd>Yes. Reset to recommended restores the original analysis without deleting prior versions.</dd></div>
    </dl>
  `;
}

function inspectorOptions(item) {
  return `
    <p class="kicker">Available actions</p>
    <h2 class="inspector-title" id="inspectorTitle">Test, trace, or retain</h2>
    <dl class="inspector-list">
      <div><dt>Inspect source</dt><dd>Trace this visual element to ${escapeHtml(item.source)}.</dd></div>
      <div><dt>Test without uncertain identity</dt><dd>Turn off the Elena Voss alias to create a reversible analysis version.</dd></div>
      <div><dt>Change visual style</dt><dd>Adjust spacing or labels without changing analytical results.</dd></div>
      <div><dt>Pin to report</dt><dd>This assertion is already included in the live provenance appendix.</dd></div>
    </dl>
    <button class="button secondary" type="button" id="optionAliasToggle">${state.settings.aliasIncluded ? "Exclude disputed alias" : "Restore disputed alias"}</button>
  `;
}

function renderInspector() {
  const workflow = activeWorkflow();
  let item = workflow.relationshipById(state.selectedId);
  const visibleRows = semanticRows(state.settings, graphSource());
  const visibleIds = new Set(visibleRows.map((row) => row.id));
  if (!item || !visibleIds.has(item.id)) {
    item = workflow.relationshipById(activeUseCase === "fraud" ? (visibleRows[0]?.id ?? "tx-004") : "r2");
    state = { ...state, selectedId: item.id };
  }
  elements.inspectorContent.innerHTML =
    activeInspectorTab === "reasoning"
      ? inspectorReasoning(item)
      : activeInspectorTab === "options"
        ? inspectorOptions(item)
        : inspectorEvidence(item);
  const optionToggle = document.getElementById("optionAliasToggle");
  optionToggle?.addEventListener("click", () => changeSetting("aliasIncluded", !state.settings.aliasIncluded));
}

function renderCommunity() {
  const workflow = activeWorkflow();
  const analysis = workflow.deriveAnalysis(state.settings);
  elements.splitConfidence.textContent = `${analysis.splitConfidence[0].toUpperCase()}${analysis.splitConfidence.slice(1)} confidence`;
  elements.communityInterpretation.textContent = analysis.interpretation;
  elements.communityAlternative.textContent = analysis.alternative;
  elements.communityCount.textContent = analysis.communities;
  elements.membershipCount.textContent = analysis.changedMemberships;
  elements.coverageValue.textContent = analysis.evidenceCoverage;
}

function renderReport() {
  const report = activeWorkflow().reportModel(state);
  elements.reportStatus.textContent = state.preflightRun ? "Preflight passed" : state.findingReady ? "Finding ready" : "Draft";
  elements.reportPreview.innerHTML = `
    <p class="report-meta">${escapeHtml(report.scope)} · ${escapeHtml(report.method)} · ${escapeHtml(report.fixture)}</p>
    <h3>${escapeHtml(report.title)}</h3>
    <h4>Executive assessment</h4>
    <p>${escapeHtml(report.assessment)}</p>
    <h4>Contrary evidence &amp; limitations</h4>
    <p>${escapeHtml(report.contraryEvidence)} ${escapeHtml(report.limitations)}</p>
    <h4>Next lawful action</h4>
    <p>${escapeHtml(report.nextAction)}</p>
    <h4>Provenance appendix</h4>
    <p>${report.dependencies.length} exact synthetic source dependencies attached.</p>
  `;
  elements.markFinding.textContent = state.findingReady ? "Finding ready ✓" : "Mark finding ready";
  elements.exportReport.disabled = !state.preflightRun;
  if (!state.preflightRun) {
    elements.preflightResults.hidden = true;
  }
}

function renderPrioritization() {
  const ranked = workbenchBootstrap.prioritization ?? [];
  if (!ranked.length) {
    elements.priorityQueue.innerHTML = `
      <div class="priority-empty">
        <b>No ordering shown in static fallback mode.</b>
        <p>Run the authorized API service to calculate the evidence-priority baseline.</p>
      </div>
    `;
    return;
  }
  elements.priorityQueue.innerHTML = ranked.map((entry) => {
    const assessment = entry.assessment;
    const ordered = assessment.status === "ordered";
    const interval = assessment.uncertainty_interval;
    const dependencies = assessment.dependencies.length;
    const sensitivity = assessment.removal_sensitivity
      .map((item) => item.resulting_status === "abstained"
        ? `${item.removed_dependency_id}: abstains if removed`
        : `${item.removed_dependency_id}: ${item.index_change >= 0 ? "+" : ""}${item.index_change}`)
      .join("; ");
    return `
      <article class="priority-item${ordered ? "" : " is-abstained"}">
        <div class="priority-rank">${ordered ? `#${entry.rank}` : "—"}</div>
        <div class="priority-body">
          <div class="priority-heading">
            <h3>${escapeHtml(entry.display_label)}</h3>
            <span>${escapeHtml(assessment.neutral_label)}</span>
          </div>
          <p>${ordered
            ? `<b>${assessment.evidence_priority_index.toFixed(1)}</b> / 100 · sensitivity range ${interval[0].toFixed(1)}–${interval[1].toFixed(1)}`
            : `No index · ${escapeHtml(assessment.abstention_reasons.join(", "))}`}</p>
          <details>
            <summary>Why is this here?</summary>
            <p>${dependencies} exact authorized evidence dependencies. Missingness penalty:
              ${assessment.missingness_penalty_points.toFixed(1)} points.</p>
            <p><b>Sources:</b> ${entry.dependency_sources.map(escapeHtml).join("; ") || "None"}</p>
            <p><b>Removal sensitivity:</b> ${escapeHtml(sensitivity || "Not applicable")}</p>
            <p>${assessment.limitations.map(escapeHtml).join(" ")}</p>
          </details>
        </div>
      </article>
    `;
  }).join("");
}

function renderModelGates() {
  elements.modelGatePanel.innerHTML = modelEvaluation.candidates.map((candidate) => {
    const attempt = enableCandidate(modelEvaluation, candidate.id);
    return `
      <div class="workspace-item">
        <b>${escapeHtml(candidate.label)}</b>
        <small>${escapeHtml(candidate.family)} · ${escapeHtml(candidate.gateStatus)} · precision@budget ${candidate.metrics.precisionAtBudget.toFixed(2)}</small>
        <small>${escapeHtml(attempt.reason)}</small>
      </div>
    `;
  }).join("");
}

function renderAssistant() {
  if (elements.assistantOutput.innerHTML) return;
  elements.assistantOutput.innerHTML = `
    <div class="workspace-item">
      <b>Assistant ready</b>
      <small>Answers must cite visible local evidence and remain draft-only.</small>
    </div>
  `;
}

function renderTable() {
  const rows = semanticRows(state.settings, graphSource());
  elements.tableCount.textContent = `${rows.length} relationships · select a row to inspect`;
  elements.evidenceRows.innerHTML = rows.map((row) => `
    <tr tabindex="0" data-id="${row.id}" class="${row.id === state.selectedId ? "is-selected" : ""}" aria-selected="${row.id === state.selectedId}">
      <td class="relationship-cell">
        <b>${escapeHtml(row.subjectLabel)} ${escapeHtml(row.predicate)}</b>
        <span>${escapeHtml(row.objectLabel)}</span>
        <i class="status-label">${escapeHtml(row.changeLabel)}</i>
      </td>
      <td>${escapeHtml(row.periodLabel)}</td>
      <td>${escapeHtml(row.eventTime)}</td>
      <td>${escapeHtml(row.knownAt)}</td>
      <td>${escapeHtml(row.evidenceClass)}<br><small>${escapeHtml(row.source)}</small></td>
      <td>${escapeHtml(row.confidence)}</td>
      <td>${escapeHtml(row.communityBefore)} → ${escapeHtml(row.communityAfter)}</td>
    </tr>
  `).join("");
}

function chartSearchResults() {
  return searchGraph(chartWorkspace.query, graphSource(), state.settings);
}

function persistWorkspaceSnapshot() {
  try {
    localStorage.setItem(workspaceStorageKey, JSON.stringify(chartWorkspace.savedWorkspaceSnapshot));
    return true;
  } catch {
    return false;
  }
}

function readWorkspaceSnapshot() {
  try {
    const raw = localStorage.getItem(workspaceStorageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function chartNodePoint(id) {
  const manual = (chartWorkspace.manualEntities ?? []).find((entity) => entity.id === id);
  if (manual) return { x: Number(manual.x ?? 50), y: Number(manual.y ?? 50), label: manual.label };
  const node = activeWorkflow().nodeById(id);
  return node ? { x: Number(node.x ?? 50), y: Number(node.y ?? 50), label: node.label } : null;
}

function renderManualChartCanvas() {
  const redacted = new Set(chartWorkspace.redactedItemIds ?? []);
  const manualEdges = (chartWorkspace.manualEdges ?? [])
    .map((edge) => ({ edge, source: chartNodePoint(edge.sourceId), target: chartNodePoint(edge.targetId) }))
    .filter((item) => item.source && item.target);
  const manualEntities = chartWorkspace.manualEntities ?? [];
  const edgeMarkup = manualEdges.map(({ edge, source, target }) => `
    <g class="manual-chart-edge style-${escapeHtml(edge.style)}" data-manual-edge-id="${escapeHtml(edge.id)}">
      <line x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}"></line>
      <text x="${(source.x + target.x) / 2}" y="${(source.y + target.y) / 2 - 2}">${escapeHtml(redacted.has(edge.id) ? "Redacted link" : edge.label)}</text>
    </g>
  `).join("");
  const entityMarkup = manualEntities.map((entity) => `
    <g class="manual-chart-node style-${escapeHtml(redacted.has(entity.id) ? "redacted" : entity.style ?? "slate")}" data-manual-entity-id="${escapeHtml(entity.id)}">
      <circle cx="${entity.x}" cy="${entity.y}" r="4.8"></circle>
      <text x="${entity.x}" y="${Number(entity.y) + 8.5}" text-anchor="middle">${escapeHtml(redacted.has(entity.id) ? "Redacted item" : entity.label)}</text>
    </g>
  `).join("");
  elements.manualChartCanvas.setAttribute("viewBox", "0 0 100 100");
  elements.manualChartCanvas.innerHTML = `${edgeMarkup}${entityMarkup}`;
}

function renderChartWorkspace() {
  const results = chartSearchResults();
  const rows = semanticChartRows(chartWorkspace, graphSource());
  const pathSteps = explainPath(chartWorkspace, graphSource(), state.settings);
  const expansion = explainExpansion(chartWorkspace, graphSource(), state.settings);
  const briefing = exportBriefingChart(chartWorkspace, graphSource(), state.settings);
  elements.chartSearch.value = chartWorkspace.query;
  elements.reviewStatus.value = chartWorkspace.reviewStatus ?? "triage";
  elements.bloomPhrase.value = bloomExploration.phrase;
  elements.scenePreset.value = bloomExploration.presetId;
  elements.restoreLayout.disabled = !selectedLayout(chartWorkspace);
  elements.restoreWorkspaceSnapshot.disabled = !(chartWorkspace.savedWorkspaceSnapshot || readWorkspaceSnapshot());
  elements.workspaceUndo.disabled = !(chartWorkspace.undoStack ?? []).length;
  elements.workspaceRedo.disabled = !(chartWorkspace.redoStack ?? []).length;
  const selectableRows = rows.length ? rows : activeWorkflow().nodes.slice(0, 6).map((node) => ({ id: node.id, label: node.label }));
  const edgeOptions = selectableRows.map((row) => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.label)}</option>`).join("");
  elements.manualEdgeSource.innerHTML = edgeOptions;
  elements.manualEdgeTarget.innerHTML = edgeOptions;
  if (selectableRows[1]) elements.manualEdgeTarget.value = selectableRows[1].id;
  renderManualChartCanvas();
  elements.chartSearchResults.innerHTML = results.length
    ? results.map((result, index) => `
      <button class="workspace-item" type="button" data-chart-result="${index}">
        <b>${escapeHtml(result.label)}</b>
        <small>${escapeHtml(result.kind)} · ${escapeHtml(result.detail)}</small>
      </button>
    `).join("")
    : `<div class="workspace-item">No search results pinned yet.<small>Search keeps data authorized and local to this projection.</small></div>`;
  const rowHtml = rows.length
    ? rows.map((row) => `
      <div class="workspace-item">
        <b>${escapeHtml(row.label)}</b>
        <small>${escapeHtml(row.type)} · ${escapeHtml(row.role)} · ${row.noteCount} notes${row.redacted ? " · redacted" : ""}</small>
      </div>
    `).join("")
    : `<div class="workspace-item">No chart rows yet.<small>Pin a result or expand the selected relationship.</small></div>`;
  const manualEdgeHtml = (chartWorkspace.manualEdges ?? []).map((edge) => `
    <div class="workspace-item">
      <b>${escapeHtml(edge.label)}</b>
      <small>${escapeHtml(edge.sourceId)} → ${escapeHtml(edge.targetId)} · ${escapeHtml(edge.style)} · ${escapeHtml(edge.evidenceStatus)}</small>
    </div>
  `).join("");
  const pathHtml = pathSteps.length
    ? `<div class="workspace-item"><b>Path explanation · ${pathSteps.length} exact dependencies</b><small>${pathSteps.map((step) => `${escapeHtml(step.label)} · ${escapeHtml(step.source)} · ${escapeHtml(step.confidence ?? "unknown")} confidence`).join("<br>")}</small></div>`
    : "";
  elements.chartRows.innerHTML = `${pathHtml}${rowHtml}${manualEdgeHtml}`;
  const notes = chartWorkspace.annotations.map((note) => `
    <div class="workspace-item">
      <b>${escapeHtml(note.classification)}</b>
      <small>${escapeHtml(note.targetId)} · ${escapeHtml(note.text)}</small>
    </div>
  `).join("");
  const savedSearches = (chartWorkspace.savedSearches ?? []).map((search) => `
    <div class="workspace-item">
      <b>Saved search · ${escapeHtml(search.name)}</b>
      <small>${escapeHtml(search.query)} · ${search.resultCount} visible results · ${escapeHtml(search.boundedTo)}</small>
    </div>
  `).join("");
  const comments = (chartWorkspace.comments ?? []).map((comment) => `
    <div class="workspace-item">
      <b>${escapeHtml(comment.classification)}</b>
      <small>${escapeHtml(comment.targetId)} · ${escapeHtml(comment.text)} · ${escapeHtml(comment.evidenceStatus)}</small>
    </div>
  `).join("");
  const caseNotes = (chartWorkspace.caseNotes ?? []).map((note) => `
    <div class="workspace-item">
      <b>${escapeHtml(note.classification)}</b>
      <small>${escapeHtml(note.text)} · ${escapeHtml(note.evidenceStatus)}</small>
    </div>
  `).join("");
  const tasks = (chartWorkspace.taskStates ?? []).map((task) => `
    <div class="workspace-item">
      <b>Task · ${escapeHtml(task.label)}</b>
      <small>${escapeHtml(task.status)} · ${escapeHtml(task.classification)}</small>
    </div>
  `).join("");
  const audit = (chartWorkspace.auditLog ?? []).slice(-4).map((entry) => `
    <div class="workspace-item">
      <b>Audit · ${escapeHtml(entry.action)}</b>
      <small>${escapeHtml(entry.id)} · ${escapeHtml(entry.actor)} · ${escapeHtml(JSON.stringify(entry.detail))}</small>
    </div>
  `).join("");
  const layouts = chartWorkspace.savedLayouts.map((layout) => `
    <div class="workspace-item">
      <b>${escapeHtml(layout.name)}</b>
      <small>${Object.keys(layout.positions).length} moved nodes · ${Object.keys(layout.nodeVisuals ?? {}).length} custom visuals · ${layout.rotation}° rotation</small>
    </div>
  `).join("");
  const expansionHtml = `<div class="workspace-item"><b>Expansion boundary</b><small>${expansion.visibleNodeCount} nodes · ${expansion.visibleRelationshipCount} visible relationships · ${escapeHtml(expansion.explanation)}</small></div>`;
  const reviewHtml = `<div class="workspace-item"><b>Review status</b><small>${escapeHtml(chartWorkspace.reviewStatus ?? "triage")} · comments and notes are not evidence</small></div>`;
  const snapshotHtml = chartWorkspace.savedWorkspaceSnapshot
    ? `<div class="workspace-item"><b>Saved workspace</b><small>${escapeHtml(chartWorkspace.savedWorkspaceSnapshot.name)} · browser-local training snapshot</small></div>`
    : "";
  const hasBriefingState = notes || savedSearches || comments || caseNotes || tasks || audit || layouts || snapshotHtml || briefing.provenance.manualItemCount || briefing.redactionCount || pathSteps.length;
  const briefingHtml = `<div class="workspace-item"><b>Briefing export</b><small>${escapeHtml(briefing.status)} · ${briefing.redactionCount} redactions · ${briefing.unsupportedClaims.length} unsupported manual claims blocked</small></div>`;
  elements.chartNotes.innerHTML = hasBriefingState
    ? `${reviewHtml}${expansionHtml}${savedSearches}${comments}${caseNotes}${tasks}${notes}${layouts}${snapshotHtml}${audit}${briefingHtml}`
    : `<div class="workspace-item">No annotations or saved layouts.<small>Notes are analyst commentary, not evidence.</small></div>`;
  renderBloomExploration();
}

function renderBloomExploration() {
  const result = bloomExploration.result;
  const dependencies = result?.dependencies ?? [];
  const dependencyHtml = dependencies.length
    ? dependencies.slice(0, 5).map((dependency) =>
      `${escapeHtml(dependency.id)} · ${escapeHtml(dependency.source)} · event ${escapeHtml(dependency.eventTime ?? "n/a")} · known ${escapeHtml(dependency.knownAt ?? "n/a")} · ${escapeHtml(dependency.confidence ?? "unknown")} confidence`,
    ).join("<br>")
    : "No evidence dependency added yet.";
  const rows = result?.rows ?? [];
  const rowHtml = rows.length
    ? rows.map((row) => `${escapeHtml(row.label)} · ${escapeHtml(row.type)}`).join("<br>")
    : "No graph phrase result rows yet.";
  const legend = graphRuleLegend(bloomExploration.ruleStyle).map(escapeHtml).join("<br>");
  elements.bloomExplanation.innerHTML = `
    <div class="workspace-item">
      <b>${escapeHtml(result?.parsed?.label ?? "Graph phrase preview")}</b>
      <small>${escapeHtml(result?.explanation ?? "Supported phrases include: show accounts connected to Acct 777; paths between Acct 100 and Acct 901.")}</small>
    </div>
    <div class="workspace-item">
      <b>Evidence dependencies and cutoff</b>
      <small>${dependencyHtml}<br>Cutoff: ${escapeHtml(activeWorkflow().periodLabels.knownAt)}</small>
    </div>
    <div class="workspace-item">
      <b>Rule styling and visible rows</b>
      <small>${legend}<br>${rowHtml}</small>
    </div>
  `;
}

function render() {
  renderSteps();
  renderCoach();
  renderControls();
  renderImportPreview();
  renderGraphs();
  renderInspector();
  renderCommunity();
  renderReport();
  renderPrioritization();
  renderModelGates();
  renderAssistant();
  renderChartWorkspace();
  renderTable();
}

function selectRelationship(id) {
  state = { ...state, selectedId: id };
  activeInspectorTab = "evidence";
  document.querySelectorAll('[role="tab"]').forEach((tab) => {
    tab.setAttribute("aria-selected", String(tab.dataset.tab === activeInspectorTab));
  });
  render();
  setStatus(`Selected ${activeWorkflow().relationshipById(id).source}`);
}

function clampPosition(position) {
  return {
    x: Math.max(4, Math.min(96, position.x)),
    y: Math.max(4, Math.min(96, position.y)),
  };
}

function previewNodeMove(id, position) {
  graphView = {
    ...graphView,
    positions: {
      ...graphView.positions,
      [id]: clampPosition(position),
    },
  };
}

function commitNodeMove(id, position) {
  previewNodeMove(id, position);
  render();
  setStatus(`Moved ${activeWorkflow().nodeById(id).label} in the view only`);
}

function changeGraphRotation(delta) {
  pushLayoutHistory();
  graphView = { ...graphView, rotation: (graphView.rotation + delta + 360) % 360 };
  renderGraphs();
  renderControls();
  setStatus(`Graph rotated to ${graphView.rotation} degrees`);
}

function undoGraphLayout() {
  if (!graphView.undo.length) return;
  const previous = graphView.undo.at(-1);
  graphView = {
    ...graphView,
    undo: graphView.undo.slice(0, -1),
    redo: [...graphView.redo, snapshotLayout()].slice(-20),
  };
  restoreLayout(previous);
  render();
  setStatus("Graph layout undo applied");
}

function redoGraphLayout() {
  if (!graphView.redo.length) return;
  const next = graphView.redo.at(-1);
  graphView = {
    ...graphView,
    undo: [...graphView.undo, snapshotLayout()].slice(-20),
    redo: graphView.redo.slice(0, -1),
  };
  restoreLayout(next);
  render();
  setStatus("Graph layout redo applied");
}

function changeSetting(key, value) {
  const analytical = ["aliasIncluded", "windowDays", "relationFilter", "riskThreshold"].includes(key);
  state = updateSetting(state, key, value);
  if (activeUseCase === "fraud" && key === "aliasIncluded") {
    state = { ...state, settings: { ...state.settings, includeInfrastructure: Boolean(value) } };
  }
  render();
  setStatus(analytical ? `New analysis v${state.analysisVersion}: ${key} changed` : `View customized: ${key} changed`);
}

function applyExplorationScene(settings) {
  const analyticalKeys = ["relationFilter", "includeInfrastructure"];
  const analyticalChanged = analyticalKeys.some((key) =>
    Object.hasOwn(settings, key) && String(state.settings[key]) !== String(settings[key]),
  );
  state = {
    ...state,
    settings: { ...state.settings, ...settings },
    analysisVersion: state.analysisVersion + (analyticalChanged ? 1 : 0),
    preflightRun: analyticalChanged ? false : state.preflightRun,
  };
}

function changeStep(nextIndex) {
  const steps = activeWorkflow().steps;
  state = { ...state, stepIndex: Math.max(0, Math.min(steps.length - 1, nextIndex)) };
  render();
  document.querySelector(".coach-card").scrollIntoView({ behavior: "smooth", block: "start" });
  setStatus(steps[state.stepIndex].label);
}

function reportHtml() {
  const report = activeWorkflow().reportModel(state);
  const rows = semanticRows(state.settings, graphSource());
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(report.title)}</title>
  <style>body{max-width:850px;margin:40px auto;padding:0 24px;color:#173336;font:15px/1.55 system-ui}h1,h2{font-family:Georgia,serif}header{border-bottom:3px solid #0f6b67}small{color:#607274}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:8px;border:1px solid #ccd5d1;text-align:left;vertical-align:top}.notice{padding:12px;background:#f6edda}</style></head><body>
  <header><small>Fictional training report · ${escapeHtml(report.method)} · ${escapeHtml(report.fixture)}</small><h1>${escapeHtml(report.title)}</h1><p>${escapeHtml(report.question)}</p></header>
  <h2>Question and scope</h2><p>${escapeHtml(report.scope)}<br><b>Before:</b> ${escapeHtml(report.before)}<br><b>After:</b> ${escapeHtml(report.after)}<br><b>Known at:</b> ${escapeHtml(report.knownAt)}</p>
  <h2>Executive assessment</h2><p>${escapeHtml(report.assessment)}</p>
  <h2>Uncertainty and alternatives</h2><p>${escapeHtml(report.contraryEvidence)} ${escapeHtml(report.limitations)}</p>
  <p class="notice"><b>Interpretation safeguard:</b> Community membership and graph connection are not proof of wrongdoing.</p>
  <h2>Recommended next action</h2><p>${escapeHtml(report.nextAction)}</p>
  <h2>Chart workspace packet</h2><p>${escapeHtml(exportBriefingChart(chartWorkspace, graphSource(), state.settings).provenance.warning)}</p>
  <h2>Semantic evidence table</h2><table><thead><tr><th>Relationship</th><th>Event time</th><th>Known at</th><th>Evidence</th></tr></thead><tbody>
  ${rows.map((row) => `<tr><td>${escapeHtml(row.subjectLabel)} ${escapeHtml(row.predicate)} ${escapeHtml(row.objectLabel)}</td><td>${escapeHtml(row.eventTime)}</td><td>${escapeHtml(row.knownAt)}</td><td>${escapeHtml(row.source)} · ${escapeHtml(row.confidence)}</td></tr>`).join("")}
  </tbody></table><h2>Provenance appendix</h2><ol>${report.dependencies.map((source) => `<li>${escapeHtml(source)}</li>`).join("")}</ol></body></html>`;
}

elements.stepList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-step]");
  if (button) changeStep(Number(button.dataset.step));
});
elements.backStep.addEventListener("click", () => changeStep(state.stepIndex - 1));
elements.nextStep.addEventListener("click", () => {
  if (state.stepIndex === activeWorkflow().steps.length - 1) {
    document.querySelector(".report-card").scrollIntoView({ behavior: "smooth" });
  } else {
    changeStep(state.stepIndex + 1);
  }
});

elements.useCaseMode.addEventListener("change", (event) => {
  activeUseCase = event.target.value;
  const workflow = activeUseCase === "fraud" ? activeWorkflow() : null;
  state = activeUseCase === "fraud"
    ? { ...financialInitialState(), selectedId: workflow?.relationships?.[0]?.id ?? "tx-004" }
    : createInitialState();
  activeInspectorTab = "evidence";
  resetGraphView();
  chartWorkspace = createChartWorkspace();
  bloomExploration = { phrase: "", result: null, presetId: "financial-flow", ruleStyle: "default" };
  render();
  setStatus(activeUseCase === "fraud"
    ? "Cuentas mulas and fraud-ring training case loaded"
    : "Temporal community split training case loaded");
});

elements.scopeToggle.addEventListener("click", () => {
  elements.scopeDrawer.hidden = !elements.scopeDrawer.hidden;
  elements.scopeToggle.setAttribute("aria-expanded", String(!elements.scopeDrawer.hidden));
});
elements.loadSampleCsv.addEventListener("click", () => {
  elements.transactionFormat.value = "csv";
  elements.transactionCsv.value = SAMPLE_TRANSACTION_CSV;
  importPreview = null;
  renderImportPreview();
  setStatus("Sample transaction CSV loaded for preview");
});
elements.loadSampleJson.addEventListener("click", () => {
  elements.transactionFormat.value = "json";
  elements.transactionCsv.value = SAMPLE_TRANSACTION_JSON;
  importPreview = null;
  renderImportPreview();
  setStatus("Sample transaction JSON loaded for preview");
});
elements.transactionFormat.addEventListener("change", () => {
  importPreview = null;
  renderImportPreview();
  setStatus(`${elements.transactionFormat.value.toUpperCase()} import mode selected`);
});
elements.transactionCsv.addEventListener("input", () => {
  importPreview = null;
  renderMappingControls();
});
elements.previewImport.addEventListener("click", () => {
  const format = elements.transactionFormat.value;
  importPreview = previewTransactionImport(elements.transactionCsv.value, {
    format,
    fileName: `training-transactions.${format}`,
    mapping: currentMappingOverrides(),
  });
  renderImportPreview();
  setStatus(`Import preview: ${importPreview.summary.accepted} accepted, ${importPreview.summary.rejected} rejected`);
});
elements.applyImport.addEventListener("click", () => {
  if (!importPreview || importPreview.summary.accepted === 0) {
    setStatus("No accepted imported rows to analyze");
    return;
  }
  activeUseCase = "fraud";
  importedFraudWorkflow = createImportedFraudWorkflow(importPreview);
  state = { ...financialInitialState(), selectedId: importedFraudWorkflow.relationships[0]?.id ?? "tx-004" };
  activeInspectorTab = "evidence";
  resetGraphView();
  chartWorkspace = createChartWorkspace();
  bloomExploration = { phrase: "", result: null, presetId: "financial-flow", ruleStyle: "default" };
  render();
  setStatus(`Imported ${importPreview.summary.accepted} transactions into the fraud-ring workflow`);
});
elements.visualControls.addEventListener("click", () => {
  elements.visualPopover.hidden = !elements.visualPopover.hidden;
  elements.visualControls.setAttribute("aria-expanded", String(!elements.visualPopover.hidden));
});

["comparisonMode", "relationFilter", "windowDays", "labelDensity", "visualStyle"].forEach((id) => {
  elements[id].addEventListener("change", (event) => {
    const value = id === "windowDays" ? Number(event.target.value) : event.target.value;
    changeSetting(id, value);
  });
});
elements.spacing.addEventListener("input", (event) => changeSetting("spacing", Number(event.target.value)));
elements.showCommunities.addEventListener("change", (event) => changeSetting("showCommunities", event.target.checked));
elements.highContrast.addEventListener("change", (event) => changeSetting("highContrast", event.target.checked));
elements.aliasIncluded.addEventListener("change", (event) => changeSetting("aliasIncluded", event.target.checked));
elements.rotateLeft.addEventListener("click", () => changeGraphRotation(-15));
elements.rotateRight.addEventListener("click", () => changeGraphRotation(15));
elements.graphUndo.addEventListener("click", undoGraphLayout);
elements.graphRedo.addEventListener("click", redoGraphLayout);
elements.resetLayout.addEventListener("click", () => {
  pushLayoutHistory();
  graphView = { ...graphView, positions: {}, rotation: 0 };
  render();
  setStatus("Graph layout reset to the recommended baseline");
});
elements.nodeVisualTarget.addEventListener("change", () => {
  elements.nodeIconPreset.value = graphView.nodeVisuals[elements.nodeVisualTarget.value]?.icon ?? "default";
});
elements.nodeIconPreset.addEventListener("change", (event) => {
  const nodeId = elements.nodeVisualTarget.value;
  pushLayoutHistory();
  graphView = setNodeIcon(graphView, nodeId, event.target.value);
  render();
  setStatus(`Presentation icon updated for ${activeWorkflow().nodeById(nodeId).label}`);
});
elements.nodeImageUpload.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  const nodeId = elements.nodeVisualTarget.value;
  if (!file) return;
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const validation = validateNodeImage({ type: file.type, size: file.size, bytes });
  if (!validation.accepted) {
    event.target.value = "";
    setStatus(validation.reason);
    return;
  }
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
  pushLayoutHistory();
  graphView = setNodeImage(graphView, nodeId, {
    dataUrl,
    type: file.type,
    name: file.name,
    size: file.size,
  });
  event.target.value = "";
  render();
  setStatus(`Presentation image updated for ${activeWorkflow().nodeById(nodeId).label}`);
});
elements.resetNodeVisual.addEventListener("click", () => {
  const nodeId = elements.nodeVisualTarget.value;
  pushLayoutHistory();
  graphView = resetNodeVisual(graphView, nodeId);
  render();
  setStatus(`Presentation visual reset for ${activeWorkflow().nodeById(nodeId).label}`);
});
elements.chartSearch.addEventListener("input", (event) => {
  chartWorkspace = { ...chartWorkspace, query: event.target.value };
  renderChartWorkspace();
});
elements.chartSearchResults.addEventListener("click", (event) => {
  const button = event.target.closest("[data-chart-result]");
  if (!button) return;
  const result = chartSearchResults()[Number(button.dataset.chartResult)];
  chartWorkspace = commitWorkspaceChange(chartWorkspace, pinSearchResult(chartWorkspace, result, graphSource(), state.settings));
  renderChartWorkspace();
  setStatus(`Pinned ${result.label} to the chart workspace`);
});
elements.pinFirstResult.addEventListener("click", () => {
  const result = chartSearchResults()[0];
  if (!result) {
    setStatus("No search result to pin");
    return;
  }
  chartWorkspace = commitWorkspaceChange(chartWorkspace, pinSearchResult(chartWorkspace, result, graphSource(), state.settings));
  renderChartWorkspace();
  setStatus(`Pinned ${result.label} to the chart workspace`);
});
elements.saveSearch.addEventListener("click", () => {
  const before = chartWorkspace.savedSearches.length;
  chartWorkspace = commitWorkspaceChange(chartWorkspace, saveSearch(chartWorkspace, chartWorkspace.query, graphSource(), state.settings));
  renderChartWorkspace();
  setStatus(chartWorkspace.savedSearches.length > before ? "Search saved with authorized projection bounds" : "Enter a search before saving");
});
elements.expandSelected.addEventListener("click", () => {
  const workflow = activeWorkflow();
  const relationship = workflow.relationshipById(state.selectedId);
  if (!relationship) return;
  const expandedOnce = expandNeighbors(chartWorkspace, graphSource(), state.settings, relationship.subject);
  chartWorkspace = commitWorkspaceChange(chartWorkspace, expandNeighbors(expandedOnce, graphSource(), state.settings, relationship.object));
  renderChartWorkspace();
  setStatus("Expanded selected relationship endpoints in the chart workspace");
});
elements.findPath.addEventListener("click", () => {
  const workflow = activeWorkflow();
  const relationship = workflow.relationshipById(state.selectedId);
  const startId = chartWorkspace.pinnedNodeIds[0] ?? relationship?.subject;
  const endId = chartWorkspace.pinnedNodeIds.at(-1) ?? relationship?.object;
  chartWorkspace = commitWorkspaceChange(chartWorkspace, setPath(chartWorkspace, graphSource(), state.settings, startId, endId));
  renderChartWorkspace();
  setStatus(chartWorkspace.pathNodeIds.length ? "Path added to chart workspace" : "No path found in visible authorized graph");
});
elements.addAnnotation.addEventListener("click", () => {
  const workflow = activeWorkflow();
  const relationship = workflow.relationshipById(state.selectedId);
  const targetId = relationship?.id ?? state.selectedId;
  const before = chartWorkspace.annotations.length;
  chartWorkspace = commitWorkspaceChange(chartWorkspace, addAnnotation(chartWorkspace, elements.annotationText.value, targetId));
  elements.annotationText.value = "";
  renderChartWorkspace();
  setStatus(chartWorkspace.annotations.length > before ? "Analyst annotation added without changing evidence" : "Annotation text was empty");
});
elements.addWorkspaceComment.addEventListener("click", () => {
  const workflow = activeWorkflow();
  const relationship = workflow.relationshipById(state.selectedId);
  const before = chartWorkspace.comments.length;
  chartWorkspace = commitWorkspaceChange(chartWorkspace, addComment(chartWorkspace, elements.workspaceComment.value, relationship?.id ?? state.selectedId));
  elements.workspaceComment.value = "";
  renderChartWorkspace();
  setStatus(chartWorkspace.comments.length > before ? "Workspace comment added as analyst note, not evidence" : "Comment text was empty");
});
elements.addCaseNote.addEventListener("click", () => {
  const before = chartWorkspace.caseNotes.length;
  chartWorkspace = commitWorkspaceChange(chartWorkspace, addCaseNote(chartWorkspace, elements.caseNoteText.value));
  elements.caseNoteText.value = "";
  renderChartWorkspace();
  setStatus(chartWorkspace.caseNotes.length > before ? "Case note added without changing evidence" : "Case note text was empty");
});
elements.setTaskStatus.addEventListener("click", () => {
  const before = JSON.stringify(chartWorkspace.taskStates);
  chartWorkspace = commitWorkspaceChange(chartWorkspace, setTaskState(chartWorkspace, elements.taskLabel.value, elements.taskStatus.value));
  elements.taskLabel.value = "";
  renderChartWorkspace();
  setStatus(JSON.stringify(chartWorkspace.taskStates) !== before ? "Workspace task state updated" : "Task label was empty");
});
elements.setReviewStatus.addEventListener("click", () => {
  chartWorkspace = commitWorkspaceChange(chartWorkspace, setReviewStatus(chartWorkspace, elements.reviewStatus.value));
  renderChartWorkspace();
  setStatus(`Review status set to ${chartWorkspace.reviewStatus}; no guilt or enforcement claim added`);
});
elements.addManualEntity.addEventListener("click", () => {
  const before = chartWorkspace.manualEntities.length;
  chartWorkspace = commitWorkspaceChange(chartWorkspace, addManualEntity(
    chartWorkspace,
    elements.manualEntityLabel.value,
    elements.manualEntityType.value,
    { style: elements.manualEntityStyle.value },
  ));
  elements.manualEntityLabel.value = "";
  renderChartWorkspace();
  setStatus(chartWorkspace.manualEntities.length > before ? "Manual chart entity added as analyst-created, not evidence" : "Manual entity label was empty");
});
elements.moveManualEntity.addEventListener("click", () => {
  const targetId = chartWorkspace.manualEntities[0]?.id;
  if (!targetId) {
    setStatus("No manual chart entity to move");
    return;
  }
  chartWorkspace = commitWorkspaceChange(chartWorkspace, moveManualEntity(chartWorkspace, targetId, 9, 6));
  renderChartWorkspace();
  setStatus("Manual chart entity moved as presentation coordinates only");
});
elements.addManualEdge.addEventListener("click", () => {
  const before = chartWorkspace.manualEdges.length;
  let next = addManualEdge(chartWorkspace, elements.manualEdgeSource.value, elements.manualEdgeTarget.value, elements.manualEdgeLabel.value);
  const created = next.manualEdges.at(-1);
  if (created && created.id && elements.manualEdgeStyle.value !== "solid") {
    next = editManualEdge(next, created.id, { style: elements.manualEdgeStyle.value });
  }
  chartWorkspace = commitWorkspaceChange(chartWorkspace, next);
  elements.manualEdgeLabel.value = "";
  renderChartWorkspace();
  setStatus(chartWorkspace.manualEdges.length > before ? "Manual chart link added as analyst-created, not evidence" : "Manual link needs two different endpoints");
});
elements.redactChartItem.addEventListener("click", () => {
  const targetId = chartWorkspace.manualEntities[0]?.id
    ?? chartWorkspace.pinnedNodeIds[0]
    ?? state.selectedId;
  chartWorkspace = commitWorkspaceChange(chartWorkspace, redactChartItem(chartWorkspace, targetId));
  renderChartWorkspace();
  setStatus("Chart item redacted in the briefing view only");
});
elements.restoreRedactions.addEventListener("click", () => {
  chartWorkspace = commitWorkspaceChange(chartWorkspace, restoreRedactions(chartWorkspace));
  renderChartWorkspace();
  setStatus("Chart redactions restored in the briefing view");
});
elements.exportChart.addEventListener("click", () => {
  const packet = exportBriefingChart(chartWorkspace, graphSource(), state.settings);
  const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${activeWorkflow().exportName}-chart-packet-v${state.analysisVersion}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setStatus(`Briefing chart export ${packet.status}; manual items remain outside evidence`);
});
elements.saveWorkspaceSnapshot.addEventListener("click", () => {
  chartWorkspace = commitWorkspaceChange(chartWorkspace, saveWorkspaceSnapshot(chartWorkspace, elements.layoutName.value || "Investigation workspace"));
  const persisted = persistWorkspaceSnapshot();
  elements.layoutName.value = "";
  renderChartWorkspace();
  setStatus(persisted ? "Workspace saved locally for reload and review" : "Workspace snapshot saved in session only");
});
elements.restoreWorkspaceSnapshot.addEventListener("click", () => {
  const snapshot = chartWorkspace.savedWorkspaceSnapshot ?? readWorkspaceSnapshot();
  chartWorkspace = commitWorkspaceChange(chartWorkspace, restoreWorkspaceSnapshot(chartWorkspace, snapshot));
  renderChartWorkspace();
  setStatus(snapshot ? "Workspace reloaded from saved snapshot" : "No saved workspace snapshot found");
});
elements.prepareCasePacket.addEventListener("click", () => {
  const packet = exportCasePacket(chartWorkspace, graphSource(), state.settings);
  const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${activeWorkflow().exportName}-case-packet-v${state.analysisVersion}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setStatus(`Case packet ${packet.status}; review aid only and not a guilt determination`);
});
elements.saveLayout.addEventListener("click", () => {
  chartWorkspace = commitWorkspaceChange(chartWorkspace, saveLayout(chartWorkspace, elements.layoutName.value, graphView));
  elements.layoutName.value = "";
  renderChartWorkspace();
  setStatus("Visual layout saved separately from analysis");
});
elements.restoreLayout.addEventListener("click", () => {
  const layout = selectedLayout(chartWorkspace);
  if (!layout) return;
  pushLayoutHistory();
  graphView = {
    ...graphView,
    positions: structuredClone(layout.positions),
    rotation: layout.rotation,
    nodeVisuals: structuredClone(layout.nodeVisuals ?? graphView.nodeVisuals ?? {}),
  };
  render();
  setStatus(`Restored saved layout: ${layout.name}`);
});
elements.workspaceUndo.addEventListener("click", () => {
  chartWorkspace = undoWorkspaceChange(chartWorkspace);
  renderChartWorkspace();
  setStatus("Chart workspace undo applied");
});
elements.workspaceRedo.addEventListener("click", () => {
  chartWorkspace = redoWorkspaceChange(chartWorkspace);
  renderChartWorkspace();
  setStatus("Chart workspace redo applied");
});
elements.runBloomPhrase.addEventListener("click", () => {
  const phrase = elements.bloomPhrase.value;
  const result = executeGraphPhrase(chartWorkspace, phrase, graphSource(), state.settings);
  bloomExploration = {
    ...bloomExploration,
    phrase,
    result,
  };
  if (result.ok) {
    chartWorkspace = commitWorkspaceChange(chartWorkspace, result.workspace);
    renderChartWorkspace();
    setStatus("Graph phrase executed against the authorized visible projection");
  } else {
    renderBloomExploration();
    setStatus(result.explanation);
  }
});
elements.applyScenePreset.addEventListener("click", () => {
  const presetId = elements.scenePreset.value;
  const applied = applyScenePreset(presetId, {
    useCase: bloomUseCase(),
    canSeeInfrastructure: bloomCanSeeInfrastructure(),
  });
  bloomExploration = {
    ...bloomExploration,
    presetId,
    ruleStyle: applied.ruleStyle ?? bloomExploration.ruleStyle,
    result: applied.valid
      ? {
          parsed: { label: `${applied.preset.label} scene` },
          explanation: applied.explanation,
          dependencies: [],
          rows: [],
        }
      : {
          parsed: { label: "Scene preset refused" },
          explanation: applied.reason,
          dependencies: [],
          rows: [],
        },
  };
  if (!applied.valid) {
    renderBloomExploration();
    setStatus(applied.reason);
    return;
  }
  applyExplorationScene(applied.settings);
  render();
  setStatus(`Scene preset applied: ${applied.preset.label}`);
});
elements.resetScenePreset.addEventListener("click", () => {
  const defaults = activeWorkflow().defaults;
  const changed = ["relationFilter", "includeInfrastructure"].some((key) =>
    String(state.settings[key]) !== String(defaults[key]),
  );
  state = {
    ...state,
    settings: {
      ...state.settings,
      relationFilter: defaults.relationFilter,
      includeInfrastructure: defaults.includeInfrastructure,
      labelDensity: defaults.labelDensity,
      visualStyle: defaults.visualStyle ?? "classic",
      showCommunities: defaults.showCommunities,
    },
    analysisVersion: state.analysisVersion + (changed ? 1 : 0),
    preflightRun: changed ? false : state.preflightRun,
  };
  bloomExploration = { phrase: "", result: null, presetId: "financial-flow", ruleStyle: "default" };
  render();
  setStatus("Scene preset reset to the workflow default");
});
elements.resetAnalysis.addEventListener("click", () => {
  if (activeUseCase === "fraud") {
    const changed = ["aliasIncluded", "windowDays", "relationFilter", "riskThreshold", "includeInfrastructure"].some(
      (key) => String(state.settings[key]) !== String(FinancialFraud.DEFAULT_SETTINGS[key]),
    );
    state = {
      ...state,
      settings: {
        ...state.settings,
        aliasIncluded: FinancialFraud.DEFAULT_SETTINGS.aliasIncluded,
        includeInfrastructure: FinancialFraud.DEFAULT_SETTINGS.includeInfrastructure,
        windowDays: FinancialFraud.DEFAULT_SETTINGS.windowDays,
        relationFilter: FinancialFraud.DEFAULT_SETTINGS.relationFilter,
        riskThreshold: FinancialFraud.DEFAULT_SETTINGS.riskThreshold,
      },
      analysisVersion: state.analysisVersion + (changed ? 1 : 0),
      preflightRun: false,
    };
  } else {
    state = resetAnalysis(state);
  }
  render();
  setStatus(`Recommended analysis restored as v${state.analysisVersion}`);
});

document.querySelector(".tab-list").addEventListener("click", (event) => {
  const tab = event.target.closest("[data-tab]");
  if (!tab) return;
  activeInspectorTab = tab.dataset.tab;
  document.querySelectorAll('[role="tab"]').forEach((item) => {
    item.setAttribute("aria-selected", String(item === tab));
  });
  renderInspector();
});

elements.evidenceRows.addEventListener("click", (event) => {
  const row = event.target.closest("[data-id]");
  if (row) selectRelationship(row.dataset.id);
});
elements.evidenceRows.addEventListener("keydown", (event) => {
  const row = event.target.closest("[data-id]");
  if (row && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    selectRelationship(row.dataset.id);
  }
});

elements.markFinding.addEventListener("click", () => {
  state = { ...state, findingReady: true, stepIndex: Math.max(state.stepIndex, 5) };
  render();
  setStatus("Preliminary finding marked ready");
});
elements.runPreflight.addEventListener("click", () => {
  const result = activeWorkflow().runPreflight(state);
  state = { ...state, preflightRun: result.passed, stepIndex: Math.max(state.stepIndex, 6) };
  render();
  elements.preflightResults.hidden = false;
  elements.preflightResults.innerHTML = `<ul>${result.checks.map(([label, passed]) => `<li>${passed ? "" : "Needs attention: "}${escapeHtml(label)}</li>`).join("")}</ul>`;
  setStatus(result.passed ? "Report preflight passed" : "Report preflight needs attention");
});
elements.exportReport.addEventListener("click", () => {
  const blob = new Blob([reportHtml()], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${activeWorkflow().exportName}-v${state.analysisVersion}.html`;
  link.click();
  URL.revokeObjectURL(url);
  setStatus("Accessible HTML training report exported");
});

elements.askAssistant.addEventListener("click", () => {
  const answer = answerGraphQuestion({
    prompt: elements.assistantPrompt.value,
    source: graphSource(),
    settings: state.settings,
    report: activeWorkflow().reportModel(state),
  });
  assistantDraft = answer;
  elements.assistantOutput.innerHTML = answer.refused
    ? `<div class="workspace-item"><b>Refused</b><small>${escapeHtml(answer.reason)}</small></div>`
    : `<div class="workspace-item"><b>Source-grounded answer</b><small>${escapeHtml(answer.answer)}</small></div>
       <div class="workspace-item"><b>Citations</b><small>${answer.citations.map((item) => `${escapeHtml(item.id)} · ${escapeHtml(item.source)}`).join("<br>")}</small></div>
       <div class="workspace-item"><b>Uncertainty</b><small>${answer.uncertainty.map(escapeHtml).join("<br>")}</small></div>`;
  setStatus(answer.refused ? "Assistant refused unsupported request" : "Assistant answer generated with exact citations");
});

elements.draftReport.addEventListener("click", () => {
  assistantDraft = draftNeutralReport({
    source: graphSource(),
    settings: state.settings,
    report: activeWorkflow().reportModel(state),
  });
  elements.assistantOutput.innerHTML = `
    <div class="workspace-item"><b>Neutral report draft</b><small>${escapeHtml(assistantDraft.text).replaceAll("\n", "<br>")}</small></div>
    <div class="workspace-item"><b>Saved as</b><small>${escapeHtml(assistantDraft.savedAs)} · AI text is not evidence.</small></div>
  `;
  setStatus("AI report copilot draft generated as analyst draft, not evidence");
});

elements.redTeamDraft.addEventListener("click", () => {
  const text = assistantDraft?.text ?? assistantDraft?.answer ?? elements.assistantPrompt.value;
  const citations = assistantDraft?.citations?.map((item) => typeof item === "string" ? item : item.id) ?? [];
  const review = redTeamReview(text, citations);
  elements.assistantOutput.innerHTML += `
    <div class="workspace-item"><b>Red-team review: ${review.passed ? "passed" : "needs revision"}</b>
      <small>${review.flags.map(escapeHtml).join("<br>") || "No risky language flags found."}</small>
    </div>
  `;
  setStatus(review.passed ? "AI red-team review passed" : "AI red-team review flagged risky language");
});

elements.helpButton.addEventListener("click", () => elements.helpDialog.showModal());
elements.closeHelp.addEventListener("click", () => elements.helpDialog.close());
elements.helpDialog.addEventListener("close", () => elements.helpButton.focus());

render();
setStatus(
  workbenchBootstrap.transport === "authorized-api"
    ? "Authorized service projection loaded"
    : "Static training fallback loaded",
);
