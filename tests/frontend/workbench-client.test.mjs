import test from "node:test";
import assert from "node:assert/strict";

import {
  loadWorkbenchBootstrap,
  staticWorkbenchBootstrap,
  validateWorkbenchBootstrap,
} from "../../packages/api-client/workbench-client.mjs";

test("static fallback conforms to the service bootstrap contract", () => {
  const payload = validateWorkbenchBootstrap(staticWorkbenchBootstrap());
  assert.equal(payload.contract, "WorkbenchBootstrapV1");
  assert.equal(payload.transport, "static-training-fallback");
  assert.equal(payload.relationships.length, 6);
});

test("authorized API payload is preferred and validated", async () => {
  const payload = staticWorkbenchBootstrap();
  const calls = [];
  const result = await loadWorkbenchBootstrap({
    endpoint: "/contract-test",
    fetchImpl: async (url, options) => {
      calls.push([url, options]);
      return {
        ok: true,
        async json() {
          return { ...payload, transport: undefined };
        },
      };
    },
  });

  assert.equal(result.transport, "authorized-api");
  assert.equal(calls[0][0], "/contract-test");
  assert.equal(calls[0][1].headers["X-Purpose"], "training");
  assert.ok(calls[0][1].headers["X-Authorization-Id"]);
});

test("network or contract failure uses explicit training fallback", async () => {
  const unavailable = await loadWorkbenchBootstrap({
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });
  const invalid = await loadWorkbenchBootstrap({
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return { contract: "WrongContract" };
      },
    }),
  });

  assert.equal(unavailable.transport, "static-training-fallback");
  assert.equal(invalid.transport, "static-training-fallback");
});

test("GitHub Pages deployment does not probe a nonexistent API", async () => {
  let calls = 0;
  const result = await loadWorkbenchBootstrap({
    staticDeployment: true,
    fetchImpl: async () => {
      calls += 1;
      throw new Error("must not be called");
    },
  });

  assert.equal(calls, 0);
  assert.equal(result.transport, "static-training-fallback");
});
