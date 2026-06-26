import {
  explainPath,
  expandNeighbors,
  searchGraph,
  setPath,
} from "./chart-workspace.mjs";

const ENTITY_ALIASES = new Map([
  ["accounts", "account"],
  ["account", "account"],
  ["people", "person"],
  ["persons", "person"],
  ["person", "person"],
  ["devices", "device"],
  ["device", "device"],
  ["places", "place"],
  ["place", "place"],
  ["organizations", "organization"],
  ["organization", "organization"],
]);

export const SCENE_PRESETS = Object.freeze([
  {
    id: "financial-flow",
    label: "Financial flow",
    allowedUseCases: ["fraud", "imported-fraud"],
    settings: { relationFilter: "transfers", visualStyle: "boardroom", labelDensity: "comfortable" },
    ruleStyle: "evidence-class",
    explanation: "Focuses on financial transfers and uses restrained institution-friendly styling.",
  },
  {
    id: "infrastructure-review",
    label: "Infrastructure review",
    allowedUseCases: ["fraud", "imported-fraud"],
    settings: { relationFilter: "all", visualStyle: "boardroom", labelDensity: "dense", includeInfrastructure: true },
    ruleStyle: "entity-type",
    explanation: "Keeps device, IP, and account context visible for shared-infrastructure review.",
  },
  {
    id: "community-uncertainty",
    label: "Community uncertainty",
    allowedUseCases: ["harbor", "fraud", "imported-fraud"],
    settings: { relationFilter: "all", visualStyle: "classic", labelDensity: "comfortable", showCommunities: true },
    ruleStyle: "community-uncertainty",
    explanation: "Highlights community membership and uncertain or derived relationships.",
  },
  {
    id: "time-window-review",
    label: "Time window review",
    allowedUseCases: ["harbor", "fraud", "imported-fraud"],
    settings: { relationFilter: "all", visualStyle: "boardroom", labelDensity: "minimal" },
    ruleStyle: "time-window",
    explanation: "Uses a compact scene to inspect event order and known-at cutoffs.",
  },
]);

function normalized(value) {
  return String(value ?? "").trim().toLowerCase();
}

function cleanLabel(value) {
  return String(value ?? "").trim().replace(/[?.!,;:]+$/g, "");
}

function findNodeByPhrase(source, phrase) {
  const needle = normalized(phrase);
  return source.nodes.find((node) =>
    normalized(node.id) === needle ||
    normalized(node.label) === needle ||
    normalized(node.label).replaceAll(/\s+/g, "") === needle.replaceAll(/\s+/g, ""),
  ) ?? null;
}

export function parseGraphPhrase(phrase, source) {
  const text = cleanLabel(phrase);
  const lower = normalized(text);
  if (!lower) {
    return { supported: false, reason: "Enter a graph exploration phrase first." };
  }

  const pathMatch = lower.match(/^(?:show\s+)?paths?\s+between\s+(.+?)\s+and\s+(.+)$/i);
  if (pathMatch) {
    const start = findNodeByPhrase(source, pathMatch[1]);
    const end = findNodeByPhrase(source, pathMatch[2]);
    if (!start || !end) {
      return {
        supported: false,
        reason: "Both path endpoints must be visible nodes in the authorized graph.",
      };
    }
    return {
      supported: true,
      operation: "path-between",
      startId: start.id,
      endId: end.id,
      label: `Path between ${start.label} and ${end.label}`,
    };
  }

  const connectedMatch = lower.match(/^show\s+(\w+)\s+connected\s+to\s+(.+)$/i);
  if (connectedMatch) {
    const type = ENTITY_ALIASES.get(connectedMatch[1]);
    const target = findNodeByPhrase(source, connectedMatch[2]);
    if (!type || !target) {
      return {
        supported: false,
        reason: "Connected-node phrases need a supported entity type and visible target node.",
      };
    }
    return {
      supported: true,
      operation: "connected-by-type",
      nodeType: type,
      targetId: target.id,
      label: `${type} nodes connected to ${target.label}`,
    };
  }

  const communityMatch = lower.match(/^show\s+community\s+(.+)$/i);
  if (communityMatch) {
    return {
      supported: true,
      operation: "community",
      community: cleanLabel(communityMatch[1]).toLowerCase(),
      label: `Community ${cleanLabel(communityMatch[1])}`,
    };
  }

  return {
    supported: false,
    reason: "Supported examples: show accounts connected to Acct 777; paths between Acct 100 and Acct 901; show community mule bridge.",
  };
}

export function validateScenePreset(presetId, context = {}) {
  const preset = SCENE_PRESETS.find((item) => item.id === presetId);
  if (!preset) {
    return { valid: false, reason: "Unknown scene preset." };
  }
  const useCase = context.useCase ?? "harbor";
  if (!preset.allowedUseCases.includes(useCase)) {
    return {
      valid: false,
      reason: `${preset.label} is not available for the current authorized workflow.`,
    };
  }
  if (preset.settings.includeInfrastructure && context.canSeeInfrastructure === false) {
    return {
      valid: false,
      reason: "Infrastructure preset is unavailable because infrastructure nodes are not visible in this projection.",
    };
  }
  return { valid: true, preset };
}

