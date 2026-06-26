# Phase 1A: Market, Workflow, and Governance Baseline

Research date: June 25, 2026  
Status: completed baseline; implementation claims remain unbenchmarked

## Executive finding

The market contains strong components but no publicly documented product that combines:

- investigation-grade graph exploration;
- valid-time, transaction-time, event-time, and assertion-time semantics;
- persistent community identities with birth, continuation, split, merge, disappearance, and resurgence;
- evidence-level provenance and downstream impact tracking;
- reproducible analytical recipes;
- explainable uncertainty and human review; and
- CPU-first execution with optional GPU acceleration.

This is a product opportunity, not yet an architecture decision. Vendor documentation proves advertised availability, not comparative usability, correctness, scale, or operational effectiveness.

## Terminology correction

“IBM i2” is now a legacy label. IBM divested the i2 portfolio in 2022; i2 is currently part of Harris Computer Corporation. The competitive baseline in this document is therefore called **i2**.

## Competitive comparison

| Product or ecosystem | Strongest capability | Temporal depth | Community analysis | Investigation/governance | Material gap |
|---|---|---|---|---|---|
| i2 Analyst's Notebook + i2 Analyze/Analysis Hub | Purpose-built intelligence charting, expansion, timeline, spatial analysis, shared repositories | Events and timelines are mature; public material does not establish evolving-graph computation | SNA advertised, but public algorithm and dynamic-lineage details are insufficient | Strong domain fit, security, logging, alerts, sharing | Fragmented product tiers; no verified dynamic-community lineage |
| Palantir Foundry/Gotham ecosystem | Integrated data, ontology, operational workflows, maps, events, collaboration | Events, intervals, time series, timelines, moving tracks | Extensible, but no verified packaged dynamic-community workflow in reviewed public docs | Strong security and operationalization | Broad, complex, commercially opaque; Foundry evidence must not be assumed to equal every Gotham deployment |
| Linkurious Enterprise | Coherent browser workflow from graph query through alert and case triage | Date-property histogram and filtering | No native dynamic-community workflow identified | Strong case assignment, comments, status, and export | Temporal filtering is not temporal graph analysis |
| Neo4j Database + GDS + Bloom | Persistent graph, queryability, governed multi-user foundation, broad algorithms | Rich temporal values, but temporal investigation must be modeled by the application | Leiden, Louvain, label propagation, WCC, centralities, and more | Strong platform foundation; case/evidence semantics require custom work | Toolkit rather than a complete criminal-intelligence application |
| Gephi | Best direct-manipulation temporal desktop UX in the reviewed open ecosystem | Timestamps, intervals, spells, dynamic attributes and weights, timeline animation | Static modularity and plugins | Accessible visual exploration | No first-class community identity continuity or evidence audit |
| Cytoscape | Plugin ecosystem and automation surfaces | Primarily app-driven and fragmented | Broad clustering app catalog | Sessions and scripting support repeatability | Point-and-click workflow is not fully recorded; domain UX is biomedical |
| Graphistry | Large browser graphs, pivots, timebars, notebooks, optional GPU | Strong visual time filtering; no verified bitemporal or dynamic-community lifecycle | Integrates multiple CPU/GPU analytical stacks | Operational browser UX | Open-source client and full server/platform have different boundaries |
| NetworkX | Transparent reference implementations, tests, rapid prototyping | Custom attributes and orchestration | Broad static algorithm catalog | Excellent computational reproducibility in code | Not an analyst application; default scale is limited |
| igraph | Efficient CPU analytics and broad community algorithms | Custom snapshots/attributes required | Leiden, Louvain, Infomap, Walktrap, label propagation, and others | Reproducible scripted analysis | No analyst workbench, governance, or evidence lifecycle |

## Reusable product patterns

