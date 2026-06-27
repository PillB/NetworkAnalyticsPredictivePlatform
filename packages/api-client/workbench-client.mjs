import fixture from "../../data/fixtures/harbor-lantern.v1.json" with { type: "json" };

export function validateWorkbenchBootstrap(payload) {
  if (!payload || payload.contract !== "WorkbenchBootstrapV1") {
    throw new Error("Expected WorkbenchBootstrapV1");
  }
  if (
    payload.fixture_schema !== "HarborLanternInterchangeV1" ||
    payload.fixture_version !== "1.0.0"
  ) {
    throw new Error("Workbench fixture version is unsupported");
  }
  for (const field of [
    "case",
    "guided_steps",
    "nodes",
    "relationships",
    "defaults",
    "prioritization",
  ]) {
    if (payload[field] == null) throw new Error(`Workbench bootstrap is missing ${field}`);
  }
  return payload;
}

export function staticWorkbenchBootstrap() {
  return {
    contract: "WorkbenchBootstrapV1",
    fixture_schema: fixture.schema,
    fixture_version: fixture.fixtureVersion,
    case: fixture.case,
    authorization_digest: "static-training-fallback",
    guided_steps: fixture.guidedSteps,
    nodes: fixture.nodes,
    relationships: fixture.relationships,
    defaults: fixture.defaults,
    before_projection: null,
    after_projection: null,
    comparison: null,
    lineage: null,
    prioritization: [],
    report: null,
    excluded_relationship_count: 0,
    transport: "static-training-fallback",
  };
}

function normalizeDemoBaseUrl(value) {
  const clean = String(value ?? "").trim().replace(/\/+$/g, "");
  if (!clean) return "";
  const url = new URL(clean);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !local) {
    throw new Error("Demo API must use HTTPS unless it is loopback-only");
  }
  return url.toString().replace(/\/+$/g, "");
}

export function demoApiBaseUrl(storage = globalThis.localStorage) {
  try {
    return normalizeDemoBaseUrl(storage?.getItem("nappDemoApiBaseUrl") ?? "");
  } catch {
    return "";
  }
}

export async function loginDemo({
  baseUrl,
  username,
  password,
  fetchImpl = globalThis.fetch,
  storage = globalThis.localStorage,
} = {}) {
  const normalized = normalizeDemoBaseUrl(baseUrl);
  const response = await fetchImpl(`${normalized}/v1/demo/login`, {
    method: "POST",
    mode: "cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) throw new Error(`Demo login failed: ${response.status}`);
  const payload = await response.json();
  if (payload.contract !== "HybridDemoLoginV1" || !payload.token) {
    throw new Error("Demo login response is invalid");
  }
  storage?.setItem("nappDemoApiBaseUrl", normalized);
  storage?.setItem("nappDemoToken", payload.token);
  storage?.setItem("nappDemoActorId", payload.actorId ?? "");
  return payload;
}

export function logoutDemo(storage = globalThis.localStorage) {
  storage?.removeItem("nappDemoToken");
  storage?.removeItem("nappDemoActorId");
}

export async function loadWorkbenchBootstrap({
  fetchImpl = globalThis.fetch,
  endpoint = null,
  storage = globalThis.localStorage,
  staticDeployment =
    globalThis.document
      ?.querySelector('meta[name="napp-deployment-mode"]')
      ?.getAttribute("content") === "github-pages-static-training",
} = {}) {
  const demoBaseUrl = demoApiBaseUrl(storage);
  const token = storage?.getItem("nappDemoToken") ?? "";
  const targetEndpoint = endpoint ?? (
    demoBaseUrl
      ? `${demoBaseUrl}/v1/cases/harbor-lantern/workbench`
      : "/v1/cases/harbor-lantern/workbench"
  );
  if (staticDeployment && !demoBaseUrl) return staticWorkbenchBootstrap();
  if (typeof fetchImpl !== "function") {
    return staticWorkbenchBootstrap();
  }
  try {
    const headers = {
      "X-Actor-Id": "guided-training-user",
      "X-Purpose": "training",
      "X-Authorization-Id": "guided-training-session",
      "X-Allowed-Fields": "device_signature,precise_location",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetchImpl(targetEndpoint, {
      mode: demoBaseUrl ? "cors" : "same-origin",
      headers: {
        ...headers,
      },
    });
    if (!response.ok) throw new Error(`Workbench API returned ${response.status}`);
    return {
      ...validateWorkbenchBootstrap(await response.json()),
      transport: "authorized-api",
    };
  } catch {
    return staticWorkbenchBootstrap();
  }
}