export function applyScenePreset(presetId, context = {}) {
  const validation = validateScenePreset(presetId, context);
  if (!validation.valid) return validation;
  return {
    valid: true,
    preset: validation.preset,
    settings: validation.preset.settings,
    ruleStyle: validation.preset.ruleStyle,
    explanation: validation.preset.explanation,
  };
}

export function executeGraphPhrase(workspace, phrase, source, settings) {
  const parsed = parseGraphPhrase(phrase, source);
  if (!parsed.supported) return { ok: false, parsed, workspace, rows: [], explanation: parsed.reason };

  if (parsed.operation === "connected-by-type") {
    const expanded = expandNeighbors(workspace, source, settings, parsed.targetId);
    const connectedIds = new Set();
    const dependencies = [];
    for (const relationship of source.visibleRelationships(settings)) {
      if (relationship.subject === parsed.targetId || relationship.object === parsed.targetId) {
        const otherId = relationship.subject === parsed.targetId ? relationship.object : relationship.subject;
        const node = source.nodeById(otherId);
        if (node?.type === parsed.nodeType) {
          connectedIds.add(otherId);
          dependencies.push({
            id: relationship.id,
            source: relationship.source,
            eventTime: relationship.eventTime,
            knownAt: relationship.knownAt,
            confidence: relationship.confidence,
          });
        }
      }
    }
    return {
      ok: true,
      parsed,
      workspace: {
        ...expanded,
        pinnedNodeIds: [...new Set([...(expanded.pinnedNodeIds ?? []), parsed.targetId, ...connectedIds])],
      },
      rows: [...connectedIds].map((id) => source.nodeById(id)).filter(Boolean),
      dependencies,
      explanation: `${connectedIds.size} visible ${parsed.nodeType} node${connectedIds.size === 1 ? "" : "s"} connected to ${source.nodeById(parsed.targetId)?.label}. Results use only authorized visible relationships.`,
    };
  }

  if (parsed.operation === "path-between") {
    const next = setPath(workspace, source, settings, parsed.startId, parsed.endId);
    const pathDependencies = explainPath(next, source, settings);
    return {
      ok: true,
      parsed,
      workspace: next,
      rows: next.pathNodeIds.map((id) => source.nodeById(id)).filter(Boolean),
      dependencies: pathDependencies,
      explanation: pathDependencies.length
        ? `Found a visible path with ${pathDependencies.length} evidence-linked relationship${pathDependencies.length === 1 ? "" : "s"} using the current known-at cutoff.`
        : "No visible path was found in the authorized graph projection.",
    };
  }

  if (parsed.operation === "community") {
    const matchingRelationships = source.visibleRelationships(settings).filter((relationship) =>
      normalized(`${relationship.communityBefore} ${relationship.communityAfter}`).includes(parsed.community),
    );
    const nodeIds = [...new Set(matchingRelationships.flatMap((relationship) => [relationship.subject, relationship.object]))];
    return {
      ok: true,
      parsed,
      workspace: {
        ...workspace,
        pinnedNodeIds: [...new Set([...(workspace.pinnedNodeIds ?? []), ...nodeIds])],
        pathRelationshipIds: [...new Set([...(workspace.pathRelationshipIds ?? []), ...matchingRelationships.map((relationship) => relationship.id)])],
      },
      rows: nodeIds.map((id) => source.nodeById(id)).filter(Boolean),
      dependencies: matchingRelationships.map((relationship) => ({
        id: relationship.id,
        source: relationship.source,
        eventTime: relationship.eventTime,
        knownAt: relationship.knownAt,
        confidence: relationship.confidence,
      })),
      explanation: `${matchingRelationships.length} visible relationship${matchingRelationships.length === 1 ? "" : "s"} support the ${parsed.community} community view. This is a review hypothesis, not a determination.`,
    };
  }

  return { ok: false, parsed, workspace, rows: [], explanation: "Unsupported graph operation." };
}

export function graphRuleLegend(ruleStyle) {
  const legends = {
    "evidence-class": [
      "Financial transaction edges remain ledger-backed.",
      "Derived result edges are visually secondary and require review.",
    ],
    "entity-type": [
      "Accounts, devices, places, people, and organizations keep distinct node shapes.",
      "Infrastructure context is visible only when authorized.",
    ],
    "community-uncertainty": [
      "Community outlines remain hypotheses.",
      "Uncertain or derived relationships are emphasized for review.",
    ],
    "time-window": [
      "Scene uses event time and known-at cutoffs.",
      "Missing observations are not treated as negative evidence.",
    ],
  };
  return legends[ruleStyle] ?? ["Default graph styling is active."];
}
