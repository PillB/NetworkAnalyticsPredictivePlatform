import test from "node:test";
import assert from "node:assert/strict";

import {
  createVisualMetadata,
  projectPoint,
  pushLayoutCheckpoint,
  resetNodeVisual,
  setNodeIcon,
  setNodeImage,
  unprojectPoint,
  validateNodeImage,
} from "../../packages/graph-renderer/layout-model.mjs";

test("projection and unprojection round-trip under spacing and rotation", () => {
  const source = { x: 27.5, y: 71.25 };
  for (const spacing of [0.7, 1, 1.35]) {
    for (const rotation of [0, 15, 90, 225]) {
      const projected = projectPoint(source, spacing, rotation);
      const restored = unprojectPoint(projected, spacing, rotation);
      assert.ok(Math.abs(restored.x - source.x) < 0.000001);
      assert.ok(Math.abs(restored.y - source.y) < 0.000001);
    }
  }
});

test("node visual metadata is presentation-only and resettable", () => {
  let metadata = createVisualMetadata();
  metadata = setNodeIcon(metadata, "acct-777", "alert");
  assert.equal(metadata.nodeVisuals["acct-777"].icon, "alert");
  assert.equal(metadata.nodeVisuals["acct-777"].image, null);

  metadata = setNodeImage(metadata, "acct-777", {
    dataUrl: "data:image/png;base64,abc",
    type: "image/png",
    name: "safe.png",
    size: 12,
  });
  assert.equal(metadata.nodeVisuals["acct-777"].icon, "default");
  assert.equal(metadata.nodeVisuals["acct-777"].image.type, "image/png");

  metadata = resetNodeVisual(metadata, "acct-777");
  assert.deepEqual(metadata.nodeVisuals, {});
});

test("one drag start creates one undo checkpoint", () => {
  const initial = {
    positions: { acct: { x: 45, y: 50 } },
    rotation: 15,
    nodeVisuals: { acct: { icon: "account", image: null } },
    undo: [],
    redo: [{ positions: {}, rotation: 0, nodeVisuals: {} }],
  };
  const checkpointed = pushLayoutCheckpoint(initial);
  const afterPointerMoves = {
    ...checkpointed,
    positions: { acct: { x: 46, y: 51 } },
  };
  assert.equal(afterPointerMoves.undo.length, 1);
  assert.deepEqual(afterPointerMoves.undo[0].positions.acct, { x: 45, y: 50 });
  assert.deepEqual(afterPointerMoves.redo, []);
});


test("image validator accepts safe raster images and rejects unsafe uploads", () => {
  assert.equal(validateNodeImage({
    type: "image/png",
    size: 16,
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d],
  }).accepted, true);
  assert.equal(validateNodeImage({
    type: "image/jpeg",
    size: 16,
    bytes: [0xff, 0xd8, 0xff, 0xdb],
  }).accepted, true);
  assert.equal(validateNodeImage({
    type: "image/webp",
    size: 16,
    bytes: [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50],
  }).accepted, true);
  assert.equal(validateNodeImage({
    type: "image/svg+xml",
    size: 16,
    bytes: [0x3c, 0x73, 0x76, 0x67],
  }).accepted, false);
  assert.equal(validateNodeImage({
    type: "image/png",
    size: 600 * 1024,
    bytes: [0x89, 0x50, 0x4e, 0x47],
  }).accepted, false);
  assert.equal(validateNodeImage({
    type: "image/png",
    size: 16,
    bytes: [0x3c, 0x73, 0x76, 0x67],
  }).accepted, false);
});