- From i2: incremental expansion, analyst-controlled charts, events, timeline, spatial views, and domain-specific investigation flow.
- From Palantir: integrated ontology, operational actions, map/time coordination, granular security, and collaborative versioning.
- From Linkurious: low-friction browser investigation and alert-to-case disposition.
- From Gephi: direct temporal manipulation, intervals, spells, stable visual exploration, and plugin-friendly analysis.
- From Cytoscape: automation and an extension ecosystem.
- From Graphistry: large-graph web rendering, pivots, templates, and optional GPU pathways.
- From Neo4j: persistent graph transactions, query language, multi-user deployment, and mature static graph algorithms.
- From NetworkX and igraph: transparent reference algorithms, testability, and CPU-capable analytical baselines.

## Analyst roles

The platform must support distinct responsibilities rather than a single generic “analyst”:

- intelligence customer or executive sponsor;
- intelligence-unit manager;
- intelligence and investigative analysts;
- investigator or special agent;
- collection manager;
- reports officer and product reviewer;
- intelligence-records custodian;
- privacy/civil-rights officer and legal counsel;
- security/system administrator;
- prosecutor or court-facing user;
- auditor or oversight committee; and
- controlled external partners.

An analyst informs decisions but does not determine guilt. A graph connection, centrality score, community assignment, anomaly, or model prediction is not proof of criminal conduct.

## End-to-end analyst workflow

1. **Direction and legal scoping** — define the question, customer, jurisdiction, permissible purpose, predicate, urgency, and handling restrictions.
2. **Collection planning** — identify information gaps and lawful sources while preventing redundant or unbounded collection.
3. **Acquisition and intake** — preserve source, authority, acquisition method, timestamps, identifiers, restrictions, and integrity metadata.
4. **Validation and processing** — evaluate legality, reliability, credibility, relevance, currency, and completeness; normalize without destroying ambiguity.
5. **Entity resolution** — distinguish confirmed identities from candidate matches and preserve reversible merge/split decisions.
6. **Analysis** — explore links, paths, flows, event sequences, temporal change, communities, intermediaries, alternatives, contradictions, and information gaps.
7. **Production and review** — separate facts, allegations, assumptions, inferences, and model outputs; evaluate contrary evidence, uncertainty, privacy, and methodology.
8. **Dissemination** — enforce need-to-know and right-to-know, apply redaction and handling rules, and record recipient, reason, authority, date, and released version.
9. **Feedback and iteration** — capture decisions, corrections, new gaps, leads, and collection requirements.
10. **Retention and closure** — revalidate, correct, notify downstream recipients, preserve required evidence, and defensibly purge obsolete or unsupported intelligence.

## Representative user stories

- Show every evidence-supported path between two subjects during an authorized time range.
- Explain why a person or relationship appears and open the original supporting records.
- Distinguish confirmed identity matches from possible aliases.
- Compare network state before, during, and after an event without losing visual orientation.
- Identify community birth, split, merge, disappearance, and resurgence, including matching confidence.
- Find changes in membership, brokerage, communication, transaction, or movement patterns.
- Compare competing hypotheses and display contradictory evidence.
- Generate a briefing that visibly separates evidence, intelligence reporting, analyst judgment, and model output.
- Produce a sanitized partner view without exposing protected sources.
- Correct an erroneous entity merge and identify every derived score, chart, report, and dissemination affected.
- Reconstruct who queried, viewed, changed, exported, approved, or disseminated information.
- Demonstrate that a recommendation was based on authorized evidence rather than protected activity or demographic proxies.

## Provenance model required by the product

Every analytical assertion must support:

`output → algorithm or analyst transformation → graph assertion → source record → original evidence or submitting authority`

Minimum metadata:

- stable source and source-system identifiers;
- submitting organization and responsible official;
- collection authority and acquisition method;
- event, valid, acquisition, ingestion, assertion, and modification times;
- immutable original or reference plus integrity hash where applicable;
- parser, normalization, entity-resolution, and model versions;
- analyst-created versus source-reported status;
- source reliability, information credibility, analytical confidence, sensitivity, and handling controls;
- contradictory, superseding, corrected, and expired assertions;
- review, retention, correction, and purge history;
- products and graph elements derived from each assertion; and
- dissemination recipients, purposes, authorities, and dates.

The data model must distinguish source-reported facts, unverified allegations, analyst assumptions, probabilistic inferences, model scores, confirmed evidentiary findings, and judicially established facts.

