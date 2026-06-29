import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTimelineSplitModels,
  semanticRows,
} from "../../packages/graph-renderer/graph-model.mjs";

const nodes = [
  { id: "a", label: "A", type: "account" },
  { id: "b", label: "B", type: "account" },
  { id: "c", label: "C", type: "account" },
  { id: "d", label: "D", type: "account" },
];
const relationships = [
  { id: "r3", subject: "c", object: "d", predicate: "paid", periods: ["after"], status: "appeared", eventTime: "2026-01-03 00:00 UTC" },
  { id: "r1", subject: "a", object: "b", predicate: "paid", periods: ["before"], status: "no-longer-observed", eventTime: "2026-01-01 00:00 UTC" },
  { id: "r2", subject: "b", object: "c", predicate: "paid", periods: ["after"], status: "appeared", eventTime: "2026-01-02 00:00 UTC" },
  { id: "r4", subject: "d", object: "a", predicate: "paid", periods: ["after"], status: "appeared", eventTime: "2026-01-04 00:00 UTC" },
  { id: "r5", subject: "a", object: "c", predicate: "paid", periods: ["after"], status: "appeared", eventTime: "2026-01-05 00:00 UTC" },
  { id: "r6", subject: "b", object: "d", predicate: "paid", periods: ["after"], status: "appeared", eventTime: "2026-01-06 00:00 UTC" },
];
const source = {
  nodes,
  nodeById: (id) => nodes.find((node) => node.id === id),
  visibleRelationships: () => relationships,
};

test("timeline split builds chronological visual slices without changing semantic rows", () => {
  const slices = buildTimelineSplitModels({}, source, 3);
  assert.equal(slices.length, 3);
  assert.deepEqual(slices.map((slice) => slice.edges.map((edge) => edge.id)), [
    ["r1", "r2"],
    ["r3", "r4"],
    ["r5", "r6"],
  ]);
  assert.deepEqual(slices.map((slice) => slice.label), ["Slice 1", "Slice 2", "Slice 3"]);
  assert.equal(semanticRows({}, source).length, relationships.length);
});
