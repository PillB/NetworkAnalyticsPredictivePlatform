import {
  NODES,
  nodeById,
  visibleRelationships,
} from "../guided-workflow/harbor-lantern.mjs";

const CHANGE_LABELS = {
  appeared: "Appeared later",
  "no-longer-observed": "No longer observed",
  uncertain: "Uncertain",
  observed: "Observed in both",
};

export function buildPeriodModel(period, settings) {
  const edges = visibleRelationships(settings)
    .filter((relationship) => relationship.periods.includes(period))
    .map((relationship) => ({
      ...relationship,
      sourceNode: nodeById(relationship.subject),
      targetNode: nodeById(relationship.object),
      changeLabel: CHANGE_LABELS[relationship.status],
    }));
  const nodeIds = new Set(edges.flatMap((edge) => [edge.subject, edge.object]));
  return {
    period,
    nodes: NODES.filter((node) => nodeIds.has(node.id)),
    edges,
  };
}

export function graphSummary(settings) {
  const before = buildPeriodModel("before", settings);
  const after = buildPeriodModel("after", settings);
  const beforeIds = new Set(before.edges.map((edge) => edge.id));
  const afterIds = new Set(after.edges.map((edge) => edge.id));
  return {
    before,
    after,
    appeared: after.edges.filter((edge) => !beforeIds.has(edge.id)),
    noLongerObserved: before.edges.filter((edge) => !afterIds.has(edge.id)),
    persistent: after.edges.filter((edge) => beforeIds.has(edge.id)),
  };
}

export function semanticRows(settings) {
  return visibleRelationships(settings).map((relationship) => ({
    ...relationship,
    subjectLabel: nodeById(relationship.subject).label,
    objectLabel: nodeById(relationship.object).label,
    periodLabel:
      relationship.periods.length === 2
        ? "Both periods"
        : relationship.periods[0] === "after"
          ? "After only"
          : "Before only",
    changeLabel: CHANGE_LABELS[relationship.status],
  }));
}
