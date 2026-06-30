import {
  CASE as DEFAULT_CASE,
  DEFAULT_SETTINGS,
  STEPS,
} from "./financial-fraud.mjs";

export const TRANSACTION_IMPORT_VERSION = "TransactionImportV1";

export const SAMPLE_TRANSACTION_CSV = `transaction_id,timestamp,origin_id,origin_kind,destination_id,destination_kind,amount,currency,type,description
imp-001,2026-05-01T09:05:00Z,victim-a,person,acct-100,account,980,USD,fraud complaint transfer,Invoice callback
imp-002,2026-05-01T09:20:00Z,victim-b,person,acct-100,account,1000,USD,fraud complaint transfer,Supplier update
imp-003,2026-05-01T10:10:00Z,victim-c,person,acct-101,account,1250,USD,fraud complaint transfer,Urgent settlement
imp-004,2026-05-01T10:44:00Z,acct-100,account,acct-777,account,1950,USD,internal transfer,Consolidation
imp-005,2026-05-01T11:04:00Z,acct-101,account,acct-777,account,1200,USD,internal transfer,Consolidation
imp-006,2026-05-01T12:12:00Z,acct-777,account,acct-901,account,1500,USD,cash-out transfer,ATM pre-load
imp-007,2026-05-01T12:21:00Z,acct-777,account,acct-902,account,1480,USD,cash-out transfer,Wallet cash-out
imp-008,2026-05-02T08:14:00Z,device-7,device,acct-777,account,0,N/A,login event,Shared device context
bad-009,not-a-date,victim-x,person,acct-999,account,12,USD,transfer,Invalid row example`;

export const SAMPLE_TRANSACTION_JSON = JSON.stringify([
  {
    transaction_id: "json-001",
    timestamp: "2026-05-03T09:05:00-05:00",
    origin_id: "victim-j1",
    origin_kind: "person",
    destination_id: "acct-200",
    destination_kind: "account",
    amount: 900,
    currency: "USD",
    type: "fraud complaint transfer",
    description: "Invoice callback",
  },
  {
    transaction_id: "json-002",
    timestamp: "2026-05-03T10:05:00-05:00",
    origin_id: "acct-200",
    origin_kind: "account",
    destination_id: "acct-777",
    destination_kind: "account",
    amount: 900,
    currency: "USD",
    type: "internal transfer",
    description: "Consolidation",
  },
  {
    transaction_id: "json-003",
    timestamp: "2026-05-03T11:15:00-05:00",
    origin_id: "acct-777",
    origin_kind: "account",
    destination_id: "acct-903",
    destination_kind: "account",
    amount: 875,
    currency: "USD",
    type: "cash-out transfer",
    description: "Wallet withdrawal",
  },
  {
    transaction_id: "json-bad-004",
    timestamp: "2026-05-03T12:00:00",
    origin_id: "acct-777",
    origin_kind: "account",
    destination_id: "acct-904",
    destination_kind: "account",
    amount: 25,
    currency: "DOGE",
    type: "transfer",
    description: "Invalid timezone and currency example",
  },
], null, 2);

export const LEGITIMATE_PROCESSOR_BENCHMARK_JSON = JSON.stringify({
  transactions: [
    {
      transaction_id: "legit-001",
      timestamp: "2026-05-04T09:00:00Z",
      origin_id: "employer-a",
      origin_kind: "organization",
      destination_id: "payroll-hub",
      destination_kind: "account",
      amount: 5000,
      currency: "USD",
      type: "payroll batch funding",
      description: "Payroll provider omnibus settlement",
    },
    {
      transaction_id: "legit-002",
      timestamp: "2026-05-04T09:03:00Z",
      origin_id: "payroll-hub",
      origin_kind: "account",
      destination_id: "employee-1",
      destination_kind: "person",
      amount: 2500,
      currency: "USD",
      type: "payroll batch payout",
      description: "Salary disbursement",
    },
    {
      transaction_id: "legit-003",
      timestamp: "2026-05-04T09:04:00Z",
      origin_id: "payroll-hub",
      origin_kind: "account",
      destination_id: "employee-2",
      destination_kind: "person",
      amount: 2500,
      currency: "USD",
      type: "payroll batch payout",
      description: "Salary disbursement",
    },
    {
      transaction_id: "legit-004",
      timestamp: "2026-05-04T10:10:00Z",
      origin_id: "merchant-processor",
      origin_kind: "account",
      destination_id: "customer-a",
      destination_kind: "person",
      amount: 120,
      currency: "USD",
      type: "refund",
      description: "Card refund from legitimate payment processor",
    },
    {
      transaction_id: "legit-005",
      timestamp: "2026-05-04T10:15:00Z",
      origin_id: "device-shared-branch",
      origin_kind: "device",
      destination_id: "payroll-hub",
      destination_kind: "account",
      amount: 0,
      currency: "N/A",
      type: "shared branch login event",
      description: "Shared infrastructure only",
    },
  ],
}, null, 2);

