# Phase 1C: State-of-the-Art Synthesis and Evaluation Gates

Date: June 25, 2026  
Purpose: reconcile market demand, technical feasibility, governance, and contradictory evidence before requirements or architecture selection

## 1. Research verdict

The strongest defensible product thesis is:

> Build a governed temporal investigation system that preserves evidence history, makes community evolution explicit, and treats predictive models as optional, calibrated decision-support modules.

The thesis is narrower than “AI that finds criminals” and broader than “another link chart.” It is supported by three converging findings:

- Existing investigation platforms are strong at charting, search, data integration, cases, or access control, but public documentation does not establish first-class bitemporal evidence semantics and dynamic-community lineage.
- Research methods provide temporal prediction and dynamic clustering components, but no single method supplies an analyst-ready, provenance-preserving, uncertainty-aware workflow.
- Legal, analytical, and operational standards require provenance, correction, access control, review, uncertainty, and separation of facts from inferences.

This thesis remains falsifiable. It fails if controlled evaluation shows that:

- analysts do not complete temporal or community tasks more accurately or quickly;
- lifecycle events are too unstable to support useful interpretation;
- provenance overhead prevents interactive performance;
- simpler existing tools already provide equivalent capability when configured correctly; or
- governance controls cannot be implemented without making the workflow unusable.

## 2. Market gap versus technical feasibility

| Proposed capability | Market evidence | Technical evidence | Feasibility assessment | Phase 2 implication |
|---|---|---|---|---|
| Bitemporal assertion history | Weakly or inconsistently exposed in reviewed products; governance requires historical reconstruction | Conventional temporal-GNN frameworks do not provide it; database/application modeling can | High for deterministic storage/query; independent of ML | Must be a core domain requirement |
| Stable temporal layout and comparisons | Timelines and temporal filters exist, but evolving-graph comparisons are inconsistent | Layout anchoring and snapshot comparison are conventional engineering tasks | High for moderate visible subgraphs | Define measurable orientation and comparison UX |
| Community birth/split/merge/death/resurgence | No complete public product workflow identified | Detection and lineage algorithms exist separately; uncertainty remains open | Medium; feasible with explicit lineage DAG and ensemble confidence | Require reversible lineage with unresolved states |
| Directed, weighted, typed, multiplex relationships | Enterprise graph platforms support rich schemas | Leiden, Infomap, block models, and custom features cover subsets | High if semantics remain explicit; no universal detector | Require algorithm-specific graph projections |
| Streaming community updates | Limited direct product evidence | TILES and incremental methods exist but have maturity and replay limits | Medium-low for initial production | Defer hard real-time guarantees; support repeatable batch/incremental recomputation first |
| Temporal link or event prediction | Often marketed broadly but rarely benchmarked publicly | Many methods exist; simple baselines often competitive | Medium, task-specific | Optional module gated by calibration and utility |
| Analyst-grade explanation | Products expose sources and charts; model explanation quality is unclear | Temporal explainers are early and do not prove evidentiary validity | Medium for deterministic evidence packages; low for causal model explanation | Require evidence packages, not “AI rationale” claims |
| CPU-first operation | Desktop and server products support CPU workflows | Classical methods and bounded learned baselines are feasible | High for core workflow | GPU must remain optional |
| Evidence correction with downstream impact | Governance requires correction and notification; product coverage is unclear | Dependency graphs and versioned derivation records are conventional but costly | Medium-high | Must trace affected outputs and disseminations |
| Guided novice investigation | Existing products provide training but public workflow quality is not comparable | Synthetic cases and progressive disclosure are straightforward | High | Require a measurable tutorial and competency checks |

## 3. What should remain deterministic

The following capabilities must not depend on a learned model:

- event-time, valid-time, ingestion-time, and assertion-time storage;
- source provenance and immutable original references;
- graph filtering and traversal at a historical cutoff;
- access, purpose, sensitivity, retention, and dissemination controls;
- entity-resolution decisions and reversible analyst overrides;
- report/version reconstruction;
- audit and downstream dependency tracking;
- temporal leakage checks;
- community-lineage data representation;
- calculation of deterministic graph statistics; and
- generation of evidence packages from recorded dependencies.

