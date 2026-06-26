# Phase 1B: Temporal Graph Learning and Dynamic Communities

Research date: June 25, 2026  
Status: research baseline complete; candidates are not architecture commitments

## Executive conclusion

No single reviewed method or framework satisfies the complete application objective. The evidence supports a layered analytical strategy:

1. Deterministic temporal queries and classical graph features.
2. CPU-first recency, frequency, EdgeBank, and calibrated tabular baselines.
3. Independent and temporally coupled community detection.
4. Explicit community-lineage reconstruction as a separate, versioned process.
5. Optional temporal graph learning for narrowly defined prediction tasks.
6. Evidence-constrained explanations, calibration, abstention, and human review.

Temporal graph prediction and dynamic community tracking solve different problems. Temporal embeddings do not automatically provide stable community identities, and temporally smoothed partitions do not automatically provide defensible split, merge, death, or resurgence events.

The platform must not produce a person-level “criminality” score. Predictive outputs should be relationship-, event-, anomaly-, or hypothesis-specific lead-prioritization estimates with provenance, uncertainty, calibration, explicit limitations, and analyst review.

## 1. Temporal graph data semantics

Method selection must begin with the meaning of time.

| Representation | Definition | Appropriate use | Information loss or risk |
|---|---|---|---|
| Snapshot/discrete time | Sequence of graph states `G1 … GT` | Periodic reports, naturally bucketed observations, retrospective comparison | Loses within-window ordering and depends strongly on window width and offset |
| Event/continuous time | Timestamped node, edge, or attribute events | Irregular interactions, communications, transactions, movements | “Continuous time” usually still means discrete timestamped events |
| Streaming/incremental | Bounded-latency updates as events arrive | Alerts and live graph maintenance | Late, corrected, duplicated, and out-of-order events complicate deterministic replay |
| Temporal knowledge graph | Typed facts `(subject, relation, object, time)` | Heterogeneous relation forecasting and fact completion | Commonly assumes closed entity/relation vocabularies and ranking rather than calibrated evidence |
| Bitemporal assertion graph | Event/valid time plus ingestion/transaction/assertion time | Historical reconstruction, late evidence, corrections, audit | Rarely supported directly by temporal-GNN benchmarks; must be application-level semantics |

Events, intervals, and persistent facts are not interchangeable. Converting intervals to point events can imply false disappearance; aggregating events into snapshots can reverse or erase temporal paths.

## 2. Temporal graph learning methods

| Method | Family | Strongest use | Generalization | CPU/GPU assessment | Principal limitation |
|---|---|---|---|---|---|
| EvolveGCN | Snapshot GCN parameters evolved by recurrent units | Snapshot node/edge tasks with changing node sets | Structural induction when compatible node features exist | CPU feasible for moderate snapshots; GPU useful | Archived official repository and weak event fidelity |
| DySAT | Snapshot structural and temporal attention | Retrospective temporal embeddings | Primarily transductive | GPU-oriented | Node-organized histories and weak production maturity |
| TGAT | Stateless temporal neighborhood attention | Inductive temporal link/node tasks | Stronger unseen-node story than state-table models | CPU possible with shallow bounded sampling; GPU preferred at scale | Attention is not a faithful explanation |
| TGN | Event messages, node memory, memory updater, temporal embedding | Event-driven prediction and alerting experiments | Conditional unseen-node support | GPU practical; CPU possible at constrained scale | Stateful serving, reset, replay, and same-batch leakage are complex |
| DyRep | Point process plus recurrent node states | Event occurrence and event-time modeling | Claimed inductive behavior requires direct cold-start testing | Computationally heavier; GPU preferred | Complex likelihood and latent state are difficult to explain |
| JODIE | Coupled recurrent bipartite embeddings | Person-account, account-device, or customer-item streams | Mostly transductive and bipartite | Credible CPU baseline at moderate scale | Not a general heterogeneous graph model |
| CAWN | Causal anonymous temporal walks and motifs | Inductive link prediction and motif-based evidence inspection | Strong structural induction | Sampling can be CPU-heavy; GPU useful at scale | Motifs improve inspectability but not causal explanation |
| GraphMixer | MLP mixing over bounded temporal histories | Simple continuous-event learned baseline | Supports inductive evaluation | Strongest CPU-oriented neural candidate reviewed | Narrow task support and latent outputs |
| DyGFormer | Transformer over patched long histories | Offline long-history accuracy candidate | Transductive and new-node protocols | GPU preferred | Heavier and less interpretable |
| RE-NET / RE-GCN | Temporal knowledge-graph forecasting | Typed future-fact ranking | Mostly fixed-vocabulary/transductive | GPU preferred for larger graphs | Predicted facts can be mistaken for evidence |

