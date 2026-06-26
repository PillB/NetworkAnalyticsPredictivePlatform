import test from "node:test";
import assert from "node:assert/strict";

import {
  addAnnotation,
  createChartWorkspace,
  expandNeighbors,
  pinSearchResult,
  saveLayout,
  searchGraph,
  selectedLayout,
  semanticChartRows,
  setPath,
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
});

test("annotations are analyst commentary and layouts are separate visual state", () => {
  let workspace = createChartWorkspace();
  workspace = addAnnotation(workspace, "Check source before briefing", "r2");
  workspace = saveLayout(workspace, "Briefing view", {
    positions: { northstar: { x: 40, y: 44 } },
    rotation: 15,
  });
  assert.equal(workspace.annotations[0].classification, "analyst annotation");
  assert.equal(selectedLayout(workspace).name, "Briefing view");
  assert.deepEqual(selectedLayout(workspace).positions.northstar, { x: 40, y: 44 });
});