export const EXTENDED_HARD_NEGATIVE_BENCHMARK_JSON = JSON.stringify({
  transactions: [
    {
      transaction_id: "bench-pos-001",
      timestamp: "2026-05-05T09:00:00Z",
      origin_id: "victim-b1",
      origin_kind: "person",
      destination_id: "acct-300",
      destination_kind: "account",
      amount: 1000,
      currency: "USD",
      direction: "outbound",
      type: "fraud complaint transfer",
      description: "Complaint-backed inbound to collection account",
      expected_account_id: "acct-777",
      expected_review_priority: "true",
    },
    {
      transaction_id: "bench-pos-002",
      timestamp: "2026-05-05T09:20:00Z",
      origin_id: "victim-b2",
      origin_kind: "person",
      destination_id: "acct-301",
      destination_kind: "account",
      amount: 950,
      currency: "USD",
      direction: "outbound",
      type: "fraud complaint transfer",
      description: "Complaint-backed inbound to collection account",
      expected_account_id: "acct-777",
      expected_review_priority: "true",
    },
    {
      transaction_id: "bench-pos-003",
      timestamp: "2026-05-05T10:05:00Z",
      origin_id: "acct-300",
      origin_kind: "account",
      destination_id: "acct-777",
      destination_kind: "account",
      amount: 1000,
      currency: "USD",
      direction: "outbound",
      type: "internal transfer",
      description: "Rapid consolidation",
      expected_account_id: "acct-777",
      expected_review_priority: "true",
    },
    {
      transaction_id: "bench-pos-004",
      timestamp: "2026-05-05T10:12:00Z",
      origin_id: "acct-301",
      origin_kind: "account",
      destination_id: "acct-777",
      destination_kind: "account",
      amount: 950,
      currency: "USD",
      direction: "outbound",
      type: "internal transfer",
      description: "Rapid consolidation",
      expected_account_id: "acct-777",
      expected_review_priority: "true",
    },
    {
      transaction_id: "bench-pos-005",
      timestamp: "2026-05-05T10:50:00Z",
      origin_id: "acct-777",
      origin_kind: "account",
      destination_id: "cashout-b1",
      destination_kind: "account",
      amount: 975,
      currency: "USD",
      direction: "outbound",
      type: "cash-out transfer",
      description: "Cash-out fan-out",
      expected_account_id: "acct-777",
      expected_review_priority: "true",
    },
    {
      transaction_id: "bench-neg-001",
      timestamp: "2026-05-05T11:00:00Z",
      origin_id: "employer-b",
      origin_kind: "organization",
      destination_id: "payroll-hub",
      destination_kind: "account",
      amount: 6000,
      currency: "USD",
      direction: "outbound",
      type: "payroll batch funding",
      description: "Legitimate payroll settlement",
      expected_account_id: "payroll-hub",
      expected_review_priority: "false",
    },
    {
      transaction_id: "bench-neg-002",
      timestamp: "2026-05-05T11:02:00Z",
      origin_id: "payroll-hub",
      origin_kind: "account",
      destination_id: "employee-b1",
      destination_kind: "person",
      amount: 3000,
      currency: "USD",
      direction: "outbound",
      type: "payroll batch payout",
      description: "Salary payment",
      expected_account_id: "payroll-hub",
      expected_review_priority: "false",
    },
    {
      transaction_id: "bench-neg-003",
      timestamp: "2026-05-05T11:03:00Z",
      origin_id: "payroll-hub",
      origin_kind: "account",
      destination_id: "employee-b2",
      destination_kind: "person",
      amount: 3000,
      currency: "USD",
      direction: "outbound",
      type: "payroll batch payout",
      description: "Salary payment",
      expected_account_id: "payroll-hub",
      expected_review_priority: "false",
    },
    {
      transaction_id: "bench-neg-004",
      timestamp: "2026-05-05T12:00:00Z",
      origin_id: "merchant-processor",
      origin_kind: "account",
      destination_id: "customer-b1",
      destination_kind: "person",
      amount: 120,
      currency: "USD",
      direction: "outbound",
      type: "refund",
      description: "Legitimate processor refund",
      expected_account_id: "merchant-processor",
      expected_review_priority: "false",
    },
    {
      transaction_id: "bench-neg-005",
      timestamp: "2026-05-05T12:05:00Z",
      origin_id: "shared-branch-device",
      origin_kind: "device",
      destination_id: "payroll-hub",
      destination_kind: "account",
      amount: 0,
      currency: "N/A",
      direction: "context",
      type: "shared branch login event",
      description: "Shared infrastructure without money movement",
      expected_account_id: "payroll-hub",
      expected_review_priority: "false",
    },
  ],
}, null, 2);