### Candidate evaluation set

The research supports an evaluation shortlist, not a final selection:

- Mandatory deterministic baselines: recency, frequency, temporal common neighbors, temporal motifs, and EdgeBank.
- Calibrated non-neural baseline: logistic regression or gradient-boosted trees over provenance-safe temporal features.
- CPU-oriented learned model: GraphMixer.
- Event-memory model: TGN.
- Inductive structural methods: TGAT and CAWN.
- Long-history accuracy candidate: DyGFormer.
- Snapshot baseline: a maintained reimplementation of EvolveGCN or a simpler recurrent snapshot model.
- Typed-fact research experiment: RE-GCN or RE-NET, isolated from evidence assertions.
- Event-time research experiment: DyRep.

No reviewed official repository is production-ready. DyGLib is the strongest unified research harness among the reviewed continuous-time implementations, but it remains research software.

## 3. Temporal leakage controls

A chronological row split is insufficient. Every experiment must enforce:

1. Every sampled event, neighbor, aggregate, and feature must predate the forecast cutoff.
2. Availability/ingestion time must be respected in addition to represented event time.
3. Same-timestamp events must be atomic unless their order is known.
4. Normalization, vocabularies, graph statistics, feature fitting, and entity resolution must use only information available by the cutoff.
5. Future positives must not be labeled as definitive negatives.
6. Memory models must reset and replay deterministically at every fold and historical evaluation point.
7. Causal batching must prevent later events from updating state before earlier predictions.
8. Labels must appear at their actual adjudication or maturation time.
9. Temporal-KG ranking must not filter candidates using future facts.
10. Backfilled and corrected records require transaction-time-aware reconstruction.

For each prediction at time `t`, the evaluation harness should calculate the maximum event time, ingestion time, label-availability time, and transformation-fit time of every dependency. Any value later than `t` is a leakage failure.

## 4. Dynamic community detection taxonomy

| Family | Mechanism | Strength | Failure mode |
|---|---|---|---|
| Evolutionary clustering | Balance current fit and similarity to previous partition | Reduces random jitter | Can hide real abrupt changes |
| Explicit temporal smoothness | Penalize changes in assignments or latent representations | Direct persistence control | Smoothness coefficient lacks clear operational meaning |
| Multislice/multilayer optimization | Couple node copies across temporal or relation layers | Joint temporal and multiplex analysis | Resolution and coupling can dominate the result |
| Incremental/streaming | Update affected communities after graph events | Low update latency | Path dependence and difficult deletion/replay semantics |
| Probabilistic block models | Model latent groups and temporal transitions | Likelihoods and posterior uncertainty | Strong assumptions and higher computational cost |
| Embedding plus clustering | Cluster temporal node representations | Combines attributes and topology | Indirect, unstable, and weakly explainable communities |

### CPU-first candidates

1. **Independent Leiden/CPM snapshots**
   - Transparent unsmoothed baseline.
   - Strong CPU implementation through igraph/leidenalg.
   - Requires repeated seeds and an explicit lineage layer.

2. **Temporal Leiden/CPM**
   - Supports changing node sets and coupled slices.
   - Useful for testing temporal smoothness.
   - Resolution and interslice coupling require sensitivity surfaces.

