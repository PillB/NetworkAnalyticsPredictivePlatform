import test from "node:test";
import assert from "node:assert/strict";

import {
  demoApiBaseUrl,
  loginDemo,
  loadWorkbenchBootstrap,
  logoutDemo,
  staticWorkbenchBootstrap,
  validateWorkbenchBootstrap,
  WorkbenchBootstrapError,
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

test("GitHub Pages can prefer an explicit secure demo API bridge", async () => {
  const payload = staticWorkbenchBootstrap();
  const storage = new Map([
    ["nappDemoApiBaseUrl", "https://demo-api.example.test"],
    ["nappDemoToken", "demo-token"],
  ]);
  const calls = [];
  const result = await loadWorkbenchBootstrap({
    staticDeployment: true,
    storage: {
      getItem: (key) => storage.get(key),
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
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
  assert.equal(calls[0][0], "https://demo-api.example.test/v1/cases/harbor-lantern/workbench");
  assert.equal(calls[0][1].mode, "cors");
  assert.equal(calls[0][1].headers.Authorization, "Bearer demo-token");
});

test("demo login stores only API URL and bearer token client side", async () => {
  const storage = new Map();
  const store = {
    getItem: (key) => storage.get(key),
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  const login = await loginDemo({
    baseUrl: "https://demo-api.example.test/",
    username: "analyst@example.test",
    password: "demo-pass-1",
    storage: store,
    fetchImpl: async (url, options) => {
      assert.equal(url, "https://demo-api.example.test/v1/demo/login");
      assert.equal(options.method, "POST");
      assert.equal(options.mode, "cors");
      return {
        ok: true,
        async json() {
          return {
            contract: "HybridDemoLoginV1",
            token: "demo-token",
            actorId: "demo-analyst",
          };
        },
      };
    },
  });

  assert.equal(login.token, "demo-token");
  assert.equal(demoApiBaseUrl(store), "https://demo-api.example.test");
  assert.equal(storage.get("nappDemoToken"), "demo-token");
  logoutDemo(store);
  assert.equal(storage.has("nappDemoToken"), false);
  assert.equal(storage.get("nappDemoApiBaseUrl"), "https://demo-api.example.test");
});

test("demo API rejects non-HTTPS non-loopback endpoints in the browser client", async () => {
  await assert.rejects(
    () => loginDemo({
      baseUrl: "http://public-demo.example.test",
      username: "x",
      password: "y",
      fetchImpl: async () => ({ ok: false }),
    }),
    /HTTPS/,
  );
});

test("unconfigured network or contract failure uses explicit training fallback", async () => {
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

test("configured demo API failure fails closed instead of using fallback", async () => {
  const storage = new Map([
    ["nappDemoApiBaseUrl", "https://demo-api.example.test"],
    ["nappDemoToken", "demo-token"],
  ]);
  await assert.rejects(
    () => loadWorkbenchBootstrap({
      staticDeployment: true,
      storage: {
        getItem: (key) => storage.get(key),
        setItem: (key, value) => storage.set(key, value),
        removeItem: (key) => storage.delete(key),
      },
      fetchImpl: async () => ({
        ok: false,
        status: 503,
        async json() {
          return {
            detail: {
              error: {
                code: "postgres_demo_not_ready",
                message: "PostgreSQL workbench source is enabled but the secure runtime probe failed.",
              },
            },
          };
        },
      }),
    }),
    (error) => {
      assert.ok(error instanceof WorkbenchBootstrapError);
      assert.equal(error.code, "postgres_demo_not_ready");
      assert.equal(error.status, 503);
      assert.equal(error.endpoint, "https://demo-api.example.test/v1/cases/harbor-lantern/workbench");
      return true;
    },
  );
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
