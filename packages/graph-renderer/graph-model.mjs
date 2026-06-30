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

function visibleEdgesWithNodes(settings, source) {
  const data = sourceFor(source);
  return data.visibleRelationships(settings)
    .map((relationship) => ({
      ...relationship,
      sourceNode: data.nodeById(relationship.subject),
      targetNode: data.nodeById(relationship.object),
      changeLabel: CHANGE_LABELS[relationship.status],
      atMs: eventMillis(relationship),
    }))
    .sort((a, b) => a.atMs - b.atMs || String(a.id).localeCompare(String(b.id)));
}

function modelFromEdges(label, edges, data = null) {
  const nodeIds = new Set(edges.flatMap((edge) => [edge.subject, edge.object]));
  const nodes = data
    ? data.nodes.filter((node) => nodeIds.has(node.id))
    : [...new Map(edges.flatMap((edge) => [edge.sourceNode, edge.targetNode]).filter(Boolean).map((node) => [node.id, node])).values()];
  return { period: label.toLowerCase().replaceAll(/\s+/g, "-"), label, nodes, edges };
}

export function buildUnifiedModel(settings, source) {
  const data = sourceFor(source);
  return modelFromEdges("Unified graph", visibleEdgesWithNodes(settings, source), data);
}

export function recommendSplit(settings, source) {
  const visible = visibleEdgesWithNodes(settings, source);
  if (visible.length < 2) {
    return {
      strategy: "algorithmic-largest-gap",
      percent: 50,
      label: "Single visible cluster",
      reason: "Not enough dated relationships to infer a split.",
    };
  }
  let bestIndex = 0;
  let bestGap = -1;
  for (let index = 0; index < visible.length - 1; index += 1) {
    const gap = visible[index + 1].atMs - visible[index].atMs;
    if (gap > bestGap) {
      bestGap = gap;
      bestIndex = index;
    }
  }
  const percent = Math.round(((bestIndex + 1) / visible.length) * 100);
  return {
    strategy: "algorithmic-largest-gap",
    percent: Math.min(90, Math.max(10, percent)),
    label: `After ${bestIndex + 1} of ${visible.length} dated relationships`,
    reason: "Default split uses the largest chronological gap in visible evidence as a starting point.",
  };
}

export function buildChronologicalSplitModels(settings, source, splitCount = settings?.splitCount ?? 3) {
  const visible = visibleEdgesWithNodes(settings, source);
  const count = Math.max(1, Number(splitCount) || 1);
  if (count === 1) return [buildUnifiedModel(settings, source)];
  if (count === 2 && settings?.splitStrategy !== "equal") {
    const recommended = recommendSplit(settings, source);
    const boundaryPercent = Number(settings?.splitBoundaryPercent ?? recommended.percent);
    const boundaryIndex = Math.min(
      Math.max(1, Math.round((visible.length * boundaryPercent) / 100)),
      Math.max(1, visible.length - 1),
    );
    return [
      modelFromEdges("Before split", visible.slice(0, boundaryIndex)),
      modelFromEdges("After split", visible.slice(boundaryIndex)),
    ].filter((model) => model.edges.length > 0);
  }
  const chunkSize = Math.max(1, Math.ceil(visible.length / count));
  return Array.from({ length: count }, (_, index) => {
    const edges = visible.slice(index * chunkSize, (index + 1) * chunkSize);
    return modelFromEdges(`Slice ${index + 1}`, edges);
  }).filter((model) => model.edges.length > 0);
}

export function buildTimelineSplitModels(settings, source, splitCount = settings?.splitCount ?? 3) {
  return buildChronologicalSplitModels(settings, source, splitCount);
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