## Governance baseline

For deployments subject to 28 CFR Part 23, the system must support reasonable-suspicion submission criteria, restrictions on protected political/religious/social activity, lawful acquisition, need-to-know and right-to-know dissemination, confidence and sensitivity labeling, audit trails, correction, periodic review, and retention not exceeding five years without revalidation.

These requirements are a U.S. baseline, not universal legal advice. Jurisdiction-specific law and policy may be stricter or different.

Required product controls include:

- documented permissible purpose for cases, searches, imports, and exports;
- case-, role-, field-, source-, and purpose-aware authorization;
- reversible entity resolution and explicit uncertain matches;
- append-only or tamper-evident audit records;
- human review of alerts, risk scores, identity matches, and sensitive conclusions;
- retention, legal hold, correction, purge, and downstream notification workflows;
- protected-feature and proxy controls;
- model/version/input/output capture for reproducibility;
- subgroup error and feedback-loop evaluation where predictive methods are used; and
- risk-tiered review so timeliness does not eliminate accountability.

## Novice onboarding

The tutorial must be a guided synthetic case with known ground truth, not a feature carousel. It must teach:

- intelligence versus evidence, allegations, leads, and legal findings;
- source quality, confidence, and uncertainty;
- temporal reasoning and entity-resolution ambiguity;
- link and community analysis without guilt by association;
- alternative hypotheses and contradictory evidence;
- provenance from source to graph to output;
- privacy, access, dissemination, correction, and retention checkpoints;
- interpretation limits for centrality, communities, anomalies, and risk scores; and
- recovery from mistaken merges, filters, annotations, and analytical assumptions.

## Contradictions and tensions

### Sharing versus safeguarding

Cross-jurisdictional sharing can improve situational awareness, while purpose limitation, predicates, source controls, and dissemination accountability constrain access. “Connect all data” is not a valid product principle.

### Timeliness versus review

Slow review can make intelligence obsolete; weak review can allow inaccurate or unlawful reporting. The product should support automated checks and risk-tiered approval, not bypass review.

### More data versus better intelligence

Volume is not a quality metric. Information gain, source quality, decision usefulness, corrections, and false leads are more meaningful.

### Visual prominence versus evidentiary weight

Large nodes, thick edges, central positions, and bright risk colors can imply guilt or certainty. Visual encoding must expose evidence status, time, source quality, confidence, and uncertainty.

### Static algorithm breadth versus criminal-network validity

A large catalog of community algorithms does not establish suitability for sparse, missing, multiplex, adversarial, biased, or deliberately deceptive data.

## Phase 1A retrospective: What could make this wrong?

- Public vendor documentation may omit private modules, professional-services extensions, or licensed capabilities.
- “Temporal analysis” is used inconsistently across vendors and may mean filtering, event display, time series, or genuine evolving-graph computation.
- Scale claims are not controlled benchmarks and often omit density, attributes, layout, labels, hardware, and latency targets.
- The workflow and governance baseline is U.S.-centric; other jurisdictions differ materially.
- Several authoritative workflow guides are old and do not fully represent current classified or agency-specific practice.
- Comparing libraries, desktop tools, and enterprise platforms conflates algorithm availability with analyst-ready product capability.
- No analyst usability study, total-cost comparison, or reproducible performance benchmark has yet been run.
- Static community detection on snapshots can create false continuity because labels are arbitrary and missing data can substantially alter topology.
- An analytical graph is not automatically admissible evidence even when its source chain is preserved.

## Phase 1A conclusion

The defensible differentiator is not “more algorithms” or another static link chart. It is a governed temporal investigation workflow in which analysts can understand how entities, relationships, evidence, and communities changed; reproduce why an output exists; inspect uncertainty and contrary evidence; and safely correct downstream consequences.

Phase 1B must now test which temporal graph and dynamic-community methods can support that workflow, including computational feasibility, stability, uncertainty, and evaluation methodology.

## Primary and authoritative sources

Accessed June 25, 2026 unless otherwise stated.

### Commercial products

