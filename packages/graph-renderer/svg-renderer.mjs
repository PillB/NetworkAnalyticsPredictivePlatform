import {
  BUILT_IN_NODE_ICONS,
  nodePoint,
  unprojectPoint,
} from "./layout-model.mjs";

const NS = "http://www.w3.org/2000/svg";

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function point(node, spacing, positions = {}, rotation = 0) {
  return nodePoint(node, spacing, positions, rotation);
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

function decorateNode(group, node, x, y, visual) {
  if (visual?.image?.dataUrl) {
    const image = svgElement("image", {
      href: visual.image.dataUrl,
      x: x - 4.8,
      y: y - 4.8,
      width: 9.6,
      height: 9.6,
      class: "node-image",
      preserveAspectRatio: "xMidYMid slice",
    });
    group.append(image);
    return;
  }
  const glyph = BUILT_IN_NODE_ICONS[visual?.icon] || "";
  if (glyph) {
    const icon = svgElement("text", {
      x,
      y: y + 1.6,
      "text-anchor": "middle",
      class: "node-icon",
      "aria-hidden": "true",
    });
    icon.textContent = glyph;
    group.append(icon);
  }
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
    nodeVisuals = {},
    onSelect = () => {},
    onNodeMoveStart = () => {},
    onNodeMovePreview = () => {},
    onNodeMoveEnd = () => {},
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
    const visual = nodeVisuals[node.id] ?? {};
    const group = svgElement("g", {
      class: `graph-node type-${node.type}`,
      tabindex: 0,
      "data-node-id": node.id,
      "aria-label": `${node.label}. Drag to reposition this node in the visualization only.`,
    });
    group.append(nodeShape(node, x, y));
    decorateNode(group, node, x, y, visual);
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
    let pendingFrame = 0;
    let lastPosition = { x, y };
    group.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      group.setPointerCapture(event.pointerId);
      onNodeMoveStart(node.id);
    });
    group.addEventListener("pointermove", (event) => {
      if (!group.hasPointerCapture(event.pointerId)) return;
      const next = svgPoint(svg, event);
      lastPosition = next;
      if (pendingFrame) return;
      pendingFrame = requestAnimationFrame(() => {
        pendingFrame = 0;
        group.setAttribute("transform", `translate(${lastPosition.x - x} ${lastPosition.y - y})`);
        onNodeMovePreview(node.id, unprojectPoint(lastPosition, spacing, rotation));
      });
    });
    group.addEventListener("pointerup", (event) => {
      if (pendingFrame) {
        cancelAnimationFrame(pendingFrame);
        pendingFrame = 0;
      }
      if (group.hasPointerCapture(event.pointerId)) group.releasePointerCapture(event.pointerId);
      onNodeMoveEnd(node.id, unprojectPoint(lastPosition, spacing, rotation));
    });
    svg.append(group);
  });

  if (comparisonMode === "difference") {
    svg.classList.add("difference-mode");
  } else {
    svg.classList.remove("difference-mode");
  }
}
