# Phase B Competitor and User-Value Validation

Date: June 25, 2026  
Status: active validation baseline for Phase B/C prioritization

## Method

This is a STORM-style validation pass from three perspectives:

1. **Competitor capability lens** — what leading tools expose in current public documentation.
2. **User-value lens** — what users and vendor/customer material repeatedly praise or optimize around.
3. **Reviewer lens** — what this product must copy, improve, or avoid to become i2-class but better with governed AI.

Public vendor material does not prove private enterprise capabilities, actual usability, operational effectiveness, pricing, or customer satisfaction. It is enough to guide backlog priority, not enough to claim superiority.

## Source-backed competitor signals

| Product/source | Observed capability signals | Product implication |
|---|---|---|
| i2 Analyst's Notebook | i2 positions Analyst's Notebook as visual analysis for fraud/crime and describes entities, links, events, timelines, attributes, temporal tools, social-network analysis, intermediaries, communications/transactional highlighting, charts, redacted sharing, collaboration/subscription tiers, data connections, and add-ons. Source: https://i2group.com/solutions/i2-analysts-notebook | Baseline parity requires polished charting, import/connectors, temporal analysis, SNA/intermediary analysis, redaction/export, and collaboration. |
| i2 Analysis Studio | i2 describes Analyst's Notebook as the core and adds deployment customization plus near-real-time access to information and patterns/trends/connections. Source: https://i2group.com/solutions/analysis-studio | Enterprise fit requires deployment customization, connectors, and live/on-demand retrieval; our production path must not remain static-fixture-only. |
| Linkurious Enterprise | Documentation emphasizes spaces, folders, shared visualizations, CSV import templates with preview/mapping/validation/failed-row reporting, quick actions, search, node/edge inspection, table inspection, no-code query builder, visual duplication, timeline filtering, undo/redo, comments, geography, and case investigation. Sources: https://doc.linkurious.com/user-manual/latest/page.html, https://doc.linkurious.com/user-manual/latest/timeline/, https://doc.linkurious.com/user-manual/latest/undo/, https://doc.linkurious.com/user-manual/latest/alert-investigate/ | Users value fast no-code exploration, recoverable manipulation, import quality checks, collaboration, case status, comments, export, and timeline/geography. We should not over-prioritize AI before these basics are solid. |
| Maltego | Maltego presents an all-in-one OSINT/cyber investigation platform with Graph/Search/Monitor/Evidence/Data/Cases/Admin, data partners, quick suspect searches, graphing, monitoring with AI sentiment analysis, evidence capture, case storage, audit/admin, and training. Source: https://www.maltego.com/ | Strong user-value signals: broad data access, transforms/search, graphing, evidence capture, cases, audit/admin, training, and AI as workflow accelerator, not replacement for evidence. |
| Gephi / open graph ecosystem | Prior research identified direct manipulation, dynamic visualization, layouts, filtering, and plugin-friendly analysis as major strengths. Source already captured in Phase 1A. | Visual responsiveness, layout control, and exploration fluidity remain table stakes for analyst trust. |

## What users appear to love

Observed from vendor docs, testimonials, training/community emphasis, and workflow design:

1. **Fast start from messy data** — CSV import templates, preview, mapping, validation, failed-row feedback, and data-provider access.
2. **Search-first investigation** — type a name/account/domain/alias and immediately place relevant entities on a graph.
3. **Incremental expansion** — double-click/right-click expansion and visible undisplayed-neighbor cues.
4. **Recoverable manipulation** — undo/redo, duplicate visualizations, saved layouts, and reset/restore behavior.
5. **No-code querying** — query builders that let non-technical analysts search for patterns without writing Cypher/SQL.
6. **Readable briefings** — clear charts, redacted exports, reports, and shareable visualizations.
7. **Case collaboration** — status, assignee, comments, mentions, shared spaces, and audit/admin controls.
8. **Timeline/geography** — time filtering, histograms, date bounds, maps, and movement/context views.
9. **Training and hand-holding** — academies, guided quick actions, examples, and community support.
10. **Broad data access** — connectors, transforms, marketplaces, internal/external sources, and import pipelines.