3. **Infomap multilayer/state-node analysis**
   - Strong for directed and weighted flow networks.
   - Supports hierarchy, multilayer graphs, memory, and state-node overlap.
   - Its flow-retention communities answer a different question from density-based Leiden.

4. **TILES/eTILES research adapter**
   - Streaming and overlapping.
   - Useful comparator for interaction streams and split/merge behavior.
   - Requires modernization before production use.

5. **dynSBM**
   - Probabilistic CPU/Rcpp benchmark for small and medium snapshot sequences.
   - Useful for model-based comparison and membership uncertainty.
   - Does not independently solve flexible lineage or varying community count.

Deep embedding-based clustering should be deferred until simpler methods fail on predefined tests.

## 5. Community identity and lineage

Community labels emitted by an algorithm are local, arbitrary identifiers. Persistent identity must be represented as a lineage DAG:

```text
partition run
  -> community observation
  -> candidate parent/child links
  -> accepted lineage links
  -> lifecycle event
  -> persistent lineage identity
```

Each community observation must preserve:

- snapshot or validity interval;
- member set and optional membership weights;
- internal/external edge and relation statistics;
- detector, version, parameters, seed, and input graph version;
- candidate and accepted parent/child links;
- matching features, similarity, threshold, and confidence;
- event type, alternatives, and analyst correction history; and
- source assertions supporting membership.

### Lifecycle semantics

- **Birth:** no sufficiently supported parent.
- **Death:** no supported child after an allowed observation delay.
- **Continuation:** one dominant parent and child with bounded change.
- **Split:** one parent has multiple material children.
- **Merge:** multiple material parents produce one child.
- **Resurgence:** a community strongly matches a dormant lineage after an absence.
- **Growth/shrinkage:** attributes of continuation, not necessarily mutually exclusive primary events.

For identity safety:

- continuation preserves the identity;
- split children receive new IDs linked to the parent;
- merge output receives a new ID linked to every parent; and
- resurgence reuses a dormant ID only above a stricter, gap-penalized threshold.

This avoids arbitrarily declaring one split child or merge parent to be the “real” surviving organization.

### Matching evidence

Candidate lineage links may combine:

- Jaccard or overlap coefficient;
- weighted Jaccard for fuzzy memberships;
- GED directional inclusion;
- internal edge or interaction-profile similarity;
- typed-relation distributions;
- role-profile similarity;
- temporal gap penalty; and
- source-quality and observation-coverage compatibility.

Detection and lineage must remain separable so that alternative detectors can be compared under the same lineage protocol.

## 6. Uncertainty and missing data

Criminal-network observations are incomplete, selectively collected, delayed, corrected, and potentially deceptive. Missing edges are not confirmed non-relationships.

Required uncertainty outputs:

- assignment frequency across random seeds and bootstraps;
- pairwise co-membership probability;
- lineage-link acceptance frequency;
- lifecycle-event confidence;
- competing lineage hypotheses;
- sensitivity surfaces over snapshot width, offset, resolution, coupling, and match threshold; and
- explicit unresolved status.

Required perturbations:

- random and degree-biased edge deletion;
- source-specific and period-specific missingness;
- missing nodes or complete data sources;
- bridge-edge deletion;
- timestamp jitter and aggregation;
- delayed, duplicated, and out-of-order events;
- false-positive and wrong-direction edges;
- entity merge and split errors;
- missing entire time windows;
- coordinated edge injection; and
- selective missingness correlated with community or collection source.

The most important dynamic-community failures include identity switches, false births/deaths, false splits/merges, fragmentation, detection delay, and confidence collapse—not only reduced modularity or NMI.

## 7. Evaluation planes

A defensible evaluation requires six independent planes.

### 7.1 Future-event prediction

Separate:

- transductive and unseen-node cases;
- recurring and genuinely new links;
- candidate ranking and open-world forecasting;
- one-unseen and both-unseen endpoints; and
- short, medium, and long horizons.

Use:

