export function createChartWorkspace() {
  return {
    query: "",
    pinnedNodeIds: [],
    expandedNodeIds: [],
    pathNodeIds: [],
    pathRelationshipIds: [],
    manualEntities: [],
    manualEdges: [],
    annotations: [],
    redactedItemIds: [],
    savedLayouts: [],
    selectedSavedLayoutId: "",
    undoStack: [],
    redoStack: [],
  };
}

function nextId(prefix, items) {
  return `${prefix}-${items.length + 1}`;
}

function normalized(value) {
  return String(value ?? "").trim().toLowerCase();
}

function unique(values) {
  return [...new Set(values)];
}

function clampCoordinate(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(5, Math.min(95, number));
}

function withoutHistory(workspace) {
  const {
    undoStack: _undoStack,
    redoStack: _redoStack,
    ...rest
  } = workspace;
  return structuredClone(rest);
}

export function commitWorkspaceChange(workspace, nextWorkspace) {
  return {
    ...nextWorkspace,
    undoStack: [...(workspace.undoStack ?? []), withoutHistory(workspace)].slice(-30),
    redoStack: [],
  };
}

export function undoWorkspaceChange(workspace) {
  const undoStack = workspace.undoStack ?? [];
  if (!undoStack.length) return workspace;
  const previous = undoStack.at(-1);
  return {
    ...previous,
    undoStack: undoStack.slice(0, -1),
    redoStack: [...(workspace.redoStack ?? []), withoutHistory(workspace)].slice(-30),
  };
}

export function redoWorkspaceChange(workspace) {
  const redoStack = workspace.redoStack ?? [];
  if (!redoStack.length) return workspace;
  const next = redoStack.at(-1);
  return {
    ...next,
    undoStack: [...(workspace.undoStack ?? []), withoutHistory(workspace)].slice(-30),
    redoStack: redoStack.slice(0, -1),
  };
}

export function searchGraph(query, source, settings) {
  const needle = normalized(query);
  if (!needle) return [];
  const nodeMatches = source.nodes
    .filter((node) => normalized(`${node.label} ${node.type} ${node.role ?? ""}`).includes(needle))
    .map((node) => ({
      kind: "node",
      id: node.id,
      label: node.label,
      detail: `${node.type}${node.role ? ` · ${node.role}` : ""}`,
    }));
  const relationshipMatches = source.visibleRelationships(settings)
    .filter((relationship) => {
      const subject = source.nodeById(relationship.subject);
      const object = source.nodeById(relationship.object);
      return normalized(`${subject?.label} ${relationship.predicate} ${object?.label} ${relationship.source} ${relationship.reasoning}`).includes(needle);
    })
    .map((relationship) => ({
      kind: "relationship",
      id: relationship.id,
      label: `${source.nodeById(relationship.subject)?.label} ${relationship.predicate} ${source.nodeById(relationship.object)?.label}`,
      detail: relationship.source,
    }));
  return [...nodeMatches, ...relationshipMatches].slice(0, 8);
}

export function pinSearchResult(workspace, result, source, settings) {
  if (!result) return workspace;
  if (result.kind === "node") {
    return {
      ...workspace,
      pinnedNodeIds: unique([...workspace.pinnedNodeIds, result.id]),
    };
  }
  const relationship = source.visibleRelationships(settings).find((item) => item.id === result.id);
  if (!relationship) return workspace;
  return {
    ...workspace,
    pinnedNodeIds: unique([...workspace.pinnedNodeIds, relationship.subject, relationship.object]),
  };
}

export function expandNeighbors(workspace, source, settings, nodeId) {
  const relationshipIds = [];
  const neighborIds = [];
  for (const relationship of source.visibleRelationships(settings)) {
    if (relationship.subject === nodeId || relationship.object === nodeId) {
      relationshipIds.push(relationship.id);
      neighborIds.push(relationship.subject, relationship.object);
    }
  }
  return {
    ...workspace,
    expandedNodeIds: unique([...workspace.expandedNodeIds, nodeId, ...neighborIds]),
    pathRelationshipIds: unique([...workspace.pathRelationshipIds, ...relationshipIds]),
  };
}

export function shortestPath(source, settings, startId, endId) {
  if (!startId || !endId || startId === endId) return { nodeIds: startId ? [startId] : [], relationshipIds: [] };
  const adjacency = new Map();
  for (const relationship of source.visibleRelationships(settings)) {
    for (const [from, to] of [[relationship.subject, relationship.object], [relationship.object, relationship.subject]]) {
      if (!adjacency.has(from)) adjacency.set(from, []);
      adjacency.get(from).push({ next: to, relationshipId: relationship.id });
    }
  }
  const queue = [{ nodeId: startId, nodeIds: [startId], relationshipIds: [] }];
  const visited = new Set([startId]);
  while (queue.length) {
    const current = queue.shift();
    for (const edge of adjacency.get(current.nodeId) ?? []) {
      if (visited.has(edge.next)) continue;
      const nextPath = {
        nodeId: edge.next,
        nodeIds: [...current.nodeIds, edge.next],
        relationshipIds: [...current.relationshipIds, edge.relationshipId],
      };
      if (edge.next === endId) {
        return { nodeIds: nextPath.nodeIds, relationshipIds: nextPath.relationshipIds };
      }
      visited.add(edge.next);
      queue.push(nextPath);
    }
  }
  return { nodeIds: [], relationshipIds: [] };
}

