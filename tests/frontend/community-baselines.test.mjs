import test from "node:test";
import assert from "node:assert/strict";

import {
  connectedComponents,
  evaluateCommunitySplit,
  labelPropagationCommunities,
} from "../../packages/predictive/community-baselines.mjs";

const nodes = ["a", "b", "c", "d"].map((id) => ({ id }));
const edges = [
  { source: "a", target: "b" },
  { source: "c", target: "d" },
];

test("community baselines are deterministic and auditable", () => {
  assert.deepEqual(connectedComponents({ nodes, edges }), [["a", "b"], ["c", "d"]]);
  const first = labelPropagationCommunities({ nodes, edges, anchors: { a: "left", d: "right" } });
  const second = labelPropagationCommunities({ nodes, edges, anchors: { a: "left", d: "right" } });
  assert.deepEqual(first, second);
  assert.equal(first.labels.b, "left");
  assert.equal(first.labels.c, "right");
});

test("community evaluation excludes uncertain bridge members from hard agreement", () => {
  const evaluation = evaluateCommunitySplit({
    predicted: { a: "left", b: "left", c: "wrong" },
    expected: { a: "left", b: "left", c: "right" },
    uncertain: ["c"],
  });
  assert.equal(evaluation.agreement, 1);
  assert.equal(evaluation.calibrated, false);
  assert.deepEqual(evaluation.uncertainNodes, ["c"]);
});