Learned models may rank or suggest. They must not silently rewrite evidence, identity, provenance, access, or historical graph state.

## 4. Product hypotheses

### H1 — Temporal reconstruction

Given a case cutoff and knowledge cutoff, the system can reconstruct what was believed, from which sources, and why, without including later evidence.

Evidence required:

- automated bitemporal query tests;
- late-arriving and corrected-record fixtures;
- historical report reconstruction;
- zero future-dependency leakage in the audit harness.

### H2 — Temporal orientation

Analysts can compare two or more graph periods while retaining visual orientation and understanding which entities, edges, attributes, and communities changed.

Evidence required:

- controlled task completion accuracy and time;
- layout displacement and mental-map metrics;
- change-identification precision/recall;
- novice and experienced-user evaluation.

### H3 — Community lineage

An explicit lineage matcher reduces identity switches and makes births, continuations, splits, merges, deaths, and resurgence more understandable than independent snapshot labels.

Evidence required:

- synthetic lifecycle-event benchmarks;
- lineage-link precision/recall;
- event macro-F1 and detection delay;
- ID switches and fragmentation;
- confidence calibration and analyst explanation ratings.

### H4 — Honest uncertainty

Displaying instability, missingness, competing lineage links, and unresolved states reduces overconfidence without making the tool unusable.

Evidence required:

- interpretation accuracy;
- confidence calibration by users;
- rate of unsupported conclusions;
- task time and abandonment rate;
- comparison against deterministic-looking single outputs.

### H5 — Provenance-first correction

When a source assertion or entity-resolution decision changes, the system identifies every affected graph element, score, community, chart, report, and dissemination.

Evidence required:

- mutation-impact test fixtures;
- completeness and precision of dependency tracing;
- correction propagation latency;
- immutable audit records and recipient notification records.

### H6 — Simple baseline competitiveness

Recency, frequency, EdgeBank, classical temporal features, Leiden, and Infomap satisfy a substantial portion of the analytical objective on CPU.

Evidence required:

- identical data and hardware comparisons;
- prediction, community, calibration, latency, and memory metrics;
- analyst workflow latency;
- performance at three graph scales.

### H7 — Conditional value of temporal neural models

A temporal neural method is retained only if it materially improves a predefined operational metric on new-link, unseen-node, or event-time tasks without unacceptable losses in calibration, robustness, latency, and explainability.

Evidence required:

- hard-negative and full-candidate evaluation;
- rolling-origin confidence intervals;
- calibration by relation, horizon, and entity novelty;
- perturbation and entity-resolution-error suites;
- end-to-end CPU/GPU cost;
- evidence-constrained explanations.

### H8 — Tutorial effectiveness

A guided synthetic case teaches provenance, temporal reasoning, entity ambiguity, community interpretation, uncertainty, and dissemination controls better than an unguided product tour.

Evidence required:

- pre/post competency assessment;
- task completion and error rates;
- retention test;
- privacy and interpretation checkpoint performance.

## 5. Evaluation questions

### Analytical correctness

- Can every visible edge be traced to one or more source assertions?
- Can the graph distinguish absent evidence from evidence of absence?
- Can historical queries reproduce both event reality and knowledge available at that time?
- Are facts, allegations, analyst judgments, and model outputs visually and structurally distinct?
- Do community events remain stable across seeds, nearby parameters, and modest missingness?
- Are unresolved alternatives preserved rather than forced into one answer?

### Temporal prediction

- Does a model improve on recency, frequency, EdgeBank, and calibrated tabular features?
- Does the improvement persist under historical, active-node, and domain-constrained negatives?
- Does it hold for genuinely new relationships and unseen entities?
- Is the probability calibrated at each horizon and relation type?
- Does full-candidate precision support a realistic analyst queue?
- Does performance survive late data, selective missingness, and entity-resolution errors?

### Community analysis