- MRR and Hits@K for ranking;
- PR-AUC and average precision for rare positives;
- Precision@K for analyst queue capacity;
- Brier score and log loss for probability quality;
- full-candidate or realistic-candidate evaluation in addition to sampled negatives; and
- uniform, historical, same-time-active, and domain-constrained negatives.

ROC-AUC alone is insufficient under extreme imbalance.

### 7.2 Community and lineage correctness

With ground truth:

- AMI, ARI, NMI, and variation of information;
- overlapping NMI and Omega;
- lineage-link precision and recall;
- ID switches and fragmentation;
- event-type macro-F1;
- event detection delay and duration error; and
- Brier/log loss for event confidence.

Without ground truth:

- held-out likelihood or predictive loss;
- MDL/description length or Infomap codelength;
- modularity, CPM quality, conductance, and density as diagnostics;
- sensitivity across seeds, windows, and nearby parameters; and
- analyst assessment of evidence traceability.

Temporal stability must be reported separately from correctness. A constant partition is perfectly stable and can miss every real change.

### 7.3 Calibration and utility

Report:

- reliability diagrams;
- Brier score, log loss, calibration slope/intercept;
- class-conditional and adaptive ECE;
- precision and expected workload at thresholds;
- calibration drift by time;
- seen versus unseen entities;
- recurring versus novel relationships;
- relation type, horizon, collection source, and operational subgroup; and
- cost-sensitive decision curves.

Model estimates must never be described as probability of guilt or criminality.

### 7.4 Robustness and stability

For each corruption level report:

- absolute and relative performance loss;
- area under the corruption-performance curve;
- worst-period and worst-group performance;
- rank correlation;
- community and lineage degradation;
- calibration drift;
- explanation overlap;
- provenance retention; and
- fraction of outputs crossing an operational threshold.

### 7.5 Explanation quality

An analyst-facing explanation must identify historical source assertions, events, paths, motifs, and attributes.

Evaluate:

- fidelity after removing cited evidence;
- sufficiency using only cited evidence;
- temporal validity;
- sparsity and structural coherence;
- counterfactual validity;
- stability across seeds and perturbations;
- evidence coverage;
- uncertainty and alternative explanations; and
- analyst correctness, time, and overreliance.

Attention weights alone do not qualify as an explanation. CAWN, TempME, and TGIB are useful research references, but none establishes legal or evidentiary validity.

### 7.6 Compute and reproducibility

Record:

- CPU, RAM, NUMA, GPU, and VRAM;
- software, compiler, and CUDA versions;
- raw and processed data sizes;
- preprocessing time and memory;
- training time, events/second, and convergence;
- peak CPU RSS and GPU memory;
- inference throughput;
- cold/warm p50, p95, and p99 latency;
- online update latency;
- checkpoint size and load time;
- deterministic replay behavior;
- late-event correction cost; and
- OOM/failure point.

Benchmark at:

1. CPU-only workstation.
2. CPU production server.
3. Single commodity GPU.
4. Multi-GPU only when a measured requirement justifies it.

End-to-end benchmarks must include temporal indexing, sampling, feature retrieval, provenance joins, and explanation generation.

## 8. Framework assessment

| Framework | Best role | Limitation |
|---|---|---|
| TGB/TGB 2.0 | Standardized temporal datasets, splits, evaluators, and leaderboards | Does not cover lineage, provenance, calibration, adversarial robustness, or analyst utility |
| DyGLib | Unified comparison of continuous-time models and negative samplers | Research harness with implementation-dependent results |
| PyTorch Geometric Temporal | Snapshot spatiotemporal model experiments | Primarily sensor/traffic/epidemiological snapshot forecasting |
| DGL | General graph infrastructure | No coherent maintained temporal benchmark layer; current TGN example is removed |
| TGL | Very-large multi-GPU temporal training research | Specialized infrastructure and weak fit for CPU-first analyst interaction |
| igraph/leidenalg | Efficient classical community analysis | Requires application-defined temporal semantics, lineage, and provenance |
| Infomap | Directed/weighted/multilayer flow communities | Community objective differs from density-based methods |