const FIELD_ALIASES = {
  id: ["transaction_id", "transactionid", "tx_id", "id", "reference"],
  at: ["timestamp", "datetime", "date_time", "transaction_time", "date", "time", "at"],
  origin: ["origin_id", "origin", "source", "source_id", "from", "from_account", "account_origin", "person_origin_id"],
  originKind: ["origin_kind", "origin_type", "source_type", "from_type"],
  destination: ["destination_id", "destination", "target", "target_id", "to", "to_account", "account_destination", "person_destination_id"],
  destinationKind: ["destination_kind", "destination_type", "target_type", "to_type"],
  amount: ["amount", "value", "transaction_amount"],
  currency: ["currency", "ccy"],
  direction: ["direction", "flow_direction", "debit_credit", "dr_cr"],
  type: ["type", "transaction_type", "description_type", "category"],
  description: ["description", "memo", "narrative", "details", "concept"],
  expectedAccountId: ["expected_account_id", "label_account_id", "ground_truth_account_id"],
  expectedReviewPriority: ["expected_review_priority", "label_review_priority", "ground_truth_review_priority"],
};

const REQUIRED_FIELDS = ["id", "at", "origin", "destination", "amount", "currency", "type"];
const SUPPORTED_CURRENCIES = new Set(["USD", "EUR", "GBP", "PEN", "MXN", "COP", "BRL", "CAD", "N/A"]);
const SUPPORTED_DIRECTIONS = new Set(["", "inbound", "outbound", "credit", "debit", "context", "transfer"]);

function normalizeHeader(value) {
  return String(value ?? "").trim().toLowerCase().replaceAll(/[\s-]+/g, "_");
}

function splitCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseCsv(text) {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
  return { headers, rows };
}

function flattenRecord(record, prefix = "") {
  const output = {};
  for (const [key, value] of Object.entries(record ?? {})) {
    const normalizedKey = normalizeHeader(prefix ? `${prefix}_${key}` : key);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(output, flattenRecord(value, normalizedKey));
    } else {
      output[normalizedKey] = value == null ? "" : String(value);
    }
  }
  return output;
}

export function parseJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text ?? ""));
  } catch (error) {
    return { headers: [], rows: [], parseError: `Invalid JSON: ${error.message}` };
  }
  const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.transactions) ? parsed.transactions : [];
  if (!records.length || !records.every((record) => record && typeof record === "object" && !Array.isArray(record))) {
    return { headers: [], rows: [], parseError: "JSON import expects an array of transaction objects or a transactions array" };
  }
  const rows = records.map((record) => flattenRecord(record));
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))].sort();
  return { headers, rows };
}

export function parseTransactionInput(text, options = {}) {
  const format = options.format === "json" ? "json" : "csv";
  const parsed = format === "json" ? parseJson(text) : parseCsv(text);
  return { ...parsed, format };
}

export function inferColumnMapping(headers) {
  const normalized = headers.map(normalizeHeader);
  const mapping = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    mapping[field] = normalized.find((header) => aliases.includes(header)) ?? "";
  }
  return mapping;
}

export function normalizeColumnMapping(headers, overrides = {}) {
  const normalizedHeaders = new Set(headers.map(normalizeHeader));
  const inferred = inferColumnMapping(headers);
  return Object.fromEntries(Object.entries(FIELD_ALIASES).map(([field]) => {
    const override = normalizeHeader(overrides[field] ?? "");
    return [field, override && normalizedHeaders.has(override) ? override : inferred[field]];
  }));
}

