# ADR 0017: Financial Fraud-Ring and Cuentas Mulas Detection Boundary

Date: June 25, 2026  
Status: accepted

## Context

The application must support financial transaction investigations where analysts need to detect possible mule accounts, collection accounts, cash-out accounts, and coordinated fraud-ring structure from time-stamped transaction data.

The research baseline supports temporal graph learning and dynamic community detection, but also shows that complex neural models can underperform simple recency/frequency/motif baselines when evaluation has leakage, easy negatives, or weak calibration.

## Decision

Implement the MVP financial-fraud workflow with an explainable CPU-first detector and a synthetic training case. Treat temporal GNNs, heterogeneous GNNs, and sequence models as gated derived analytical artifacts.

The detector must operate on authorized projections and rank account/ring review priority using transparent indicators:

- inbound-origin concentration;
- outbound fan-out;
- rapid pass-through timing;
- pass-through ratio;
- shared infrastructure;
- round/near-round amounts;
- temporal burst structure.

The UI must allow analysts to manipulate graph layout directly: drag nodes, rotate/spin the graph, undo/redo visual layout edits, and reset to the recommended baseline. These view operations must not create new analysis versions.

## Consequences

- The training MVP can demonstrate mule/ring detection on GitHub Pages without exposing operational data or unauthenticated services.
- Detection remains explainable and testable before model complexity is introduced.
- Advanced model promotion requires leakage-safe benchmarks, hard negatives, calibration, explanation, and human-factor gates.
- Financial-fraud outputs remain neutral review recommendations and cannot be person-level guilt or criminality determinations.

## Evidence

- `packages/guided-workflow/financial-fraud.mjs`
- `apps/web/app.mjs`
- `packages/graph-renderer/svg-renderer.mjs`
- `tests/frontend/financial-fraud.test.mjs`
- `tests/browser/pages.e2e.mjs`
