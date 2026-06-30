# Top-to-Bottom User Flow Audit

Date: 2026-06-30

## Scope

This audit reviews whether the website supports a natural top-to-bottom flow:
select a use case, understand dataset boundaries, follow guided steps, adjust
graph views, run local analysis, inspect evidence, prepare a report, and use
workspace/assistant tools without losing provenance or safety context.

## Competitive Patterns Reviewed

- IBM i2 Analyst's Notebook: chart-first investigation, timeline-oriented
  analysis, and analyst-driven evidence review.
- Linkurious Enterprise: graph investigation workspace, alerts/cases, search,
  expansion, review status, and collaboration workflow.
- Neo4j Bloom: phrase-driven graph exploration, scenes/perspectives, and visual
  graph views for non-query users.
- Azure Machine Learning Designer/AutoML: guided model-training workflow with
  stepwise configuration, metrics, and deployment gates.

## Product Findings

1. Dataset selection should not interrupt the first guided step.
   - Issue: the expanded adapter catalog was open by default and dominated the
     mobile first screen.
   - Fix: dataset catalog now starts collapsed. The selected dataset summary
     remains available when opened, and adapter-only sources explain why they
     are not embedded.

2. Single view must mean no forced before/after split.
   - Issue: previous single modes were single-before and single-after only.
   - Fix: added true unified/no-split graph rendering that displays all visible
     relationships in one graph.

3. Temporal split should be user-customizable.
   - Issue: split was fixed to before/after or three slices.
   - Fix: added split count, split boundary slider, and auto split based on the
     largest chronological gap in visible evidence.

4. Multi-split views should be visual only unless an analytical filter changes.
   - Fix: semantic table and report dependencies still use the complete
     authorized visible relationship set. Split settings do not create evidence.

5. Dataset breadth should be explicit without pretending all external data is
   included.
   - Fix: expanded the adapter catalog for temporal graph, fraud/AML, graph
     anomaly, contact-network, criminology, and synthetic-generator families.
   - Boundary: sensitive, credentialed, or large datasets remain adapter-only.

## Five-Run Flow Gate

`npm run audit:flows` supports `FLOW_AUDIT_REPEAT=5`. The repeated audit covers:

- Fresh Harbor guided report flow.
- Dataset catalog review and adapter-only selection.
- True unified/no-split graph view.
- Algorithmic auto split and multi-slice timeline view.
- Dojo community benchmark flow.
- Imported fraud transaction workflow.
- Browser-local model/anomaly run.
- Bloom-style graph phrase and workspace actions.
- Mobile critical path.

Passing criteria:

- Zero browser errors.
- Zero blocker issues.
- Zero major visual issues.
- Online dataset probes must not treat adapter-only or blocked sources as
  successful embedded data.
