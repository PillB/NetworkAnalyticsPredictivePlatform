function neighborsFromEdges(edges) {
  const neighbors = new Map();
  for (const edge of edges) {
    if (!neighbors.has(edge.source)) neighbors.set(edge.source, new Set());
    if (!neighbors.has(edge.target)) neighbors.set(edge.target, new Set());
    neighbors.get(edge.source).add(edge.target);
    neighbors.get(edge.target).add(edge.source);
  }
  return neighbors;
}

export function connectedComponents({ nodes = [], edges = [] } = {}) {
  const neighbors = neighborsFromEdges(edges);
  const remaining = new Set(nodes.map((node) => node.id));
  const components = [];
  while (remaining.size) {
    const start = [...remaining].sort()[0];
    const stack = [start];
    const component = [];
    remaining.delete(start);
    while (stack.length) {
      const nodeId = stack.pop();
      component.push(nodeId);
      for (const neighbor of [...(neighbors.get(nodeId) ?? [])].sort()) {
        if (!remaining.has(neighbor)) continue;
        remaining.delete(neighbor);
        stack.push(neighbor);
      }
    }
    components.push(component.sort());
  }
  return components.sort((a, b) => a[0].localeCompare(b[0]));
}

function majorityLabel(nodeId, labels, neighbors, anchors) {
  if (anchors[nodeId]) return anchors[nodeId];
  const counts = new Map();
  for (const neighbor of neighbors.get(nodeId) ?? []) {
    const label = labels[neighbor];
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? labels[nodeId] ?? null;
}

export function labelPropagationCommunities({
  nodes = [],
  edges = [],
  anchors = {},
  maxIterations = 25,
} = {}) {
  const neighbors = neighborsFromEdges(edges);
  let labels = Object.fromEntries(nodes.map((node) => [node.id, anchors[node.id] ?? null]));
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let changed = false;
    const next = { ...labels };
    for (const node of [...nodes].sort((a, b) => a.id.localeCompare(b.id))) {
      const label = majorityLabel(node.id, labels, neighbors, anchors);
      if (label !== labels[node.id]) changed = true;
      next[node.id] = label;
    }
    labels = next;
    if (!changed) break;
  }
  const communities = {};
  for (const [nodeId, label] of Object.entries(labels)) {
    const resolved = label ?? nodeId;
    if (!communities[resolved]) communities[resolved] = [];
    communities[resolved].push(nodeId);
  }
  return {
    contract: "DeterministicLabelPropagationV1",
    labels: Object.fromEntries(Object.entries(labels).map(([nodeId, label]) => [nodeId, label ?? nodeId])),
    communities: Object.fromEntries(
      Object.entries(communities)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, members]) => [label, members.sort()]),
    ),
  };
}

export function evaluateCommunitySplit({ predicted = {}, expected = {}, uncertain = [] } = {}) {
  const uncertainSet = new Set(uncertain);
  const nodeIds = Object.keys(expected).filter((id) => !uncertainSet.has(id)).sort();
  const correct = nodeIds.filter((id) => predicted[id] === expected[id]).length;
  return {
    contract: "CommunitySplitEvaluationV1",
    evaluatedNodes: nodeIds.length,
    correct,
    agreement: Number((correct / Math.max(1, nodeIds.length)).toFixed(3)),
    uncertainNodes: [...uncertainSet].sort(),
    calibrated: false,
    limitations: [
      "Benchmark-derived labels are teaching annotations, not operational proof of group membership.",
      "Bridge members are surfaced as uncertain instead of forced into a hard conclusion.",
    ],
  };
}
