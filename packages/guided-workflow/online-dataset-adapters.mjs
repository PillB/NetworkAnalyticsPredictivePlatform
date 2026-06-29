export const ONLINE_DATASET_SOURCES = Object.freeze([
  {
    id: "networkx-karate-docs",
    name: "Zachary karate club source documentation",
    domain: "community benchmark",
    url: "https://networkx.org/documentation/stable/reference/generated/networkx.generators.social.karate_club_graph.html",
    expectedUse: "source-citation",
    sensitive: false,
    embeddable: false,
  },
  {
    id: "tgb-linkprop-docs",
    name: "Temporal Graph Benchmark link prediction catalog",
    domain: "temporal graph benchmark",
    url: "https://tgb.complexdatalab.com/docs/linkprop/",
    expectedUse: "adapter-catalog",
    sensitive: false,
    embeddable: false,
  },
  {
    id: "elliptic-plusplus-readme",
    name: "Elliptic++ crypto graph benchmark",
    domain: "crypto transaction benchmark",
    url: "https://raw.githubusercontent.com/git-disl/EllipticPlusPlus/main/README.md",
    expectedUse: "external-adapter-only",
    sensitive: true,
    embeddable: false,
  },
  {
    id: "ibm-amlsim-readme",
    name: "IBM AMLSim synthetic AML generator",
    domain: "synthetic AML generator",
    url: "https://raw.githubusercontent.com/IBM/AMLSim/master/README.md",
    expectedUse: "external-generator",
    sensitive: false,
    embeddable: false,
  },
  {
    id: "snap-email-eu-temporal",
    name: "SNAP email-Eu-core temporal dataset",
    domain: "temporal communication benchmark",
    url: "https://snap.stanford.edu/data/email-Eu-core-temporal.html",
    expectedUse: "external-adapter-only",
    sensitive: true,
    embeddable: false,
  },
  {
    id: "sociopatterns-high-school",
    name: "SocioPatterns high-school contact network",
    domain: "temporal contact benchmark",
    url: "https://sociopatterns.org/datasets/high-school-contact-and-friendship-networks/",
    expectedUse: "external-adapter-only",
    sensitive: true,
    embeddable: false,
  },
]);

function blockedReason(source, error = null) {
  if (error) return `source unavailable or network blocked: ${error.message}`;
  if (source.sensitive) return "available for adapter review only; not embedded because source may contain sensitive or real-person data";
  if (!source.embeddable) return "available for citation/adapter use only; not vendored into the static training app";
  return "available";
}

export async function probeOnlineDatasetSources({
  fetchImpl = globalThis.fetch,
  timeoutMs = 8000,
} = {}) {
  if (typeof fetchImpl !== "function") {
    return ONLINE_DATASET_SOURCES.map((source) => ({
      ...source,
      status: "blocked",
      httpStatus: null,
      reason: "fetch unavailable",
    }));
  }
  const results = [];
  for (const source of ONLINE_DATASET_SOURCES) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(source.url, {
        method: "GET",
        signal: controller.signal,
        headers: { "User-Agent": "NAPP-dataset-audit/1.0" },
      });
      const text = await response.text();
      const reachable = response.ok && text.length > 80;
      results.push({
        ...source,
        status: reachable && source.embeddable ? "usable-online" : reachable ? "blocked-adapter-only" : "blocked",
        httpStatus: response.status,
        bytesSampled: text.length,
        reason: reachable ? blockedReason(source) : `HTTP ${response.status}`,
      });
    } catch (error) {
      results.push({
        ...source,
        status: "blocked",
        httpStatus: null,
        bytesSampled: 0,
        reason: blockedReason(source, error),
      });
    } finally {
      clearTimeout(timer);
    }
  }
  return results;
}