- Which community definition is being used: density, flow retention, block equivalence, mixed membership, or another objective?
- How do resolution, temporal coupling, window width, and relation projection change the result?
- What evidence supports each membership?
- What caused a proposed split, merge, or resurgence?
- How frequently do competing lineage explanations remain plausible?
- Does temporal smoothing delay real change?

### Usability

- Can a novice complete a first investigation without confusing graph prominence with evidentiary strength?
- Can an experienced analyst reach source evidence without losing chart context?
- Can users compare periods without repeated manual layout repair?
- Do uncertainty and policy warnings improve judgment or merely create alert fatigue?
- Can a report be produced with facts, assumptions, alternatives, and confidence clearly separated?

### Governance and security

- Does every query and export have a permissible purpose?
- Are need-to-know and right-to-know rules enforced and audited?
- Can field- and source-level restrictions survive derived analytics and exports?
- Can corrected information be propagated to previous recipients?
- Are protected activities and demographic proxies excluded from inappropriate features?
- Can an auditor reconstruct the exact data, code, parameters, and reasoning used?

### Performance and operations

- What graph size supports interactive filtering, expansion, historical reconstruction, and lineage display on CPU?
- Which operations benefit materially from GPU acceleration?
- What is p95 latency after provenance joins and explanation generation?
- Can late events be replayed deterministically without corrupting historical products?
- What is the maximum sustainable ingestion/update rate?
- What fails first: memory, layout, traversal, lineage matching, model inference, or provenance retrieval?

## 6. Benchmark portfolio

No single dataset can validate the platform. The minimum portfolio is:

1. **Synthetic tutorial case**
   - Known people, organizations, accounts, devices, places, events, sources, uncertainty, and corrections.
   - Used for onboarding, workflow tests, and provenance verification.

2. **Synthetic dynamic-community benchmark**
   - Planted birth, continuation, growth, shrinkage, split, merge, death, intermittence, and resurgence.
   - Includes overlap, missingness, relation types, timestamp jitter, and entity errors.

3. **AMLSim**
   - Transaction patterns and known laundering scenarios.
   - Used for graph, anomaly, and community experiments.

4. **TGB datasets**
   - Standardized temporal prediction, inductive splits, and scale.
   - Used for comparison with published methods, not criminal-risk validation.

5. **Elliptic family**
   - Illicit-finance classification and subgraph-pattern experiments.
   - Used with explicit caveats about identity, unknown labels, and transferability.

6. **Large provenance/cyber graph**
   - Used for ingestion, traversal, temporal path, and scalability stress.

7. **Authorized real case data, if later available**
   - Separate governance, legal review, and evaluation protocol.
   - Non-observed edges remain unknown, not negative.

## 7. Minimum experiment matrix

| Dimension | Required variants |
|---|---|
| Time | snapshot, event, valid-time, and transaction-time reconstruction |
| Graph scale | small tutorial, medium operational, large stress |
| Prediction negatives | uniform, historical, same-time active, domain-constrained, realistic/full candidate |
| Entity novelty | known-known, known-new, new-new |
| Relationship novelty | recurring and first-observed |
| Community detector | independent Leiden, temporal Leiden, Infomap, optional probabilistic comparator |
| Lineage | no matcher, overlap-only matcher, multi-feature lineage DAG |
| Missingness | random, source-specific, bridge-targeted, entire-window, delayed |
| Entity resolution | false merge, false split, uncertain candidate |
| Compute | CPU workstation, CPU server, single GPU |
| Explanation | raw score, unconstrained attribution, evidence-constrained package |
| User | novice and experienced analyst proxy |

## 8. Predefined decision gates

Exact numerical thresholds require requirements work and workload assumptions, but the gate structure is fixed.

### Gate A — correctness

No capability advances if it cannot reconstruct its inputs, time cutoff, algorithm version, and source dependencies.

### Gate B — baseline value

A complex method must outperform simple baselines on the specific target subset, not only an aggregate benchmark.

### Gate C — calibration

Ranking improvement without acceptable calibration and workload precision does not qualify.

### Gate D — robustness

Outputs must degrade visibly and predictably under missingness and entity errors; silent confidence is a failure.

### Gate E — explainability

