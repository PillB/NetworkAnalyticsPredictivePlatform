export const BUILT_IN_NODE_ICONS = Object.freeze({
  default: "",
  account: "$",
  alert: "!",
  device: "#",
  person: "@",
  place: "+",
  organization: "[]",
});

export const MAX_NODE_IMAGE_BYTES = 512 * 1024;

const IMAGE_SIGNATURES = Object.freeze({
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
});

export function projectPoint(basePoint, spacing = 1, rotation = 0) {
  const scale = 0.82 + Number(spacing) * 0.18;
  const scaled = {
    x: 50 + (Number(basePoint.x) - 50) * scale,
    y: 50 + (Number(basePoint.y) - 50) * scale,
  };
  const radians = (Number(rotation) * Math.PI) / 180;
  const dx = scaled.x - 50;
  const dy = scaled.y - 50;
  return {
    x: 50 + dx * Math.cos(radians) - dy * Math.sin(radians),
    y: 50 + dx * Math.sin(radians) + dy * Math.cos(radians),
  };
}

export function unprojectPoint(projectedPoint, spacing = 1, rotation = 0) {
  const radians = (-Number(rotation) * Math.PI) / 180;
  const dx = Number(projectedPoint.x) - 50;
  const dy = Number(projectedPoint.y) - 50;
  const unrotated = {
    x: 50 + dx * Math.cos(radians) - dy * Math.sin(radians),
    y: 50 + dx * Math.sin(radians) + dy * Math.cos(radians),
  };
  const scale = 0.82 + Number(spacing) * 0.18;
  return {
    x: 50 + (unrotated.x - 50) / scale,
    y: 50 + (unrotated.y - 50) / scale,
  };
}

export function nodePoint(node, spacing = 1, positions = {}, rotation = 0) {
  const base = positions[node.id] ?? { x: node.x, y: node.y };
  return projectPoint(base, spacing, rotation);
}

export function createVisualMetadata() {
  return { nodeVisuals: {} };
}

export function snapshotGraphView(graphView) {
  return {
    positions: structuredClone(graphView.positions ?? {}),
    rotation: Number(graphView.rotation ?? 0),
    nodeVisuals: structuredClone(graphView.nodeVisuals ?? {}),
  };
}

export function pushLayoutCheckpoint(graphView, limit = 20) {
  return {
    ...graphView,
    undo: [...(graphView.undo ?? []), snapshotGraphView(graphView)].slice(-limit),
    redo: [],
  };
}

export function setNodeIcon(metadata, nodeId, icon) {
  const safeIcon = Object.hasOwn(BUILT_IN_NODE_ICONS, icon) ? icon : "default";
  return {
    ...metadata,
    nodeVisuals: {
      ...(metadata.nodeVisuals ?? {}),
      [nodeId]: {
        ...((metadata.nodeVisuals ?? {})[nodeId] ?? {}),
        icon: safeIcon,
        image: null,
      },
    },
  };
}

export function setNodeImage(metadata, nodeId, image) {
  return {
    ...metadata,
    nodeVisuals: {
      ...(metadata.nodeVisuals ?? {}),
      [nodeId]: {
        ...((metadata.nodeVisuals ?? {})[nodeId] ?? {}),
        icon: "default",
        image,
      },
    },
  };
}

export function resetNodeVisual(metadata, nodeId) {
  const next = { ...(metadata.nodeVisuals ?? {}) };
  delete next[nodeId];
  return { ...metadata, nodeVisuals: next };
}

export function validateNodeImage(input) {
  const type = String(input?.type ?? "").toLowerCase();
  const size = Number(input?.size ?? 0);
  const bytes = input?.bytes ? Array.from(input.bytes).slice(0, 12) : [];
  const signature = IMAGE_SIGNATURES[type];

  if (!signature) return { accepted: false, reason: "Only PNG, JPEG, and WebP images are supported" };
  if (size <= 0) return { accepted: false, reason: "Image is empty" };
  if (size > MAX_NODE_IMAGE_BYTES) return { accepted: false, reason: "Image exceeds 512 KB" };
  if (!signature.every((byte, index) => bytes[index] === byte)) {
    return { accepted: false, reason: "Image signature does not match its type" };
  }
  if (type === "image/webp") {
    const webp = [0x57, 0x45, 0x42, 0x50];
    if (!webp.every((byte, index) => bytes[index + 8] === byte)) {
      return { accepted: false, reason: "Image signature does not match its type" };
    }
  }
  return { accepted: true, reason: "Image accepted" };
}