function parseAmount(value) {
  const number = Number(String(value ?? "").replaceAll(",", ""));
  return Number.isFinite(number) ? number : null;
}

function hasExplicitTimezone(value) {
  return /(?:z|[+-]\d{2}:?\d{2})$/i.test(String(value ?? "").trim());
}

function validDate(value) {
  if (!hasExplicitTimezone(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function normalizeKind(value, fallback) {
  const clean = String(value || fallback || "").trim().toLowerCase();
  if (["person", "account", "device", "ip", "place", "organization"].includes(clean)) return clean;
  if (clean.includes("device")) return "device";
  if (clean.includes("ip")) return "place";
  if (clean.includes("person") || clean.startsWith("p-") || clean.startsWith("victim")) return "person";
  return "account";
}

function normalizeDirection(value) {
  const clean = String(value ?? "").trim().toLowerCase();
  if (!clean) return "";
  if (["cr", "credit"].includes(clean)) return "credit";
  if (["dr", "debit"].includes(clean)) return "debit";
  if (["in", "incoming", "inbound"].includes(clean)) return "inbound";
  if (["out", "outgoing", "outbound"].includes(clean)) return "outbound";
  return clean;
}

function parseBoolean(value) {
  const clean = String(value ?? "").trim().toLowerCase();
  if (["true", "yes", "1", "review-priority", "positive"].includes(clean)) return true;
  if (["false", "no", "0", "background", "negative"].includes(clean)) return false;
  return null;
}

function validEntityId(value) {
  const clean = String(value ?? "").trim();
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{1,63}$/.test(clean);
}

export function previewTransactionImport(text, options = {}) {
  const parsed = parseTransactionInput(text, options);
  const { headers, rows } = parsed;
  const mapping = normalizeColumnMapping(headers, options.mapping ?? {});
  const missingFields = REQUIRED_FIELDS.filter((field) => !mapping[field]);
  const acceptedRows = [];
  const rejectedRows = [];

  if (parsed.parseError) {
    return {
      contract: TRANSACTION_IMPORT_VERSION,
      fileName: options.fileName ?? `pasted-transactions.${parsed.format}`,
      format: parsed.format,
      parserVersion: `${parsed.format}-import-0.2`,
      headers,
      mappedColumns: mapping,
      requiredFields: REQUIRED_FIELDS,
      missingFields: REQUIRED_FIELDS,
      acceptedRows,
      rejectedRows: [{ rowNumber: 1, id: "parse-error", reasons: [parsed.parseError], raw: {} }],
      summary: { totalRows: 0, accepted: 0, rejected: 1 },
      provenance: {
        sourceFileName: options.fileName ?? `pasted-transactions.${parsed.format}`,
        sourceLabel: options.sourceLabel ?? "Manual pasted transaction data",
        sourceCaveat: options.sourceCaveat ?? "",
        parserVersion: `${parsed.format}-import-0.2`,
        importedAt: "training-session",
      },
    };
  }

  rows.forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const reasons = [];
    if (missingFields.length) reasons.push(`Missing required mapped fields: ${missingFields.join(", ")}`);
    const at = mapping.at ? validDate(row[mapping.at]) : null;
    if (!at) reasons.push("Invalid timestamp or missing explicit timezone");
    const amount = mapping.amount ? parseAmount(row[mapping.amount]) : null;
    if (amount === null) reasons.push("Invalid amount");
    const currency = mapping.currency ? String(row[mapping.currency] ?? "").trim().toUpperCase() : "";
    if (!currency) reasons.push("Missing currency");
    if (currency && !SUPPORTED_CURRENCIES.has(currency)) reasons.push(`Unsupported currency: ${currency}`);
    const origin = mapping.origin ? String(row[mapping.origin] ?? "").trim() : "";
    const destination = mapping.destination ? String(row[mapping.destination] ?? "").trim() : "";
    if (!origin) reasons.push("Missing origin");
    if (!destination) reasons.push("Missing destination");
    if (origin && !validEntityId(origin)) reasons.push("Invalid origin identity");
    if (destination && !validEntityId(destination)) reasons.push("Invalid destination identity");
    if (origin && destination && origin === destination && amount !== 0) reasons.push("Origin and destination are identical for money movement");
    const direction = normalizeDirection(mapping.direction ? row[mapping.direction] : "");
    if (!SUPPORTED_DIRECTIONS.has(direction)) reasons.push(`Unsupported direction: ${direction}`);
    if (amount === 0 && currency !== "N/A") reasons.push("Zero-amount context rows must use N/A currency");
    if (amount !== null && amount < 0) reasons.push("Amount cannot be negative");
    const type = mapping.type ? String(row[mapping.type] ?? "").trim() : "";
    if (!type) reasons.push("Missing transaction type");

    const id = mapping.id ? String(row[mapping.id] ?? "").trim() : `row-${rowNumber}`;
    if (!id) reasons.push("Missing transaction id");
    if (id && !validEntityId(id)) reasons.push("Invalid transaction id");
    if (acceptedRows.some((accepted) => accepted.id === id) || rejectedRows.some((rejected) => rejected.id === id)) {
      reasons.push("Duplicate transaction id");
    }
    if (reasons.length) {
      rejectedRows.push({ rowNumber, id, reasons, raw: row });
      return;
    }

    acceptedRows.push({
      id,
      at,
      origin,
      originKind: normalizeKind(mapping.originKind ? row[mapping.originKind] : "", origin),
      destination,
      destinationKind: normalizeKind(mapping.destinationKind ? row[mapping.destinationKind] : "", destination),
      amount,
      currency,
      direction,
      timezone: String(row[mapping.at]).match(/(?:z|[+-]\d{2}:?\d{2})$/i)?.[0]?.toUpperCase() ?? "",
      type,
      description: mapping.description ? String(row[mapping.description] ?? "").trim() : "",
      expectedAccountId: mapping.expectedAccountId ? String(row[mapping.expectedAccountId] ?? "").trim() : "",
      expectedReviewPriority: mapping.expectedReviewPriority ? parseBoolean(row[mapping.expectedReviewPriority]) : null,
      rowNumber,
    });
  });

  return {
    contract: TRANSACTION_IMPORT_VERSION,
    fileName: options.fileName ?? `pasted-transactions.${parsed.format}`,
    format: parsed.format,
    parserVersion: `${parsed.format}-import-0.2`,
    headers,
    mappedColumns: mapping,
    requiredFields: REQUIRED_FIELDS,
    missingFields,
    acceptedRows,
    rejectedRows,
    summary: {
      totalRows: rows.length,
      accepted: acceptedRows.length,
      rejected: rejectedRows.length,
    },
    provenance: {
      sourceFileName: options.fileName ?? `pasted-transactions.${parsed.format}`,
      sourceLabel: options.sourceLabel ?? "Manual pasted transaction data",
      sourceCaveat: options.sourceCaveat ?? "",
      parserVersion: `${parsed.format}-import-0.2`,
      importedAt: "training-session",
      mappingMode: options.mapping ? "explicit-with-inference-fallback" : "inferred",
    },
  };
}

function nodeFor(id, kind, index) {
  const lane = kind === "person" ? 16 : kind === "account" ? 48 : kind === "device" || kind === "place" ? 76 : 30;
  return {
    id,
    type: kind === "ip" ? "place" : kind,
    label: kind === "account" ? `Acct ${id.replace(/^acct[-_]?/i, "")}` : id,
    x: 12 + ((index * 17) % 76),
    y: lane + ((index * 11) % 18),
    role: kind === "account" ? "imported account" : "imported entity",
  };
}

function importedRelationships(preview, knownAt) {
  if (!preview.acceptedRows.length) return [];
  const eventTimes = preview.acceptedRows.map((row) => new Date(row.at).getTime()).sort((a, b) => a - b);
  const midpoint = eventTimes[Math.floor(eventTimes.length / 2)] ?? eventTimes[0];
  return preview.acceptedRows.map((transaction) => {
    const infrastructure = transaction.amount === 0 || /login|device|ip|infrastructure/i.test(transaction.type);
    const period = new Date(transaction.at).getTime() <= midpoint ? "before" : "after";
    return {
      id: transaction.id,
      subject: transaction.origin,
      object: transaction.destination,
      predicate: infrastructure ? "accesses" : "transfers to",
      relation: infrastructure ? "infrastructure" : /cash|withdraw|atm|wallet/i.test(transaction.type) ? "cashout" : "transfers",
      periods: [period],
      status: period === "after" ? "appeared" : "observed",
      eventTime: transaction.at.replace("T", " ").replace("Z", " UTC"),
      knownAt: knownAt.replace("T", " ").replace("Z", " UTC"),
      evidenceClass: "imported financial transaction",
      confidence: "imported",
      reliability: "uploaded ledger",
      credibility: "requires validation",
      source: `${transaction.id} · row ${transaction.rowNumber} · ${transaction.type} · ${transaction.amount} ${transaction.currency}`,
      reasoning: `${transaction.amount} ${transaction.currency} moved from ${transaction.origin} to ${transaction.destination} at ${transaction.at}. Imported row ${transaction.rowNumber} is treated as training evidence.`,
      caveat: "Imported rows are synthetic/training data in GitHub Pages mode. Operational use requires authorized ingestion, validation, and governance.",
      communityBefore: "imported collection",
      communityAfter: transaction.origin === transaction.destination ? "self-loop" : "imported flow",
    };
  });
}

function outboundFor(transactions, accountId) {
  return transactions.filter((tx) => tx.origin === accountId && tx.amount > 0);
}

function inboundFor(transactions, accountId) {
  return transactions.filter((tx) => tx.destination === accountId && tx.amount > 0);
}

function hoursBetween(a, b) {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 36e5;
}

function hardNegativeReasons(transactions, accountId) {
  const related = transactions.filter((tx) => tx.origin === accountId || tx.destination === accountId);
  const text = related.map((tx) => `${tx.type} ${tx.description} ${tx.origin} ${tx.destination}`).join(" ").toLowerCase();
  return [
    /payroll|salary|wage/.test(text) && "payroll or salary hub pattern",
    /payment processor|processor|merchant|omnibus/.test(text) && "legitimate payment processor indicator",
    /refund|chargeback|reversal/.test(text) && "refund or reversal pattern",
    /batch|bulk|settlement/.test(text) && "batch transfer context",
    related.length > 0 && related.every((tx) => tx.amount === 0 || /login|device|ip|shared infrastructure|branch/.test(`${tx.type} ${tx.description}`.toLowerCase())) && "shared infrastructure without money movement",
  ].filter(Boolean);
}

function labeledAccounts(preview) {
  const labels = new Map();
  for (const row of preview.acceptedRows ?? []) {
    if (!row.expectedAccountId || row.expectedReviewPriority === null) continue;
    if (!labels.has(row.expectedAccountId)) labels.set(row.expectedAccountId, row.expectedReviewPriority);
    labels.set(row.expectedAccountId, labels.get(row.expectedAccountId) || row.expectedReviewPriority);
  }
  return labels;
}

export function evaluateImportedFraudBenchmark(preview, settings = DEFAULT_SETTINGS) {
  const labels = labeledAccounts(preview);
  const workflow = createImportedFraudWorkflow(preview);
  const detection = workflow.detectFraudRings({ ...settings, includeBenchmarkEvaluation: false });
  const reviewBudget = Math.max(1, Math.min(3, labels.size || 1));
  const reviewed = detection.scores.slice(0, reviewBudget);
  const positives = new Set([...labels.entries()].filter(([, value]) => value).map(([accountId]) => accountId));
  const negatives = new Set([...labels.entries()].filter(([, value]) => !value).map(([accountId]) => accountId));
  const truePositiveAccounts = reviewed.filter((score) => positives.has(score.accountId)).map((score) => score.accountId);
  const falsePositiveAccounts = reviewed.filter((score) => negatives.has(score.accountId)).map((score) => score.accountId);
  const flaggedHardNegatives = detection.scores
    .filter((score) => negatives.has(score.accountId) && score.status === "review-priority")
    .map((score) => score.accountId);
  const labeledCount = labels.size;
  const abstentionRate = labeledCount ? detection.scores.filter((score) => score.indicators.length === 0 && score.contraryEvidence.length > 0).length / labeledCount : 0;
  return {
    contract: "ImportedFraudBenchmarkEvaluationV1",
    calibrated: false,
    reviewBudget,
    labeledAccounts: labeledCount,
    positiveAccounts: positives.size,
    negativeAccounts: negatives.size,
    precisionAtReviewBudget: reviewed.length ? truePositiveAccounts.length / reviewed.length : 0,
    falsePositiveAccounts,
    flaggedHardNegatives,
    abstentionRate,
    explanationCoverage: detection.scores.length
      ? detection.scores.filter((score) => score.indicators.length || score.contraryEvidence.length).length / detection.scores.length
      : 0,
    overrelianceWarnings: [
      "Synthetic labels do not establish operational calibration.",
      "Review-priority means analyst workload ordering, not criminality.",
      flaggedHardNegatives.length > 0 && "Hard-negative accounts were still flagged and require detector revision.",
      falsePositiveAccounts.length > 0 && "Top-review budget includes labeled negatives; analysts must inspect contrary evidence.",
    ].filter(Boolean),
  };
}

export function createImportedFraudWorkflow(preview) {
  const knownAt = preview.acceptedRows
    .map((row) => row.at)
    .sort()
    .at(-1) ?? DEFAULT_CASE.knownAt;
  const nodeMap = new Map();
  preview.acceptedRows.forEach((row) => {
    if (!nodeMap.has(row.origin)) nodeMap.set(row.origin, nodeFor(row.origin, row.originKind, nodeMap.size));
    if (!nodeMap.has(row.destination)) nodeMap.set(row.destination, nodeFor(row.destination, row.destinationKind, nodeMap.size));
  });
  const nodes = [...nodeMap.values()];
  const relationships = importedRelationships(preview, knownAt);
  const transactions = preview.acceptedRows;
  const caseModel = {
    ...DEFAULT_CASE,
    id: "FR-IMPORT-TRAINING",
    name: "Imported cuentas mulas and fraud-ring detection",
    question: "Which imported accounts deserve review for mule-account or fraud-ring behavior?",
    eventRange: transactions.length ? `${transactions[0].at.slice(0, 10)}/${knownAt.slice(0, 10)}` : DEFAULT_CASE.eventRange,
    knownAt,
  };

  function nodeById(id) {
    return nodes.find((node) => node.id === id);
  }

  function relationshipById(id) {
    return relationships.find((relationship) => relationship.id === id);
  }

  function visibleRelationships(settings = DEFAULT_SETTINGS) {
    const includeInfrastructure = settings.includeInfrastructure ?? settings.aliasIncluded ?? true;
    return relationships.filter((relationship) => {
      if (!includeInfrastructure && relationship.relation === "infrastructure") return false;
      if (settings.relationFilter !== "all" && relationship.relation !== settings.relationFilter) return false;
      return true;
    });
  }

  function detectFraudRings(settings = DEFAULT_SETTINGS) {
    const accounts = nodes.filter((node) => node.type === "account");
    const scores = accounts.map((account) => {
      const inbound = inboundFor(transactions, account.id);
      const outbound = outboundFor(transactions, account.id);
      const uniqueOrigins = new Set(inbound.map((tx) => tx.origin)).size;
      const uniqueDestinations = new Set(outbound.map((tx) => tx.destination)).size;
      const inboundAmount = inbound.reduce((sum, tx) => sum + tx.amount, 0);
      const outboundAmount = outbound.reduce((sum, tx) => sum + tx.amount, 0);
      const passThroughRatio = inboundAmount ? outboundAmount / inboundAmount : 0;
      const fastestPassThroughHours = inbound.length && outbound.length
        ? Math.min(...inbound.flatMap((inTx) => outbound.map((outTx) => hoursBetween(inTx.at, outTx.at))))
        : null;
      const hardNegatives = hardNegativeReasons(transactions, account.id);
      const indicators = [
        hardNegatives.length === 0 && uniqueOrigins >= 2 && "multiple inbound origins",
        hardNegatives.length === 0 && uniqueDestinations >= 2 && "fan-out to multiple destinations",
        hardNegatives.length === 0 && passThroughRatio >= 0.75 && "high pass-through ratio",
        hardNegatives.length === 0 && fastestPassThroughHours !== null && fastestPassThroughHours <= 3 && "rapid outbound movement",
        hardNegatives.length === 0 && inbound.concat(outbound).some((tx) => tx.amount % 100 === 0 || tx.amount % 50 === 0) && "round or near-round amounts",
      ].filter(Boolean);
      const score = Math.min(100, indicators.length * 18);
      return {
        accountId: account.id,
        label: account.label,
        role: account.role,
        score,
        status: score >= Number(settings.priorityThreshold ?? settings.riskThreshold ?? 70) ? "review-priority" : score >= 45 ? "watch" : "background",
        indicators,
        inboundAmount,
        outboundAmount,
        passThroughRatio,
        fastestPassThroughHours,
        contraryEvidence: hardNegatives,
        dependencies: inbound.concat(outbound).map((tx) => tx.id),
      };
    }).sort((a, b) => b.score - a.score || a.accountId.localeCompare(b.accountId));
    const benchmarkEvaluation = settings.includeBenchmarkEvaluation === false ? null : labeledAccounts(preview).size
      ? evaluateImportedFraudBenchmark(preview, settings)
      : null;
    return {
      scores,
      topAccount: scores[0] ?? { label: "No account", score: 0, indicators: ["no accepted rows"], dependencies: [] },
      ringHypothesis: "Imported transaction graph was scanned for convergence, rapid pass-through, and fan-out behavior.",
      benchmarkEvaluation,
      advancedModelRoadmap: [
        "Temporal GNN candidates remain disabled until imported datasets pass leakage-safe evaluation.",
        "Imported transaction features are provenance-bearing and must not become person-level guilt labels.",
      ],
    };
  }

  function deriveAnalysis(settings = DEFAULT_SETTINGS) {
    const detection = detectFraudRings(settings);
    const top = detection.topAccount;
    return {
      splitConfidence: top.score >= 70 ? "review-priority indicators" : "low-moderate review-priority indicators",
      interpretation: `${top.label} is the top imported review-priority account with an uncalibrated rule-count index of ${top.score}/100 because it combines ${top.indicators.join(", ")}.`,
      communities: Math.max(1, new Set(transactions.flatMap((tx) => [tx.origin, tx.destination])).size > 4 ? 3 : 1),
      changedMemberships: relationships.length,
      evidenceCoverage: `${Math.round((preview.summary.accepted / Math.max(1, preview.summary.totalRows)) * 100)}%`,
      alternative: "Rejected rows, legitimate processors, refunds, shared accounts, and delayed posting can change the imported pattern.",
      versionReason: "Imported financial transaction mule-ring detection",
    };
  }

  function reportModel(state) {
    const analysis = deriveAnalysis(state.settings);
    const detection = detectFraudRings(state.settings);
    return {
      title: "Imported cuentas mulas · Transaction-flow review report",
      question: caseModel.question,
      scope: `${preview.fileName} · ${preview.summary.accepted} accepted / ${preview.summary.rejected} rejected rows`,
      before: "Imported collection phase · first half of accepted transaction times",
      after: "Imported fan-out phase · second half of accepted transaction times",
      knownAt: knownAt.replace("T", " ").replace("Z", " UTC"),
      fixture: `${TRANSACTION_IMPORT_VERSION}@${preview.parserVersion}`,
      assessment: `${analysis.interpretation} This is a suggested review step, not a determination that any person committed a crime.`,
      contraryEvidence: analysis.alternative,
      method: "Explainable imported-transaction mule-indicator baseline; TGNN candidates remain gated until validated.",
      limitations: "Training import only; rejected rows and mapping assumptions are disclosed; scores are uncalibrated.",
      nextAction: "Review rejected rows, validate top-account ownership/KYC, corroborate complaints, and test legitimate processor explanations before escalation.",
      dependencies: detection.scores.flatMap((score) => score.dependencies),
    };
  }

  function runPreflight(state) {
    const report = reportModel(state);
    const journey = state.journey ?? {};
    const checks = [
      ["Evidence has been inspected", journey.evidenceInspected === true],
      ["Reasoning and uncertainty have been reviewed", journey.reasoningInspected === true],
      ["Alternative explanation has been reviewed", journey.alternativeReviewed === true],
      ["Recommended next review action has been acknowledged", journey.recommendationAcknowledged === true],
      ["Finding is marked ready", state.findingReady === true],
      ["Import mapping is recorded", Object.values(preview.mappedColumns).some(Boolean)],
      ["Accepted and rejected row counts are recorded", preview.summary.totalRows >= preview.summary.accepted],
      ["Known-at cutoff is recorded", Boolean(report.knownAt)],
      ["Neutral review-priority language is used", /suggested review step|review-priority/i.test(report.assessment)],
      ["Contrary explanations are included", /Rejected rows|processor|refund/i.test(report.contraryEvidence)],
      ["Calibration limitations are disclosed", /uncalibrated/i.test(report.limitations)],
      ["Imported transaction dependencies are attached", report.dependencies.length > 0],
    ];
    return { checks, passed: checks.every(([, passed]) => passed) };
  }

  return {
    imported: true,
    preview,
    case: caseModel,
    steps: STEPS,
    nodes,
    relationships,
    transactions,
    defaults: DEFAULT_SETTINGS,
    nodeById,
    relationshipById,
    visibleRelationships,
    deriveAnalysis,
    reportModel,
    runPreflight,
    detectFraudRings,
  };
}
