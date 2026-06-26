export function createChartWorkspace() {
  return {
    query: "",
    pinnedNodeIds: [],
    expandedNodeIds: [],
    pathNodeIds: [],
    pathRelationshipIds: [],
    annotations: [],
    savedLayouts: [],
    selectedSavedLayoutId: "",
    undoStack: [],
    redoStack: [],
  };
}

function normalized(value) {
  return String(value ?? "").trim().toLowerCase();
}

function unique(values) {
  return [...new Set(values)];
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

export function saveLayout(workspace, name, graphView) {
  const clean = String(name ?? "").trim() || `Layout ${workspace.savedLayouts.length + 1}`;
  const layout = {
    id: `layout-${workspace.savedLayouts.length + 1}`,
    name: clean,
    positions: structuredClone(graphView.positions ?? {}),
    rotation: Number(graphView.rotation ?? 0),
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
  return nodeIds.map((id) => {
    const node = source.nodeById(id);
    return {
      id,
      label: node?.label ?? id,
      type: node?.type ?? "unknown",
      role: node?.role ?? "not assigned",
      noteCount: workspace.annotations.filter((note) => note.targetId === id).length,
    };
  });
}
