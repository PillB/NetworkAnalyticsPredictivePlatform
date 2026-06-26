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

export async function loadWorkbenchBootstrap({
  fetchImpl = globalThis.fetch,
  endpoint = "/v1/cases/harbor-lantern/workbench",
  staticDeployment =
    globalThis.document
      ?.querySelector('meta[name="napp-deployment-mode"]')
      ?.getAttribute("content") === "github-pages-static-training",
} = {}) {
  if (staticDeployment) return staticWorkbenchBootstrap();
  if (typeof fetchImpl !== "function") {
    return staticWorkbenchBootstrap();
  }
  try {
    const response = await fetchImpl(endpoint, {
      headers: {
        "X-Actor-Id": "guided-training-user",
        "X-Purpose": "training",
        "X-Authorization-Id": "guided-training-session",
        "X-Allowed-Fields": "device_signature,precise_location",
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