## 9. Dataset strategy

No reviewed public dataset is a representative longitudinal criminal-intelligence graph with assertion-level provenance, reliable negatives, and complete dynamic-community ground truth.

Use a portfolio:

| Dataset family | Purpose | Critical limitation |
|---|---|---|
| TGB social, trade, transaction, and heterogeneous graphs | Standardized temporal prediction and scalability | Sampled negatives and non-criminal semantics |
| Elliptic, Elliptic++, Elliptic2 | Illicit finance and laundering-pattern experiments | Addresses are not persons; unknown labels and proprietary attribution |
| AMLSim | Safe synthetic laundering scenarios with ground truth | Evaluates simulator assumptions |
| ICEWS/GDELT | Typed event forecasting | Reporting bias and geopolitical rather than case semantics |
| DARPA OpTC/LANL | Large temporal provenance and attack-chain graphs | Cyber/enterprise behavior differs from interpersonal crime |
| Synthetic evolving LFR and progressive benchmarks | Known community lifecycle events | Weak realism and collection bias |
| Analyst-curated synthetic investigation | Workflow, provenance, tutorial, and human evaluation | Requires careful scenario design and cannot prove field performance |

Real case data, if later authorized, must be evaluated separately with jurisdiction-specific controls and without assuming non-observed edges are negatives.

## 10. Concrete Phase 1C evaluation hypotheses

1. Historical and same-time hard negatives will materially reduce reported performance and may reverse model rankings.
2. EdgeBank, recency, and frequency baselines will remain competitive on recurring links.
3. Complex methods must demonstrate gains specifically on new-link and unseen-node subsets.
4. Full-candidate precision will be substantially lower than sampled-negative MRR.
5. TGB performance will not reliably predict AMLSim or Elliptic performance.
6. Temporal smoothing will improve apparent stability while delaying births and splits.
7. Explicit lineage matching will reduce ID switches without materially degrading membership quality.
8. Targeted bridge-edge deletion will cause more damage than equal-volume random deletion.
9. Entity-resolution merge errors will damage graph outputs more than comparable random edge noise.
10. Calibration will deteriorate with horizon, unseen entities, rare relation types, and distribution shift.
11. Aggregate temperature scaling will not fully calibrate positive/negative, relation, and horizon subgroups.
12. Explanation fidelity and stability will not be strongly coupled.
13. Evidence-constrained explanations will be larger but more useful than unconstrained saliency.
14. CPU classical methods will meet interactive exploration targets more consistently than temporal neural models.
15. GPU acceleration will primarily improve bulk training, not small provenance-heavy queries.

Thresholds and success criteria must be fixed before final experiments.

## 11. Architect, Builder, Reviewer synthesis

### Architect

- Keep temporal storage/query semantics independent from model choice.
- Treat bitemporal assertion history as a platform invariant.
- Separate community detection, lineage reconstruction, prediction, calibration, and explanation.
- Require an algorithm-independent interchange format for partitions, lineages, predictions, and evidence packages.

### Builder

- Start with CPU-first deterministic and classical baselines.
- Use maintained igraph/leidenalg and Infomap implementations for initial community experiments.
- Adapt a unified temporal-learning harness rather than embedding aging research repositories directly into production.
- Build deterministic replay and leakage tests before model training.

### Reviewer

- Reject claims based only on vendor scale, paper leaderboard scores, random negatives, ROC-AUC, or modularity.
- Require hard-negative, full-candidate, perturbation, calibration, and latency evidence.
- Treat attention as visualization, not explanation.
- Require unresolved/abstain states and reversible analyst corrections.
- Do not allow predicted facts, communities, or scores to be presented as evidence of criminal conduct.

## 12. Retrospective: What could make this wrong?

