const NS = "http://www.w3.org/2000/svg";

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function rotateAroundCenter(pointValue, degrees) {
  const radians = (Number(degrees) * Math.PI) / 180;
  const dx = pointValue.x - 50;
  const dy = pointValue.y - 50;
  return {
    x: 50 + dx * Math.cos(radians) - dy * Math.sin(radians),
    y: 50 + dx * Math.sin(radians) + dy * Math.cos(radians),
  };
}

function point(node, spacing, positions = {}, rotation = 0) {
  const base = positions[node.id] ?? { x: node.x, y: node.y };
  const scale = 0.82 + Number(spacing) * 0.18;
  return rotateAroundCenter({
    x: 50 + (base.x - 50) * scale,
    y: 50 + (base.y - 50) * scale,
  }, rotation);
}

function svgPoint(svg, event) {
  const pt = svg.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

function nodeShape(node, x, y) {
  if (node.type === "organization") {
    return svgElement("rect", { x: x - 4.3, y: y - 4.3, width: 8.6, height: 8.6, rx: 1.4 });
  }
  if (node.type === "place") {
    return svgElement("path", { d: `M ${x} ${y - 5} L ${x + 5} ${y} L ${x} ${y + 5} L ${x - 5} ${y} Z` });
  }
  if (node.type === "device") {
    return svgElement("path", { d: `M ${x} ${y - 5} L ${x + 4.8} ${y + 4} L ${x - 4.8} ${y + 4} Z` });
  }
  return svgElement("circle", { cx: x, cy: y, r: 4.6 });
}

export function renderGraph(svg, model, options = {}) {
  const {
    selectedId,
    comparisonMode = "side-by-side",
    labelDensity = "comfortable",
    spacing = 1,
    showCommunities = true,
    positions = {},
    rotation = 0,
    onSelect = () => {},
    onNodeMoveStart = () => {},
    onNodeMove = () => {},
  } = options;
  svg.replaceChildren();
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("role", "img");

  if (showCommunities) {
    const hull = svgElement("ellipse", {
      cx: model.period === "before" ? 49 : 61,
      cy: 50,
      rx: model.period === "before" ? 39 : 26,
      ry: model.period === "before" ? 39 : 33,
      class: "community-hull",
    });
    svg.append(hull);
  }

  model.edges.forEach((edge) => {
    const source = point(edge.sourceNode, spacing, positions, rotation);
    const target = point(edge.targetNode, spacing, positions, rotation);
    const line = svgElement("line", {
      x1: source.x,
      y1: source.y,
      x2: target.x,
      y2: target.y,
      class: `graph-edge evidence-${edge.evidenceClass.replaceAll(" ", "-")} status-${edge.status}${selectedId === edge.id ? " is-selected" : ""}`,
      tabindex: 0,
      "data-id": edge.id,
      "aria-label": `${edge.sourceNode.label} ${edge.predicate} ${edge.targetNode.label}. ${edge.changeLabel}.`,
    });
    line.addEventListener("click", () => onSelect(edge.id));
    line.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") onSelect(edge.id);
    });
    svg.append(line);
  });

  model.nodes.forEach((node) => {
    const { x, y } = point(node, spacing, positions, rotation);
    const group = svgElement("g", {
      class: `graph-node type-${node.type}`,
      tabindex: 0,
      "data-node-id": node.id,
      "aria-label": `${node.label}. Drag to reposition this node in the visualization only.`,
    });
    group.append(nodeShape(node, x, y));
    if (labelDensity !== "minimal" || node.id === "northstar") {
      const label = svgElement("text", {
        x,
        y: y + 8,
        "text-anchor": "middle",
        class: "node-label",
      });
      label.textContent = node.label;
      group.append(label);
    }
    group.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      group.setPointerCapture(event.pointerId);
      onNodeMoveStart(node.id);
    });
    group.addEventListener("pointermove", (event) => {
      if (!group.hasPointerCapture(event.pointerId)) return;
      const next = svgPoint(svg, event);
      onNodeMove(node.id, { x: next.x, y: next.y });
    });
    group.addEventListener("pointerup", (event) => {
      if (group.hasPointerCapture(event.pointerId)) group.releasePointerCapture(event.pointerId);
    });
    svg.append(group);
  });

  if (comparisonMode === "difference") {
    svg.classList.add("difference-mode");
  } else {
    svg.classList.remove("difference-mode");
  }
}