export function setPath(workspace, source, settings, startId, endId) {
  const path = shortestPath(source, settings, startId, endId);
  return {
    ...workspace,
    pathNodeIds: path.nodeIds,
    pathRelationshipIds: path.relationshipIds,
  };
}

export function explainPath(workspace, source, settings) {
  const relationships = source.visibleRelationships(settings);
  return workspace.pathRelationshipIds.map((id) => {
    const relationship = relationships.find((item) => item.id === id);
    if (!relationship) {
      return {
        id,
        label: id,
        source: "Relationship is not visible in the current authorized projection",
        caveat: "Hidden or filtered relationships cannot support a visible path explanation.",
      };
    }
    const subject = source.nodeById(relationship.subject);
    const object = source.nodeById(relationship.object);
    return {
      id,
      label: `${subject?.label ?? relationship.subject} ${relationship.predicate} ${object?.label ?? relationship.object}`,
      source: relationship.source,
      eventTime: relationship.eventTime,
      knownAt: relationship.knownAt,
      confidence: relationship.confidence,
      caveat: relationship.caveat,
    };
  });
}

export function addAnnotation(workspace, text, targetId) {
  const clean = String(text ?? "").trim();
  if (!clean) return workspace;
  return {
    ...workspace,
    annotations: [
      ...workspace.annotations,
      {
        id: `note-${workspace.annotations.length + 1}`,
        targetId,
        text: clean,
        classification: "analyst annotation",
      },
    ],
  };
}

export function addManualEntity(workspace, label, type = "entity", options = {}) {
  const clean = String(label ?? "").trim();
  if (!clean) return workspace;
  const index = (workspace.manualEntities ?? []).length;
  const entity = {
    id: nextId("manual-entity", workspace.manualEntities ?? []),
    label: clean,
    type: String(type || "entity").trim().toLowerCase(),
    role: "analyst-created chart entity",
    classification: "analyst chart item",
    evidenceStatus: "not evidence",
    x: clampCoordinate(options.x, 28 + (index % 4) * 14),
    y: clampCoordinate(options.y, 28 + Math.floor(index / 4) * 14),
    style: String(options.style ?? "slate").trim() || "slate",
  };
  return {
    ...workspace,
    manualEntities: [...(workspace.manualEntities ?? []), entity],
  };
}

export function editManualEntity(workspace, entityId, updates = {}) {
  return {
    ...workspace,
    manualEntities: (workspace.manualEntities ?? []).map((entity) => entity.id === entityId
      ? {
          ...entity,
          label: String(updates.label ?? entity.label).trim() || entity.label,
          type: String(updates.type ?? entity.type).trim().toLowerCase() || entity.type,
          style: String(updates.style ?? entity.style ?? "slate").trim() || "slate",
          x: clampCoordinate(updates.x, entity.x ?? 50),
          y: clampCoordinate(updates.y, entity.y ?? 50),
        }
      : entity),
  };
}

export function moveManualEntity(workspace, entityId, deltaX = 0, deltaY = 0) {
  const entity = (workspace.manualEntities ?? []).find((item) => item.id === entityId);
  if (!entity) return workspace;
  return editManualEntity(workspace, entityId, {
    x: Number(entity.x ?? 50) + Number(deltaX ?? 0),
    y: Number(entity.y ?? 50) + Number(deltaY ?? 0),
  });
}

export function removeManualEntity(workspace, entityId) {
  return {
    ...workspace,
    manualEntities: (workspace.manualEntities ?? []).filter((entity) => entity.id !== entityId),
    manualEdges: (workspace.manualEdges ?? []).filter((edge) => edge.sourceId !== entityId && edge.targetId !== entityId),
    redactedItemIds: (workspace.redactedItemIds ?? []).filter((id) => id !== entityId),
  };
}

export function addManualEdge(workspace, sourceId, targetId, label = "related to") {
  if (!sourceId || !targetId || sourceId === targetId) return workspace;
  const edge = {
    id: nextId("manual-edge", workspace.manualEdges ?? []),
    sourceId,
    targetId,
    label: String(label ?? "").trim() || "related to",
    style: "solid",
    classification: "analyst chart link",
    evidenceStatus: "not evidence",
  };
  return {
    ...workspace,
    manualEdges: [...(workspace.manualEdges ?? []), edge],
  };
}