Every actionable suggestion must include retrievable source evidence, temporal validity, uncertainty, and alternatives.

### Gate F — performance

Core investigation remains functional on CPU. GPU-only capabilities are optional and must fail gracefully.

### Gate G — human factors

The system must reduce task error or time without increasing unsupported conclusions or automation overreliance.

### Gate H — governance

Purpose, access, retention, audit, correction, and dissemination controls must apply to derived analytics, not only raw records.

## 9. Evidence-quality assessment

| Evidence class | Confidence | Use |
|---|---|---|
| Current laws, regulations, and official policies | High for stated jurisdiction and scope | Guardrails and deployment questions |
| Official product documentation | Medium for advertised availability | Market capability baseline, not comparative effectiveness |
| Peer-reviewed primary methods papers | Medium for the reported experiments | Candidate selection and hypothesis generation |
| Author-maintained repositories | Medium-low for reproducibility potential | Feasibility and implementation reference |
| Vendor/project scale claims | Low without controlled reproduction | Benchmark hypotheses only |
| Public benchmark leaderboards | Medium for the exact protocol | Narrow model comparison only |
| Synthetic datasets | High for planted truth, low for realism | Correctness and failure-mode testing |
| Public illicit-finance datasets | Medium for their labels and domain | Domain-adjacent experiments, not person-level generalization |
| Analyst workflow reports and case studies | Medium-low for current generalization | User-story and usability hypotheses |

## 10. Contradictory evidence reconciliation

### Complex models versus simple baselines

Resolution: require both. Complexity receives no presumption of value.

### Temporal stability versus change sensitivity

Resolution: measure a Pareto surface. Never optimize stability alone.

### Broader sharing versus purpose limitation

Resolution: controlled collaboration with purpose-, source-, field-, and recipient-aware dissemination.

### Fast alerts versus review quality

Resolution: risk-tiered automation and review. High-impact outputs require stronger approval.

### More data versus better intelligence

Resolution: optimize source quality, information gain, correction rate, and decision usefulness—not ingestion volume.

### Rich visualization versus evidentiary neutrality

Resolution: visual prominence must not encode guilt. Evidence status, confidence, time, and source quality must remain visible.

### Reproducibility versus evidentiary provenance

Resolution: support both. A reproducible algorithm run is not sufficient if its input assertions cannot be traced.

### Prediction versus explanation

Resolution: model explanation describes model behavior; evidence packages describe source support. Do not conflate them.

## 11. Phase 1 retrospective — What could make this wrong?

- The research is based on public evidence and may miss private product capabilities or internal law-enforcement practices.
- Product documentation cannot establish actual analyst performance or cost.
- The technical literature overrepresents clean datasets and predictive metrics.
- Dynamic communities may not correspond to legally or operationally meaningful groups.
- Bitemporal provenance may be more expensive to query and visualize than expected.
- Analysts may prefer flexible manual charts over constrained reproducible workflows.
- Entity resolution may dominate temporal analytics and community quality.
- Jurisdictional requirements may conflict with the proposed U.S.-oriented baseline.
- Synthetic tutorial and benchmark scenarios may encode unrealistic assumptions.
- GPU availability, security accreditation, and deployment constraints may differ by customer.
- A competitor may already provide equivalent capabilities through non-public extensions.
- The strongest differentiator may ultimately be correction/audit workflow rather than advanced graph learning.

## 12. Phase 1 completion statement

Phase 1 has established:

- a current competitive baseline;
- representative analyst roles and workflows;
- governance and provenance constraints;
- temporal graph and dynamic-community method taxonomies;
- CPU/GPU and implementation-maturity assessments;
- dataset, metric, calibration, robustness, explanation, and usability protocols;
- contradictions and evidence limits; and
- falsifiable product hypotheses and decision gates.

Phase 2 may now define requirements. It must not select implementation architecture or promise predictive capabilities that have not passed the gates above.

## Research inputs

- [Phase 1A market and workflow baseline](./phase-1a-market-and-workflows.md)
- [Phase 1B temporal graphs and communities](./phase-1b-temporal-graphs-and-communities.md)
