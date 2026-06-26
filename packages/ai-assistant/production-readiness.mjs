const INJECTION_PATTERNS = [
  /ignore (all )?(previous|prior|above) instructions/i,
  /reveal|print|exfiltrate.*(system|developer|prompt|secret)/i,
  /hidden (node|edge|relationship|source|neighbor)/i,
  /bypass|jailbreak|override.*policy/i,
  /tool output|developer message|system message/i,
];

const PRIVACY_PATTERNS = [
  /\b(race|religion|ethnicity|nationality|health|disability|sexual orientation)\b/i,
  /\b(ssn|social security|passport|credential|password|api key|secret)\b/i,
  /\b(arrest|detain|raid|freeze assets|surveil)\b/i,
];

function stableHash(value) {
  const text = JSON.stringify(value ?? "");
  let hash = 0;
  for (const character of text) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return `audit-${Math.abs(hash).toString(16)}`;
}

export function detectPromptInjection(text) {
  const content = String(text ?? "");
  const flags = INJECTION_PATTERNS
    .filter((pattern) => pattern.test(content))
    .map((pattern) => pattern.source);
  return {
    contract: "PromptInjectionScanV1",
    passed: flags.length === 0,
    flags,
    action: flags.length ? "quarantine-source" : "allow-source",
  };
}

export function isolateRetrievedSources(sources = []) {
  const scanned = sources.map((source) => ({
    ...source,
    injectionScan: detectPromptInjection(`${source.text ?? ""} ${source.source ?? ""} ${source.caveat ?? ""}`),
  }));
  return {
    contract: "RetrievedSourceIsolationV1",
    allowedSources: scanned.filter((source) => source.injectionScan.passed),
    quarantinedSources: scanned.filter((source) => !source.injectionScan.passed),
  };
}

export function authorizeServerRetrievalRequest(request = {}) {
  const failures = [
    !request.actorId && "actor is required",
    !request.purpose && "purpose is required",
    !request.projectionId && "authorized projection is required",
    !Array.isArray(request.requestedSourceIds) && "requested source ids are required",
    request.requestedSourceIds?.some((id) => !(request.allowedSourceIds ?? []).includes(id)) && "requested source outside authorized projection",
  ].filter(Boolean);
  return {
    contract: "ServerSideRetrievalAuthorizationV1",
    authorized: failures.length === 0,
    failures,
    projectionId: request.projectionId ?? null,
    returnedSourceIds: failures.length ? [] : request.requestedSourceIds,
  };
}

export function createPersistentAiAuditRecord({ previousHash = "genesis", audit = {}, actorId, purpose }) {
  const body = {
    actorId,
    purpose,
    action: audit.action,
    policyDecision: audit.policyDecision,
    retrievedSourceIds: audit.retrievedSourceIds ?? [],
    model: audit.model,
    configVersion: audit.configVersion,
    userDecision: audit.userDecision,
    saved: Boolean(audit.saved),
    promptHash: stableHash(audit.prompt ?? ""),
    outputHash: audit.outputSummary?.hash ?? stableHash(audit.output ?? ""),
  };
  const recordHash = stableHash({ previousHash, body });
  return {
    contract: "PersistentAIAuditRecordV1",
    previousHash,
    recordHash,
    body,
    contentFree: true,
    appendOnly: true,
  };
}

export function privacyReviewAiAction({ prompt = "", output = "", retrievedSources = [] } = {}) {
  const combined = [prompt, output, ...retrievedSources.map((source) => `${source.source ?? ""} ${source.text ?? ""}`)].join("\n");
  const flags = PRIVACY_PATTERNS
    .filter((pattern) => pattern.test(combined))
    .map((pattern) => pattern.source);
  return {
    contract: "AIPrivacyReviewV1",
    passed: flags.length === 0,
    flags,
    decision: flags.length ? "requires-privacy-review" : "privacy-review-clear-for-training",
  };
}

export function validateExternalModelProviderRequest({ providerConfig = {}, retrievalAuthorization = {}, sources = [], prompt = "" } = {}) {
  const isolated = isolateRetrievedSources(sources);
  const privacy = privacyReviewAiAction({ prompt, retrievedSources: isolated.allowedSources });
  const failures = [
    providerConfig.status !== "approved" && "provider is not approved",
    providerConfig.secretsInClient && "provider secrets cannot be exposed to client",
    retrievalAuthorization.authorized !== true && "retrieval authorization failed",
    isolated.quarantinedSources.length > 0 && "retrieved source failed prompt-injection scan",
    !privacy.passed && "privacy review failed",
  ].filter(Boolean);
  return {
    contract: "ExternalModelProviderRequestGateV1",
    allowed: failures.length === 0,
    failures,
    isolated,
    privacy,
    provider: providerConfig.provider ?? "unconfigured",
  };
}

export function evaluateOverrelianceStudyEvidence(sessions = []) {
  const total = sessions.length;
  const safeComprehension = sessions.filter((session) => session.guiltRiskRejected === true).length;
  const provenanceFirst = sessions.filter((session) => session.inspectedProvenanceBeforeAccepting === true).length;
  const abstentionSafe = sessions.filter((session) => session.abstentionNotLowRisk === true).length;
  const unsupportedConclusions = sessions.filter((session) => session.unsupportedConclusion === true).length;
  const automationBiasEvents = sessions.filter((session) => session.followedAiWithoutEvidence === true).length;
  const rates = {
    safeComprehension: total ? safeComprehension / total : 0,
    provenanceFirst: total ? provenanceFirst / total : 0,
    abstentionSafe: total ? abstentionSafe / total : 0,
    unsupportedConclusion: total ? unsupportedConclusions / total : 1,
    automationBias: total ? automationBiasEvents / total : 1,
  };
  const failures = [
    total < 10 && "minimum representative sessions not met",
    rates.safeComprehension < 0.9 && "safe comprehension below threshold",
    rates.provenanceFirst < 0.8 && "provenance inspection below threshold",
    rates.abstentionSafe < 1 && "abstention misinterpreted by at least one participant",
    unsupportedConclusions > 0 && "unsupported conclusion observed",
    automationBiasEvents > 0 && "automation-bias event observed",
  ].filter(Boolean);
  return {
    contract: "AIOverrelianceStudyEvidenceV1",
    participantCount: total,
    rates,
    failures,
    status: failures.length ? "blocked" : "passed",
  };
}
