# i2 Parity Playwright Audit

Generated: 2026-06-26T18:21:19.068Z

## Scope

This audit compares NetworkAnalyticsPredictivePlatform against public i2 Analyst's Notebook product material using Playwright. It does not assert pixel-perfect cloning or complete proprietary parity; public sources cannot expose all i2 behavior, and copying vendor UI exactly is not the goal. The validation target is feature-class parity plus documented improvements in provenance, redaction discipline, accessibility, temporal analysis, predictive gating, and AI safety.

## Public Reference

- Source: https://i2group.com/solutions/i2-analysts-notebook
- Public reference screenshot: `test-results/i2-parity/i2-public-reference.png`
- i2 page text length captured by Playwright: 7792

Observed public i2 capability claims:

- Manual drag-and-drop data entry: Official page describes intuitive drag-and-drop data input.
- Entities, links, events, timelines, attributes: Official page lists entities, links, events, timelines, and attributes.
- Briefing-ready visual charts: Official page describes easy-to-follow visual briefing charts.
- Redacted chart versions: Official page describes producing redacted versions for differing clearances.
- Core link analysis and intermediaries: Official page describes core link analysis and identifying intermediaries.
- Temporal/event analysis: Official page describes understanding the critical timeline of events or patterns.
- Social-network analysis: Official page describes integrated Social Network Analysis tools.
- Collaborative/shared intelligence workflow: Official page describes collaboration plans with shared workflows and synchronized views.

Observed public image alt labels from the reference page:

- logo
- opens in a new window
- opens in a new window
- opens in a new window
- opens in a new window
- opens in a new window
- opens in a new window
- opens in a new window
- opens in a new window
- opens in a new window
- opens in a new window
- i2

## NAPP Evidence

- Chart authoring screenshot: `test-results/i2-parity/napp-chart-authoring.png`
- Redacted chart screenshot: `test-results/i2-parity/napp-redacted-chart.png`
- Model gates screenshot: `test-results/i2-parity/napp-model-gates.png`
- AI assistant screenshot: `test-results/i2-parity/napp-ai-assistant.png`
- Export packet status: blocked-for-factual-claims
- Export packet redactions: 1
- Export packet manual items: 2
- Unsupported manual claims blocked: 2

## Feature-Class Comparison

| Capability | Public i2 basis | NAPP audit result | NAPP improvement or safety constraint |
| --- | --- | --- | --- |
| Manual chart entities/links/notes | Public i2 claim observed | Pass | Manual items are marked as briefing/presentation metadata, not evidence. |
| Redacted chart view | Public i2 claim observed | Pass | Redaction suppresses chart labels and export coordinates/styles to avoid layout leakage. |
| Briefing export with provenance metadata | NAPP differentiator | Pass | Unsupported manual factual claims are blocked in the briefing packet. |
| Search, expand, path, dependencies | Public i2 claim observed | Pass | Path explanations expose exact source dependencies and caveats. |
| Temporal comparison and cautious workflow | Public i2 claim observed | Pass | Period labels are workflow-specific and avoid reusing unrelated case boundaries. |
| Predictive model gates | NAPP differentiator | Pass | Advanced models remain disabled unless leakage, calibration, robustness, and overreliance gates pass. |
| Source-grounded AI assistance and refusal | NAPP differentiator | Pass | AI output is constrained to citations, neutral drafting, refusal policy, and red-team review. |
| Accessible semantic mirror | NAPP differentiator | Pass | The graph/chart workspace has a semantic table mirror for accessibility and testing. |

## Verdict

The Playwright audit supports feature-class parity for the public i2 charting/analysis capabilities that are visible from vendor material: manual charting, entities/links, briefing charts, redaction, link/path exploration, temporal context, and collaboration-oriented workspace semantics. NAPP adds explicit evidence separation, redaction leakage controls, source dependency display, accessible semantic mirrors, model gating, and source-grounded/refusal-aware AI flows.

## Remaining Risks

- This is not proof of complete i2 replication because i2 is proprietary and the audit only uses public pages/images.
- Screenshot comparison is structural and capability-based, not pixel-perfect, by design.
- NAPP chart state remains browser-session training state until governed persistence, dissemination controls, retention, and print/pagination workflows are implemented.
- Representative analyst testing is still required to prove operational superiority rather than checklist parity.
