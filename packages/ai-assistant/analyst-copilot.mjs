import { semanticRows } from "../graph-renderer/graph-model.mjs";
import {
  exportBriefingChart,
  explainExpansion,
  explainPath,
} from "../graph-renderer/chart-workspace.mjs";

const PROHIBITED_PATTERNS = [
  [/who\s+(is|are)\s+(guilty|criminal|the criminal)/i, "unsupported accusation"],
  [/\b(arrest|detain|raid|surveil|freeze assets|enforcement action)\b/i, "operational enforcement prompt"],
  [/\b(race|religion|ethnicity|nationality|protected attribute)\b/i, "protected-attribute inference"],
  [/\bprove\b.*\b(crime|criminal|guilt|guilty)\b/i, "unsupported accusation"],
];

function citation(id) {
  return `[${id}]`;
}

function outputSummary(text) {
  const content = String(text ?? "");
  let hash = 0;
  for (const character of content) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return {
    length: content.length,
    hash: `training-${Math.abs(hash).toString(16)}`,
  };
}

function aiAudit({ prompt, action, policy, retrievedSourceIds = [], output = "", userDecision = "not-saved", saved = false }) {
  return {
    prompt: String(prompt ?? ""),
    action,
    policyDecision: policy?.allowed === false ? "refused" : "allowed",
    policyReason: policy?.reason ?? "source-grounded decision-support request",
    retrievedSourceIds,
    outputSummary: outputSummary(output),
    model: "deterministic-ai-workbench-training@2.0.0",
    configVersion: "ai-step-9-local-v2",
    userDecision,
    saved,
  };
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

export function retrieveGraphEvidence({ prompt, source, settings, workspace = null, report = null, limit = 5 }) {
  const needle = String(prompt ?? "").toLowerCase();
  const rows = rowsFor(source, settings);
  const visibleIds = new Set(rows.map((row) => row.id));
  const rankedRows = rows
    .map((row) => {
      const haystack = `${row.subjectLabel} ${row.objectLabel} ${row.predicate} ${row.source} ${row.reasoning} ${row.caveat} ${row.communityBefore} ${row.communityAfter}`.toLowerCase();
      const lexical = needle.split(/\W+/).filter(Boolean).filter((token) => haystack.includes(token)).length;
      return { ...row, retrievalScore: lexical + rowImportance(row) };
    })
    .sort((a, b) => b.retrievalScore - a.retrievalScore || a.id.localeCompare(b.id))
    .slice(0, limit);
  const pathDependencies = workspace ? explainPath(workspace, source, settings).filter((item) => visibleIds.has(item.id)) : [];
  const expansion = workspace ? explainExpansion(workspace, source, settings) : null;
  const reportDependencies = (report?.dependencies ?? []).filter((dependency) =>
    rankedRows.some((row) => String(dependency).includes(row.id)),
  );
  return {
    contract: "GraphRAGRetrievalV1",
    authorizedProjection: "current visible graph projection only",
    retrievedSourceIds: rankedRows.map((row) => row.id),
    rows: rankedRows.map((row) => ({
      id: row.id,
      source: row.source,
      eventTime: row.eventTime,
      knownAt: row.knownAt,
      confidence: row.confidence,
      caveat: row.caveat,
      label: `${row.subjectLabel} ${row.predicate} ${row.objectLabel}`,
    })),
    pathDependencies,
    expansion,
    reportDependencies,
  };
}

export function answerGraphQuestion({ prompt, source, settings, report }) {
  const policy = classifyPrompt(prompt);
  const retrieval = retrieveGraphEvidence({ prompt, source, settings, report });
  if (!policy.allowed) {
    const reason = `Refused ${policy.reason}. I can summarize cited evidence and uncertainty, but I cannot make accusations or enforcement decisions.`;
    return {
      contract: "GraphRAGAssistantAnswerV1",
      refused: true,
      reason,
      answer: "",
      citations: [],
      uncertainty: ["No factual answer generated because the request violates assistant policy."],
      retrieval,
      audit: aiAudit({ prompt, action: "answer", policy, output: reason }),
    };
  }
  const evidence = retrieval.rows.length ? retrieval.rows : topRows(source, settings);
  const citations = evidence.map((row) => ({
    id: row.id,
    source: row.source,
    eventTime: row.eventTime,
    knownAt: row.knownAt,
  }));
  const focus = evidence[0] ?? {};
  const answer = [
    `${focus?.label ?? "The selected graph"} is important because the visible authorized graph links it to high-signal relationship evidence ${citation(focus?.id ?? "none")}.`,
    `The strongest support is timing, direction, and role/context language from ${evidence.map((row) => citation(row.id)).join(", ")}.`,
    `This report support is a review aid only and does not assert guilt or criminality ${citation(focus?.id ?? "none")}.`,
  ].join(" ");
  return {
    contract: "GraphRAGAssistantAnswerV1",
    refused: false,
    answer,
    citations,
    uncertainty: [
      report?.contraryEvidence ?? "Contrary evidence must be checked before any escalation.",
      report?.limitations ?? "Model and assistant outputs are uncalibrated training behavior.",
    ],
    retrieval,
    audit: aiAudit({
      prompt,
      action: "answer",
      policy,
      retrievedSourceIds: citations.map((item) => item.id),
      output: answer,
    }),
  };
}

export function draftNeutralReport({ source, settings, report }) {
  const evidence = retrieveGraphEvidence({ prompt: "draft neutral report", source, settings, report, limit: 5 }).rows;
  const leadCitation = citation(evidence[0]?.id ?? "none");
  const citedAssessment = String(report.assessment ?? "").replace(". This is", ` ${leadCitation}. This is`);
  const citedUncertainty = String(report.contraryEvidence ?? "").replace(/\.$/, ` ${leadCitation}.`);
  const text = [
    `Draft summary: ${citedAssessment} ${leadCitation}`,
    `Key support: ${evidence.map((row) => `${row.label} ${citation(row.id)}`).join("; ")}.`,
    `Uncertainty: ${citedUncertainty} ${report.limitations} ${leadCitation}`,
    `Next lawful action: ${report.nextAction} ${leadCitation}`,
  ].join("\n");
  return {
    contract: "AIReportDraftV1",
    savedAs: "draft-only",
    text,
    citations: evidence.map((row) => row.id),
    audit: aiAudit({
      prompt: "draft neutral report",
      action: "draft-report",
      policy: { allowed: true, reason: "neutral report drafting" },
      retrievedSourceIds: evidence.map((row) => row.id),
      output: text,
      userDecision: "draft-not-evidence",
    }),
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

export function suggestSafeQuery(prompt, source = null) {
  const policy = classifyPrompt(prompt);
  if (!policy.allowed) {
    return {
      contract: "AIQueryPreviewV1",
      refused: true,
      reason: policy.reason,
      preview: null,
      audit: aiAudit({ prompt, action: "query-preview", policy, output: policy.reason }),
    };
  }
  const text = String(prompt ?? "").toLowerCase();
  const pathMatch = text.match(/path.*between\s+(.+?)\s+and\s+(.+)/);
  const preview = pathMatch
    ? { operation: "graph-phrase", phrase: `paths between ${pathMatch[1]} and ${pathMatch[2]}`, requiresPreview: true }
    : text.includes("financial") || text.includes("boardroom")
      ? { operation: "scene-preset", presetId: "financial-flow", requiresPreview: true }
      : text.includes("account") || text.includes("acct")
        ? { operation: "search-visible-accounts", query: source?.nodes?.find((node) => node.type === "account")?.label ?? "account", requiresPreview: true }
        : { operation: "search-visible-graph", query: String(prompt ?? "").slice(0, 80), requiresPreview: true };
  const output = JSON.stringify(preview);
  return {
    contract: "AIQueryPreviewV1",
    refused: false,
    preview,
    audit: aiAudit({ prompt, action: "query-preview", policy, output }),
  };
}

export function suggestEntityResolutions({ source, settings }) {
  const rows = rowsFor(source, settings);
  const suggestions = [];
  for (let i = 0; i < source.nodes.length; i += 1) {
    for (let j = i + 1; j < source.nodes.length; j += 1) {
      const left = source.nodes[i];
      const right = source.nodes[j];
      const leftTokens = new Set(String(left.label).toLowerCase().split(/\W+/).filter(Boolean));
      const rightTokens = new Set(String(right.label).toLowerCase().split(/\W+/).filter(Boolean));
      const shared = [...leftTokens].filter((token) => rightTokens.has(token));
      const sharedEdges = rows.filter((row) =>
        [row.subject, row.object].includes(left.id) && [row.subject, row.object].includes(right.id),
      );
      if (left.type === right.type && (shared.length || sharedEdges.length)) {
        suggestions.push({
          id: `entity-resolution-${suggestions.length + 1}`,
          candidateIds: [left.id, right.id],
          label: `${left.label} / ${right.label}`,
          reasons: [
            shared.length ? `Shared label token(s): ${shared.join(", ")}` : "",
            sharedEdges.length ? "Connected by visible relationship context" : "",
          ].filter(Boolean),
          contraryEvidence: [
            left.id !== right.id ? "Distinct local identifiers remain separate." : "",
            "Suggestion is not identity truth and requires analyst confirmation.",
          ].filter(Boolean),
          requiredDecision: "analyst-confirmation-before-any-merge",
        });
      }
    }
  }
  return { contract: "EntityResolutionSuggestionsV1", suggestions: suggestions.slice(0, 5) };
}

export function findEvidenceGaps({ source, settings, report, workspace = null }) {
  const rows = rowsFor(source, settings);
  const briefing = workspace ? exportBriefingChart(workspace, source, settings) : null;
  const gaps = [
    !rows.length && { severity: "high", issue: "No visible evidence rows in authorized projection." },
    rows.some((row) => /uncertain|moderate/i.test(`${row.confidence} ${row.statusLabel ?? ""}`)) && {
      severity: "medium",
      issue: "Some visible relationships are uncertain or moderate confidence.",
    },
    briefing?.unsupportedClaims?.length && {
      severity: "high",
      issue: `${briefing.unsupportedClaims.length} manual chart item(s) cannot support factual claims.`,
    },
    report && !/contrary|limitation|uncertain|synthetic/i.test(`${report.contraryEvidence} ${report.limitations}`) && {
      severity: "medium",
      issue: "Report text may understate uncertainty or contrary evidence.",
    },
    workspace?.taskStates?.some((task) => task.status !== "done") && {
      severity: "medium",
      issue: "Open review tasks remain before export.",
    },
  ].filter(Boolean);
  return {
    contract: "ContradictionGapFinderV1",
    gaps,
    status: gaps.some((gap) => gap.severity === "high") ? "needs-review" : "reviewable",
  };
}

export function coachNextStep({ step, mode = "novice", workspace = null }) {
  const expert = mode === "expert";
  return {
    contract: "AITutorialCoachV1",
    mode: expert ? "expert" : "novice",
    stepId: step?.id ?? "unknown",
    explanation: expert
      ? `Review ${step?.label ?? "the current step"} for projection, dependency, and uncertainty impacts.`
      : `This step helps you decide what the visible evidence can and cannot support: ${step?.explanation ?? "follow the guided task."}`,
    recommendedNextAction: workspace?.taskStates?.some((task) => task.status !== "done")
      ? "Finish or update open review tasks before export."
      : step?.task ?? "Continue to the next guided step.",
    couldGoWrong: "Hidden data, delayed reports, duplicate entities, or overconfident wording can make a graph interpretation wrong.",
  };
}

export function suggestNextReviewAction({ source, settings, workspace = null, modelEvaluation = null }) {
  const rows = rowsFor(source, settings);
  const openTask = workspace?.taskStates?.find((task) => task.status !== "done");
  if (openTask) {
    return {
      contract: "AIActiveLearningSuggestionV1",
      action: "complete-open-task",
      label: openTask.label,
      reason: "Open analyst task can reduce review uncertainty.",
      expectedMetric: "task-completion-rate",
    };
  }
  const uncertain = rows.find((row) => /moderate|low|uncertain/i.test(`${row.confidence} ${row.reasoning} ${row.caveat}`));
  if (uncertain) {
    return {
      contract: "AIActiveLearningSuggestionV1",
      action: "review-uncertain-evidence",
      label: `${uncertain.subjectLabel} ${uncertain.predicate} ${uncertain.objectLabel}`,
      reason: "Reviewing uncertain evidence may improve calibration and explanation coverage.",
      expectedMetric: "explanation-coverage",
      dependencyId: uncertain.id,
    };
  }
  const blocked = modelEvaluation?.candidates?.find((candidate) => candidate.failures?.some((failure) => /hard-negative|overreliance|calibration/i.test(failure)));
  return {
    contract: "AIActiveLearningSuggestionV1",
    action: "label-hard-negative",
    label: blocked?.label ?? "Review hard-negative example",
    reason: "The next useful label should test whether the model confuses legitimate high-degree or shared-infrastructure behavior with suspicious patterns.",
    expectedMetric: "hard-negative false-positive rate",
  };
}

export function prepareAssistantNote(draft, citationIds = []) {
  const text = draft?.text ?? draft?.answer ?? "";
  const review = redTeamReview(text, citationIds);
  const note = `AI draft; not evidence. ${text}`;
  return {
    contract: "AISaveAsNotePreviewV1",
    allowed: review.passed,
    note,
    review,
    audit: aiAudit({
      prompt: draft?.audit?.prompt ?? "save AI draft as note",
      action: "save-as-note",
      policy: { allowed: review.passed, reason: review.passed ? "red-team passed" : "red-team failed" },
      retrievedSourceIds: citationIds,
      output: note,
      userDecision: review.passed ? "saved-as-analyst-note" : "blocked-save",
      saved: review.passed,
    }),
  };
}
