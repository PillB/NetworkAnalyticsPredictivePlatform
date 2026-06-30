import test from "node:test";
import assert from "node:assert/strict";

import {
  ONLINE_DATASET_SOURCES,
  probeOnlineDatasetSources,
} from "../../packages/guided-workflow/online-dataset-adapters.mjs";

test("online dataset source catalog separates sensitive adapter-only data from embedded fixtures", () => {
  assert.ok(ONLINE_DATASET_SOURCES.some((source) => source.id === "elliptic-plusplus-readme"));
  assert.ok(ONLINE_DATASET_SOURCES.some((source) => source.id === "ibm-amlsim-readme"));
  assert.ok(ONLINE_DATASET_SOURCES.some((source) => source.id === "dgraph-fin-paper"));
  assert.ok(ONLINE_DATASET_SOURCES.some((source) => source.id === "gadbench-readme"));
  assert.ok(ONLINE_DATASET_SOURCES.some((source) => source.id === "networkrepository-crime"));
  for (const source of ONLINE_DATASET_SOURCES) {
    assert.match(source.url, /^https:\/\//);
    assert.ok(source.expectedUse);
    assert.equal(source.embeddable, false);
  }
});

test("online dataset probes fail closed when network is unavailable", async () => {
  const results = await probeOnlineDatasetSources({
    fetchImpl: async () => {
      throw new Error("network disabled");
    },
  });
  assert.equal(results.length, ONLINE_DATASET_SOURCES.length);
  assert.ok(results.every((result) => result.status === "blocked"));
  assert.ok(results.every((result) => /network disabled|unavailable/.test(result.reason)));
});

test("reachable sensitive datasets remain adapter-only rather than success", async () => {
  const results = await probeOnlineDatasetSources({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => "x".repeat(200),
    }),
  });
  const elliptic = results.find((result) => result.id === "elliptic-plusplus-readme");
  assert.equal(elliptic.status, "blocked-adapter-only");
  assert.match(elliptic.reason, /not embedded|adapter/i);
});
