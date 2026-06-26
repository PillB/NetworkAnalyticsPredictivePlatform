import { semanticRows } from "../graph-renderer/graph-model.mjs";

const PROHIBITED_PATTERNS = [
  [/who\s+(is|are)\s+(guilty|criminal|the criminal)/i, "unsupported accusation"],
  [/\b(arrest|detain|raid|surveil|freeze assets|enforcement action)\b/i, "operational enforcement prompt"],
  [/\b(race|religion|ethnicity|nationality|protected attribute)\b/i, "protected-attribute inference"],
  [/\bprove\b.*\b(crime|criminal|guilt|guilty)\b/i, "unsupported accusation"],
];

function citation(id) {
  return `[${id}]`;
}

export function classifyPrompt(prompt) {
  const text = String(prompt ?? "");
  const match = PROHIBITED_PATTERNS.find(([pattern]) => pattern.test(text));
  return match
    ? { allowed: false, reason: match[1] }
    : { allowed: true, reason: "source-grounded decision-support request" };
}

function rowsFor(source, settings) {
  return semanticRows(settings, source);
}

function rowImportance(row) {
  const text = `${row.source} ${row.reasoning} ${row.caveat} ${row.communityBefore} ${row.communityAfter}`.toLowerCase();
  return [
    /mule|bridge|consolidation|cash-out|pass-through|split|alias/.test(text) ? 2 : 0,
    /uncertain|caveat|refund|processor|shared|coverage|legitimate/.test(text) ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);
}

function topRows(source, settings, limit = 4) {
  return rowsFor(source, settings)
    .map((row) => ({ ...row, importance: rowImportance(row) }))
    .sort((a, b) => b.importance - a.importance || a.id.localeCompare(b.id))
    .slice(0, limit);
}

export function answerGraphQuestion({ prompt, source, settings, report }) {
  const policy = classifyPrompt(prompt);
  const audit = {
    prompt: String(prompt ?? ""),
    model: "deterministic-graphrag-training@1.0.0",
    action: "answer",
    userDecision: "not-saved",
  };
  if (!policy.allowed) {
    return {
      contract: "GraphRAGAssistantAnswerV1",
      refused: true,
      reason: `Refused ${policy.reason}. I can summarize cited evidence and uncertainty, but I cannot make accusations or enforcement decisions.`,
      answer: "",
      citations: [],
      uncertainty: ["No factual answer generated because the request violates assistant policy."],
      audit,
    };
  }
  const evidence = topRows(source, settings);
  const citations = evidence.map((row) => ({
    id: row.id,
    source: row.source,
    eventTime: row.eventTime,
    knownAt: row.knownAt,
  }));
  const focus = evidence[0];
  return {
    contract: "GraphRAGAssistantAnswerV1",
    refused: false,
    answer: [
      `${focus?.subjectLabel ?? "The selected graph"} is important because the visible authorized graph links it to high-signal relationship evidence ${citation(focus?.id ?? "none")}.`,
      `The strongest support is timing, direction, and role/context language from ${evidence.map((row) => citation(row.id)).join(", ")}.`,
      `This is a review aid only; the report remains a neutral draft and does not assert guilt or criminality.`,
    ].join(" "),
    citations,
    uncertainty: [
      report?.contraryEvidence ?? "Contrary evidence must be checked before any escalation.",
      report?.limitations ?? "Model and assistant outputs are uncalibrated training behavior.",
    ],
    audit: { ...audit, retrievedSourceIds: citations.map((item) => item.id) },
  };
}

export function draftNeutralReport({ source, settings, report }) {
  const evidence = topRows(source, settings, 5);
  const leadCitation = citation(evidence[0]?.id ?? "none");
  const citedAssessment = String(report.assessment ?? "").replace(". This is", ` ${leadCitation}. This is`);
  const citedUncertainty = String(report.contraryEvidence ?? "").replace(/\.$/, ` ${leadCitation}.`);
  return {
    contract: "AIReportDraftV1",
    savedAs: "draft-only",
    text: [
      `Draft summary: ${citedAssessment} ${leadCitation}`,
      `Key support: ${evidence.map((row) => `${row.subjectLabel} ${row.predicate} ${row.objectLabel} ${citation(row.id)}`).join("; ")}.`,
      `Uncertainty: ${citedUncertainty} ${report.limitations} ${leadCitation}`,
      `Next lawful action: ${report.nextAction} ${leadCitation}`,
    ].join("\n"),
    citations: evidence.map((row) => row.id),
    audit: {
      prompt: "draft neutral report",
      model: "deterministic-report-copilot-training@1.0.0",
      retrievedSourceIds: evidence.map((row) => row.id),
      userDecision: "draft-not-evidence",
    },
  };
}

export function checkCitedFactualClaims(text, citationIds) {
  const sentences = String(text ?? "")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const factual = sentences.filter((sentence) => /\b(account|acct|graph|evidence|transaction|relationship|report|source|support|because)\b/i.test(sentence));
  const missing = factual.filter((sentence) => !citationIds.some((id) => sentence.includes(citation(id))));
  return {
    contract: "CitationCheckV1",
    passed: missing.length === 0,
    missing,
  };
}

export function redTeamReview(text, citationIds = []) {
  const content = String(text ?? "");
  const flags = [
    /\bguilty|criminal|crime ring|money launderer|culprit\b/i.test(content) && "Overclaims criminality or guilt.",
    /\bdefinitely|proves|certainly|without doubt\b/i.test(content) && "Uses certainty language beyond the evidence.",
    !citationIds.length && "No citations attached to the generated text.",
    !/uncertain|limitation|contrary|review/i.test(content) && "Does not foreground uncertainty or review-only status.",
  ].filter(Boolean);
  const citationCheck = checkCitedFactualClaims(content, citationIds);
  if (!citationCheck.passed) flags.push("One or more factual sentences lack exact citations.");
  return {
    contract: "AIRedTeamReviewV1",
    passed: flags.length === 0,
    flags,
    citationCheck,
  };
}

export function suggestSafeQuery(prompt) {
  const policy = classifyPrompt(prompt);
  if (!policy.allowed) {
    return { contract: "AIQueryPreviewV1", refused: true, reason: policy.reason, preview: null };
  }
  const text = String(prompt ?? "").toLowerCase();
  const preview = text.includes("path")
    ? { operation: "find-visible-path", requiresPreview: true }
    : text.includes("account") || text.includes("acct")
      ? { operation: "filter-visible-accounts", requiresPreview: true }
      : { operation: "search-visible-graph", requiresPreview: true };
  return {
    contract: "AIQueryPreviewV1",
    refused: false,
    preview,
  };
}
