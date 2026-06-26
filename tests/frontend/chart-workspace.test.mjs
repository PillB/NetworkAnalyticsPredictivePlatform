import test from "node:test";
import assert from "node:assert/strict";

import {
  addAnnotation,
  addManualEdge,
  addManualEntity,
  commitWorkspaceChange,
  createChartWorkspace,
  editManualEdge,
  editManualEntity,
  expandNeighbors,
  exportBriefingChart,
  explainPath,
  pinSearchResult,
  redactChartItem,
  redoWorkspaceChange,
  removeManualEdge,
  removeManualEntity,
  restoreRedactions,
  saveLayout,
  searchGraph,
  selectedLayout,
  semanticChartRows,
  setPath,
  undoWorkspaceChange,
} from "../../packages/graph-renderer/chart-workspace.mjs";
import {
  DEFAULT_SETTINGS,
  NODES,
  nodeById,
  visibleRelationships,
} from "../../packages/guided-workflow/harbor-lantern.mjs";

const source = { nodes: NODES, nodeById, visibleRelationships };

test("chart search finds entities and relationships without mutating evidence", () => {
  const results = searchGraph("Northstar", source, DEFAULT_SETTINGS);
  assert.ok(results.some((result) => result.kind === "node"));
  assert.ok(results.some((result) => /Northstar/i.test(result.label)));
});

test("pinning and expansion build semantic workspace rows", () => {
  let workspace = createChartWorkspace();
  const result = searchGraph("Northstar", source, DEFAULT_SETTINGS)[0];
  workspace = pinSearchResult(workspace, result, source, DEFAULT_SETTINGS);
  workspace = expandNeighbors(workspace, source, DEFAULT_SETTINGS, workspace.pinnedNodeIds[0]);
  const rows = semanticChartRows(workspace, source);
  assert.ok(rows.length >= 1);
  assert.ok(rows.every((row) => row.label && row.type));
});

test("path finding records path nodes and relationships separately", () => {
  let workspace = createChartWorkspace();
  workspace = setPath(workspace, source, DEFAULT_SETTINGS, "northstar", "halcyon");
  assert.ok(workspace.pathNodeIds.includes("northstar"));
  assert.ok(workspace.pathNodeIds.includes("halcyon"));
  assert.ok(workspace.pathRelationshipIds.length >= 1);
  const explanation = explainPath(workspace, source, DEFAULT_SETTINGS);
  assert.equal(explanation.length, workspace.pathRelationshipIds.length);
  assert.ok(explanation.every((step) => step.source && step.eventTime && step.knownAt));
});

test("annotations are analyst commentary and layouts are separate visual state", () => {
  let workspace = createChartWorkspace();
  workspace = addAnnotation(workspace, "Check source before briefing", "r2");
  workspace = saveLayout(workspace, "Briefing view", {
    positions: { northstar: { x: 40, y: 44 } },
    rotation: 15,
    nodeVisuals: { northstar: { icon: "organization", image: null } },
  });
  assert.equal(workspace.annotations[0].classification, "analyst annotation");
  assert.equal(selectedLayout(workspace).name, "Briefing view");
  assert.deepEqual(selectedLayout(workspace).positions.northstar, { x: 40, y: 44 });
  assert.equal(selectedLayout(workspace).nodeVisuals.northstar.icon, "organization");
});

test("workspace undo and redo reverse chart authoring without evidence mutation", () => {
  let workspace = createChartWorkspace();
  const result = searchGraph("Northstar", source, DEFAULT_SETTINGS)[0];
  workspace = commitWorkspaceChange(workspace, pinSearchResult(workspace, result, source, DEFAULT_SETTINGS));
  assert.ok(workspace.pinnedNodeIds.length >= 1);
  assert.equal(workspace.undoStack.length, 1);

  const undone = undoWorkspaceChange(workspace);
  assert.deepEqual(undone.pinnedNodeIds, []);
  assert.equal(undone.redoStack.length, 1);

  const redone = redoWorkspaceChange(undone);
  assert.deepEqual(redone.pinnedNodeIds, workspace.pinnedNodeIds);
  assert.equal(redone.redoStack.length, 0);
});

test("manual chart reducer covers entity, edge, style, redaction, and removal", () => {
  let workspace = createChartWorkspace();
  workspace = addManualEntity(workspace, "Briefing Person", "person");
  workspace = addManualEntity(workspace, "Briefing Account", "account");
  assert.equal(workspace.manualEntities.length, 2);
  workspace = editManualEntity(workspace, "manual-entity-1", { label: "Briefing Source", type: "person" });
  assert.equal(workspace.manualEntities[0].label, "Briefing Source");

  workspace = addManualEdge(workspace, "manual-entity-1", "manual-entity-2", "briefing link");
  assert.equal(workspace.manualEdges[0].evidenceStatus, "not evidence");
  workspace = editManualEdge(workspace, "manual-edge-1", { label: "styled briefing link", style: "dashed" });
  assert.equal(workspace.manualEdges[0].style, "dashed");

  workspace = redactChartItem(workspace, "manual-entity-1");
  assert.equal(semanticChartRows(workspace, source)[0].label, "Redacted chart item");
  workspace = restoreRedactions(workspace);
  assert.deepEqual(workspace.redactedItemIds, []);

  workspace = removeManualEdge(workspace, "manual-edge-1");
  assert.equal(workspace.manualEdges.length, 0);
  workspace = removeManualEntity(workspace, "manual-entity-2");
  assert.equal(workspace.manualEntities.length, 1);
});

test("briefing chart export blocks unsupported factual claims and preserves provenance", () => {
  let workspace = createChartWorkspace();
  workspace = addManualEntity(workspace, "Unverified briefing node", "account");
  workspace = addManualEdge(workspace, "manual-entity-1", "northstar", "unverified link");
  workspace = setPath(workspace, source, DEFAULT_SETTINGS, "northstar", "halcyon");
  workspace = addAnnotation(workspace, "Use only as briefing context", "manual-entity-1");
  workspace = redactChartItem(workspace, "manual-entity-1");

  const exported = exportBriefingChart(workspace, source, DEFAULT_SETTINGS);
  assert.equal(exported.contract, "BriefingChartExportV1");
  assert.equal(exported.status, "blocked-for-factual-claims");
  assert.ok(exported.unsupportedClaims.includes("manual-entity-1"));
  assert.ok(exported.unsupportedClaims.includes("manual-edge-1"));
  assert.ok(exported.provenance.pathDependencies.length >= 1);
  assert.equal(exported.manualEntities[0].label, "Redacted chart item");
  assert.match(exported.provenance.warning, /not evidence/i);
});
