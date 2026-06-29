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

function defaultSource() {
  return {
    nodes: NODES,
    nodeById,
    visibleRelationships,
  };
}

function sourceFor(source) {
  if (!source) return defaultSource();
  return {
    nodes: source.nodes,
    nodeById: source.nodeById,
    visibleRelationships: source.visibleRelationships,
  };
}

export function buildPeriodModel(period, settings, source) {
  const data = sourceFor(source);
  const edges = data.visibleRelationships(settings)
    .filter((relationship) => relationship.periods.includes(period))
    .map((relationship) => ({
      ...relationship,
      sourceNode: data.nodeById(relationship.subject),
      targetNode: data.nodeById(relationship.object),
      changeLabel: CHANGE_LABELS[relationship.status],
    }));
  const nodeIds = new Set(edges.flatMap((edge) => [edge.subject, edge.object]));
  return {
    period,
    nodes: data.nodes.filter((node) => nodeIds.has(node.id)),
    edges,
  };
}

export function graphSummary(settings, source) {
  const before = buildPeriodModel("before", settings, source);
  const after = buildPeriodModel("after", settings, source);
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

function eventMillis(relationship) {
  const normalized = String(relationship.eventTime ?? "")
    .replace(" UTC", "Z")
    .replace(" ", "T");
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildTimelineSplitModels(settings, source, splitCount = 3) {
  const data = sourceFor(source);
  const visible = data.visibleRelationships(settings)
    .map((relationship) => ({
      ...relationship,
      sourceNode: data.nodeById(relationship.subject),
      targetNode: data.nodeById(relationship.object),
      changeLabel: CHANGE_LABELS[relationship.status],
      atMs: eventMillis(relationship),
    }))
    .sort((a, b) => a.atMs - b.atMs || String(a.id).localeCompare(String(b.id)));
  const count = Math.max(1, Number(splitCount) || 1);
  const chunkSize = Math.max(1, Math.ceil(visible.length / count));
  return Array.from({ length: count }, (_, index) => {
    const edges = visible.slice(index * chunkSize, (index + 1) * chunkSize);
    const nodeIds = new Set(edges.flatMap((edge) => [edge.subject, edge.object]));
    return {
      period: `slice-${index + 1}`,
      label: `Slice ${index + 1}`,
      nodes: data.nodes.filter((node) => nodeIds.has(node.id)),
      edges,
    };
  }).filter((model) => model.edges.length > 0);
}

export function semanticRows(settings, source) {
  const data = sourceFor(source);
  return data.visibleRelationships(settings).map((relationship) => ({
    ...relationship,
    subjectLabel: data.nodeById(relationship.subject).label,
    objectLabel: data.nodeById(relationship.object).label,
    periodLabel:
      relationship.periods.length === 2
        ? "Both periods"
        : relationship.periods[0] === "after"
          ? "After only"
          : "Before only",
    changeLabel: CHANGE_LABELS[relationship.status],
  }));
}