- Private datasets or implementations may behave differently from public evidence.
- Entity-resolution quality may dominate every model comparison.
- Community ground truth may be plural or nonexistent: communication, finance, logistics, and command groups can differ.
- Snapshot width, temporal coupling, and lineage thresholds may dominate detector choice.
- New methods released after June 25, 2026 may alter the candidate set.
- Repository availability does not establish maintained, secure, or deterministic production behavior.
- Hardware-specific optimization may reverse CPU/GPU rankings.
- Synthetic perturbations may not reproduce concealment, source bias, selective enforcement, or investigative feedback loops.
- Probabilistic uncertainty is only valid relative to model assumptions.
- Legal constraints may make technically predictable targets inappropriate to model.
- No public benchmark can prove analyst usefulness, legal admissibility, or absence of discriminatory impact.

## 13. Primary sources

Accessed June 25, 2026 unless otherwise stated.

### Temporal graph learning

- [EvolveGCN](https://arxiv.org/abs/1902.10191)
- [DySAT](https://arxiv.org/abs/1812.09430)
- [TGAT](https://arxiv.org/abs/2002.07962)
- [TGN](https://arxiv.org/abs/2006.10637)
- [DyRep](https://arxiv.org/abs/1803.04051)
- [JODIE](https://arxiv.org/abs/1908.01207)
- [CAWN](https://arxiv.org/abs/2101.05974)
- [GraphMixer](https://arxiv.org/abs/2302.11636)
- [DyGFormer and DyGLib](https://arxiv.org/abs/2303.13047)
- [RE-NET](https://arxiv.org/abs/1904.05530)
- [RE-GCN](https://arxiv.org/abs/2104.10353)
- [EdgeBank and dynamic-link evaluation](https://arxiv.org/abs/2207.10128)
- [TGL](https://arxiv.org/abs/2203.14883)
- [Temporal Graph Benchmark](https://arxiv.org/abs/2307.01026)
- [TGB 2.0](https://arxiv.org/abs/2406.09639)
- [TempME](https://arxiv.org/abs/2310.19324)
- [TGIB](https://arxiv.org/abs/2406.13214)

### Dynamic communities

- [Evolutionary Clustering](https://doi.org/10.1145/1150402.1150467)
- [FacetNet](https://doi.org/10.1145/1367497.1367590)
- [Adaptive evolutionary clustering](https://arxiv.org/abs/1104.1990)
- [Multislice community structure](https://arxiv.org/abs/0911.1824)
- [Dynamic-community survey](https://arxiv.org/abs/1707.03186)
- [LabelRankT](https://arxiv.org/abs/1305.2006)
- [DynaMo](https://arxiv.org/abs/1709.08350)
- [TILES](https://doi.org/10.1007/s10994-016-5582-8)
- [Dynamic stochastic block models](https://arxiv.org/abs/1403.0921)
- [Statistical clustering through a dynamic SBM](https://arxiv.org/abs/1506.07464)
- [GED group evolution discovery](https://arxiv.org/abs/1207.4297)
- [Palla et al. group evolution](https://doi.org/10.1038/nature05670)
- [Infomap sparse memory networks](https://arxiv.org/abs/1706.04792)

### Frameworks and datasets

- [Temporal Graph Benchmark portal](https://tgb.complexdatalab.com/)
- [DyGLib repository](https://github.com/yule-BUAA/DyGLib)
- [PyTorch Geometric Temporal](https://pytorch-geometric-temporal.readthedocs.io/en/latest/)
- [leidenalg temporal partition API](https://leidenalg.readthedocs.io/en/stable/reference.html#leidenalg.find_partition_temporal)
- [Infomap repository](https://github.com/mapequation/infomap)
- [TILES repository](https://github.com/GiulioRossetti/TILES)
- [dynsbm package](https://cran.r-project.org/package=dynsbm)
- [AMLSim repository](https://github.com/IBM/AMLSim)
- [Elliptic++ repository](https://github.com/git-disl/EllipticPlusPlus)
- [Elliptic2](https://arxiv.org/abs/2404.19109)