export function editManualEdge(workspace, edgeId, updates = {}) {
  return {
    ...workspace,
    manualEdges: (workspace.manualEdges ?? []).map((edge) => edge.id === edgeId
      ? {
          ...edge,
          label: String(updates.label ?? edge.label).trim() || edge.label,
          style: String(updates.style ?? edge.style).trim() || edge.style,
        }
      : edge),
  };
}

export function removeManualEdge(workspace, edgeId) {
  return {
    ...workspace,
    manualEdges: (workspace.manualEdges ?? []).filter((edge) => edge.id !== edgeId),
    redactedItemIds: (workspace.redactedItemIds ?? []).filter((id) => id !== edgeId),
  };
}

export function redactChartItem(workspace, itemId) {
  if (!itemId) return workspace;
  return {
    ...workspace,
    redactedItemIds: unique([...(workspace.redactedItemIds ?? []), itemId]),
  };
}

export function restoreRedactions(workspace) {
  return { ...workspace, redactedItemIds: [] };
}

export function saveLayout(workspace, name, graphView) {
  const clean = String(name ?? "").trim() || `Layout ${workspace.savedLayouts.length + 1}`;
  const layout = {
    id: `layout-${workspace.savedLayouts.length + 1}`,
    name: clean,
    positions: structuredClone(graphView.positions ?? {}),
    rotation: Number(graphView.rotation ?? 0),
    nodeVisuals: structuredClone(graphView.nodeVisuals ?? {}),
  };
  return {
    ...workspace,
    savedLayouts: [...workspace.savedLayouts, layout],
    selectedSavedLayoutId: layout.id,
  };
}

export function selectedLayout(workspace) {
  return workspace.savedLayouts.find((layout) => layout.id === workspace.selectedSavedLayoutId) ?? null;
}

export function semanticChartRows(workspace, source) {
  const nodeIds = unique([...workspace.pinnedNodeIds, ...workspace.expandedNodeIds, ...workspace.pathNodeIds]);
  const redacted = new Set(workspace.redactedItemIds ?? []);
  const sourceRows = nodeIds.map((id) => {
    const node = source.nodeById(id);
    return {
      id,
      label: redacted.has(id) ? "Redacted chart item" : node?.label ?? id,
      type: node?.type ?? "unknown",
      role: node?.role ?? "not assigned",
      noteCount: workspace.annotations.filter((note) => note.targetId === id).length,
      redacted: redacted.has(id),
      classification: "source projection item",
    };
  });
  const manualRows = (workspace.manualEntities ?? []).map((entity) => ({
    ...entity,
    label: redacted.has(entity.id) ? "Redacted chart item" : entity.label,
    noteCount: workspace.annotations.filter((note) => note.targetId === entity.id).length,
    redacted: redacted.has(entity.id),
  }));
  return [...sourceRows, ...manualRows];
}

export function exportBriefingChart(workspace, source, settings) {
  const redacted = new Set(workspace.redactedItemIds ?? []);
  const pathDependencies = explainPath(workspace, source, settings)
    .filter((step) => !redacted.has(step.id))
    .map((step) => ({
      id: step.id,
      label: step.label,
      source: step.source,
      confidence: step.confidence,
    }));
  const manualEntities = (workspace.manualEntities ?? []).map((entity) => ({
    id: entity.id,
    label: redacted.has(entity.id) ? "Redacted chart item" : entity.label,
    type: entity.type,
    x: redacted.has(entity.id) ? null : entity.x,
    y: redacted.has(entity.id) ? null : entity.y,
    style: redacted.has(entity.id) ? "redacted" : entity.style,
    evidenceStatus: entity.evidenceStatus,
    redacted: redacted.has(entity.id),
  }));
  const manualEdges = (workspace.manualEdges ?? []).map((edge) => ({
    id: edge.id,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    label: redacted.has(edge.id) ? "Redacted chart link" : edge.label,
    style: edge.style,
    evidenceStatus: edge.evidenceStatus,
    redacted: redacted.has(edge.id),
  }));
  const unsupportedClaims = [
    ...manualEntities.filter((entity) => entity.evidenceStatus !== "evidence").map((entity) => entity.id),
    ...manualEdges.filter((edge) => edge.evidenceStatus !== "evidence").map((edge) => edge.id),
  ];
  return {
    contract: "BriefingChartExportV1",
    generatedAt: "training-session",
    status: unsupportedClaims.length ? "blocked-for-factual-claims" : "ready",
    redactionCount: redacted.size,
    provenance: {
      sourceProjection: "current authorized visible graph",
      pathDependencies,
      manualItemCount: manualEntities.length + manualEdges.length,
      noteCount: (workspace.annotations ?? []).length,
      warning: "Manual chart items and analyst annotations are not evidence.",
    },
    manualEntities,
    manualEdges,
    annotations: (workspace.annotations ?? []).map((note) => ({
      ...note,
      text: redacted.has(note.targetId) ? "Redacted analyst note" : note.text,
    })),
    unsupportedClaims,
  };
}
