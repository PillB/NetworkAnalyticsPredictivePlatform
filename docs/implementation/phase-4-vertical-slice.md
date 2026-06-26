# Phase 4 Vertical Slice: Executable Contract

Status: In implementation  
Scope: P0 temporal reconstruction, provenance, community lineage, and guided
Harbor Lantern analysis  
Predictive status: Disabled pending the gates in `MASTER_SPECIFICATION.md`

## 1. Purpose

This slice proves that the core investigative behavior is understandable,
deterministic, and testable before production adapters add operational
complexity. It is not a disposable mock: temporal, lineage, workflow, and
accessibility semantics form compatibility contracts for the later FastAPI,
PostgreSQL, React, and Cytoscape.js implementation.

## 2. Executable boundaries

| Boundary | Input | Output | Non-negotiable behavior |
|---|---|---|---|
| Temporal domain | assertions plus valid-time and recorded-time anchors | reconstructed authorized graph facts | no revision recorded after the knowledge anchor may appear |
| Provenance | visible assertion revision | source, confidence, temporal bounds, correction chain | every displayed relationship remains traceable |
| Lineage engine | independently detected communities for ordered snapshots | stable lineage IDs and lifecycle events | deterministic output; detection and lineage remain separate |
| Guided workflow | Harbor Lantern fixture and analyst choices | temporal comparison and report preview | novice can finish with smart defaults and inspect every consequential choice |
| Visualization | view model plus preset | visual graph/timeline and semantic table | customization cannot alter analytical facts or hide the accessible mirror |

## 3. Harbor Lantern reference scenario

The fixture contains:

- entities with neutral synthetic identifiers and no real-person data;
- relationships that start, end, and remain active over different intervals;
- one source correction recorded after the original assertion;
- two temporal snapshots with a community split or merge;
- one ambiguous relationship with visibly lower confidence;
- enough provenance to reconstruct the report without relying on rendered
  pixels or hidden client state.

The default walkthrough asks: “What changed around Harbor Lantern between the
two selected periods, and which sources support that conclusion?”

## 4. User-flow contract

The executable walkthrough must support this complete path:

1. Understand the decision-support and synthetic-data boundaries.
2. Accept or adjust the preloaded Harbor Lantern case.
3. Choose two valid-time periods and a recorded-time knowledge anchor.
4. Review the plain-language meaning of those dates.
5. Run the comparison using safe defaults.
6. Inspect added, removed, and unchanged relationships.
7. Review community continuation, birth, death, split, or merge explanations.
8. Select a relationship and inspect its provenance and correction history.
9. Change a visualization preset without changing analytical results.
10. Review caveats and generate a reproducible report preview.

Each stage must state:

- what the user is doing;
- why it matters;
- the current default and why it is safe;
- available alternatives and their consequences;
- how to go back without losing prior work.

## 5. Smart-default contract

Defaults are versioned product behavior, not hidden convenience:

- select the complete synthetic dataset;
- use two meaningful preset periods with an explicit knowledge anchor;
- include all relationship types visible to the fixture user;
- show the community-change and provenance panels;
- use a legible stable-layout comparison preset;
- keep low-confidence evidence visible but clearly marked;
- never enable predictive lead prioritization.

The UI must expose the active defaults before execution and preserve any user
changes in the generated report.

## 6. Visualization contract

Customization may change layout, label density, node sizing, color palette,
edge visibility, panel sizing, and timeline scale. It may not:

- mutate the analytical snapshot;
- silently remove uncertainty or provenance warnings;
- overwrite the saved analysis version;
- make color the only carrier of meaning;
- remove the semantic table alternative.

## 7. Test evidence

| Evidence | Command | Required result |
|---|---|---|
| temporal and provenance semantics | `make test-python` | all temporal reconstruction and correction tests pass |
| lineage behavior | `make test-python` | split, merge, birth/death, confidence, and repeatability tests pass |
| frontend workflow logic | `make test-web` | workflow, default, customization, and report-model tests pass |
| real browser journey | `make test-browser` | desktop/mobile flow, keyboard behavior, report export, and browser error checks pass |
| integrated baseline | `make test` | zero failures without downloading dependencies |
| manual novice journey | `make demo` | all ten user-flow stages can be completed by keyboard |

## 8. Promotion conditions

This slice can advance to framework integration when:

- executable tests map to the relevant black-box test IDs;
- no test requires future knowledge to produce a past-state result;
- lineage output is byte-for-byte repeatable for identical input;
- customization preserves the underlying analytical result;
- the report preview records temporal anchors, source references, caveats,
  lineage version, and visualization preset;
- a reviewer can reconstruct the result from saved structured state.

## 9. Deliberately deferred work

- persistent PostgreSQL schema and migrations;
- OIDC and database row-level security integration;
- production job queue and object storage;
- graph-database read models;
- temporal graph neural networks;
- operational risk or lead scores.

These are deferred adapters or gated capabilities, not removed requirements.