## Current product validation

| User-loved capability | Current status | Evidence | Priority |
|---|---|---|---|
| Guided hand-held investigation | Strong synthetic MVP | Harbor Lantern and fraud-ring tutorials with report preflight | Keep refining |
| Search and pin | Partial implemented | Phase B chart workspace search/pin | Expand with data-model discovery and better result ranking |
| Incremental expansion | Partial implemented | Bounded expansion from selected relationship | Add expand-by-type/depth and undisplayed-neighbor counts |
| Undo/redo | Partial implemented | Graph layout undo/redo plus workspace undo/redo | Add full chart reducer and keyboard shortcuts |
| Path exploration | Partial implemented | Visible shortest path with exact dependencies | Add weighted/evidence-aware temporal paths |
| Timeline | Backend strong, UI partial | before/after comparison and event-time semantics | Add histogram/scrubber and invalid/missing time counts |
| CSV import | Not implemented in UI | canonical fixture importer only | Highest next build priority, especially for fraud transactions |
| No-code query builder | Not implemented | N/A | Add after CSV/import and data model discovery |
| Case collaboration | Backend contracts partial, UI absent | purpose/grant/audit contracts | Add case/task/status/comments after import/presets |
| Geography | Designed, not implemented | architecture references MapLibre/static fallback | Add after timeline and transaction import |
| AI assistant | Not implemented as LLM feature | deterministic explanations only | Add after evidence grounding/export semantics are strong |

## Copy, improve, surpass

### Copy deliberately

- CSV import with templates, preview, mapping, validation, and failed-row reporting.
- Search-first graph creation.
- Expand nodes and edges from the workspace.
- Undo/redo and duplicate/saved workspaces.
- Timeline histogram and date-bound filtering.
- Case comments/status/assignee and export.
- Training/help surfaced in the product.

### Improve

- Treat every import row, transform, query, and AI suggestion as provenance-bearing and versioned.
- Separate evidence, analyst annotation, visualization state, and derived analysis more explicitly than conventional chart tools.
- Explain paths and fraud-ring outputs with source dependencies and caveats.
- Make temporal reasoning bitemporal: event time and known-at time.
- Include novice ELI5 guidance directly in real workflows, not only external training.

### Surpass

- Dynamic community lineage with lifecycle events and uncertainty.
- Fraud-ring/cuentas-mulas detection with transparent indicators and TGNN/GNN gates.
- Gated AI assistant that cites local evidence and cannot assert guilt.
- Reconstructable reports that bind exact evidence, analysis version, and limitations.
- Safety-by-design: neutral labels, overreliance tests, and no post-computation hiding of restricted data.

## Priority decision

The next build should be **Phase C transaction CSV/JSON import** before more advanced AI. Reason:

- It is a repeated competitor/user-loved capability.
- It directly unlocks the must-have financial fraud-ring use case.
- It enables meaningful black-box tests and benchmarks beyond hard-coded synthetic modules.
- It creates the substrate for later no-code queries, timeline histogram, case collaboration, and AI assistant grounding.

## Acceptance tests to add next

- CSV import template recognizes transaction date/time, origin, destination, amount, currency, type, and description.
- Import preview reports mapped columns, missing required fields, invalid timestamps, unsupported currency, and rejected rows.
- Imported transactions create a graph projection consumed by fraud-ring detection.
- Import provenance records file name, parser version, row number, normalized fields, and rejected-row reasons.
- Browser test completes: upload sample CSV → preview → import → run fraud workflow → inspect top mule account → export report.

## Retrospective

What could make this wrong:

- Vendor pages overstate capabilities and do not reveal real analyst friction.
- Testimonials skew positive and may not represent day-to-day users.
- Public docs do not expose deployment, cost, permissions, or data-quality pain.
- Building import next may delay map/timeline polish, but without import the fraud workflow remains too synthetic.

Mitigation:

- Treat this as backlog prioritization, not proof.
- Keep black-box tests observable.
- Add human analyst sessions before claiming “users love it.”
- Prefer import + provenance + explainability over ungrounded AI features.