- [i2 Analyst's Notebook](https://i2group.com/solutions/i2-analysts-notebook)
- [i2 Analysis Hub](https://i2group.com/solutions/analysis-hub)
- [i2 Analyze 4.4.7 documentation](https://docs.i2group.com/analyze/4.4.7/)
- [i2 ownership and history](https://i2group.com/about-i2)
- [Palantir Ontology](https://www.palantir.com/docs/foundry/ontology/overview/)
- [Palantir Vertex events](https://www.palantir.com/docs/foundry/vertex/events-overview/)
- [Palantir Vertex save and share](https://www.palantir.com/docs/foundry/vertex/save-share/)
- [Linkurious Enterprise user manual](https://doc.linkurious.com/user-manual/latest/)
- [Linkurious timeline](https://doc.linkurious.com/user-manual/latest/timeline/)
- [Linkurious alert investigation](https://doc.linkurious.com/user-manual/latest/alert-investigate/)
- [Neo4j Bloom](https://neo4j.com/docs/bloom-user-guide/current/)
- [Neo4j Bloom GDS integration](https://neo4j.com/docs/bloom-user-guide/current/bloom-tutorial/gds-integration/)

### Open and extensible ecosystems

- [Gephi repository](https://github.com/gephi/gephi)
- [Gephi dynamic data](https://docs.gephi.org/desktop/User_Manual/Import_Dynamic_Data/)
- [Gephi plugin development](https://docs.gephi.org/desktop/Plugins/)
- [Cytoscape manual](https://manual.cytoscape.org/en/stable/)
- [Cytoscape automation](https://manual.cytoscape.org/en/stable/Programmatic_Access_to_Cytoscape_Features_Scripting.html)
- [Cytoscape rendering](https://manual.cytoscape.org/en/stable/Rendering_Engine.html)
- [Cytoscape OpenCL support](https://manual.cytoscape.org/en/stable/Cytoscape_and_OpenCL_GPU.html)
- [Graphistry documentation](https://hub.graphistry.com/docs/)
- [PyGraphistry repository](https://github.com/graphistry/pygraphistry)
- [Neo4j GDS community detection](https://neo4j.com/docs/graph-data-science/current/algorithms/community/)
- [Neo4j temporal values](https://neo4j.com/docs/cypher-manual/current/values-and-types/temporal/)
- [NetworkX community algorithms](https://networkx.org/documentation/stable/reference/algorithms/community.html)
- [NetworkX backends](https://networkx.org/documentation/stable/reference/backends.html)
- [igraph graph analysis](https://python.igraph.org/en/stable/analysis.html)

### Workflow, governance, and evidence

- [28 CFR Part 23](https://www.ecfr.gov/current/title-28/chapter-I/part-23)
- [28 CFR § 23.20 operating principles](https://www.law.cornell.edu/cfr/text/28/23.20)
- [FBI: Social Network Analysis — A Systematic Approach for Investigating](https://leb.fbi.gov/articles/featured-articles/social-network-analysis-a-systematic-approach-for-investigating)
- [FBI intelligence analyst roles](https://fbijobs.gov/intelligence-analysts)
- [ODNI ICD 203: Analytic Standards](https://www.dni.gov/files/documents/ICD/ICD-203.pdf)
- [DOJ COPS: Law Enforcement Intelligence Guide](https://cops.usdoj.gov/pdf/e09042536.pdf)
- [DOJ/DHS Fusion Center Guidelines](https://bja.ojp.gov/sites/g/files/xyckuh186/files/media/document/fusion_center_guidelines.pdf)
- [BJA privacy and civil-liberties guides](https://bja.ojp.gov/program/it/privacy-civil-liberties/guides)
- [NIST IR 8387: Digital Evidence Preservation](https://nvlpubs.nist.gov/nistpubs/ir/2022/NIST.IR.8387.pdf)
- [U.S. Senate fusion-center oversight report](https://www.hsgac.senate.gov/imo/media/doc/10-3-2012%20PSI%20STAFF%20REPORT%20re%20FUSION%20CENTERS.2.pdf)
