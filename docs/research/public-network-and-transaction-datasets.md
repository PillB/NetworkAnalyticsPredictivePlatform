# Public Network and Transaction Dataset Plan

This note records the dataset decision used by the current training build. It
separates embedded fixtures from external benchmark adapters so the static app
does not pretend that a large or license-restricted dataset has been trained.

## Embedded Fixtures

1. **Dojo karate split benchmark**
   - Source basis: Zachary's karate club community split, documented by
     NetworkX and Network Repository.
   - Product use: small benchmark-derived community-detection walkthrough with
     bridge-member uncertainty.
   - Boundary: useful for deterministic local community detection, not evidence
     of a criminal network.
   - Sources:
     - https://networkx.org/documentation/stable/reference/generated/networkx.generators.social.karate_club_graph.html
     - https://networkrepository.com/soc-karate.php

2. **Harbor Lantern temporal split**
   - Source basis: original fictional fixture.
   - Product use: temporal comparison, provenance, guided report gates.
   - Boundary: synthetic training only.

3. **Synthetic cuentas mulas transaction flow**
   - Source basis: original synthetic transaction fixture.
   - Product use: deterministic anomaly scoring, hard-negative checks, and
     browser-local demo model training.
   - Boundary: uncalibrated review-priority indicators only.

## Adapter-Only Benchmarks

1. **Temporal Graph Benchmark / TGX**
   - Use for temporal link/node prediction adapters and chronological evaluation.
   - Include TGB/TGB 2.0 link-prediction and node-prediction families as
     adapter targets, not embedded data.
   - Do not vendor datasets into the repo because many are large and
     dataset-specific licenses can include noncommercial restrictions.
   - Sources:
     - https://tgb.complexdatalab.com/
     - https://tgb.complexdatalab.com/docs/linkprop/
     - https://tgb.complexdatalab.com/docs/nodeprop/
     - https://github.com/ComplexData-MILA/TGX

2. **Elliptic / Elliptic++**
   - Use for future crypto transaction graph experiments after license review.
   - Do not embed; external hosting and labels require dataset-specific review.
   - Source: https://github.com/git-disl/EllipticPlusPlus

3. **IBM AMLSim**
   - Use as a future generator adapter for synthetic AML typologies and
     hard-negative benchmark expansion.
   - Keep generated outputs outside the static repo unless explicitly curated.
   - Source: https://github.com/IBM/AMLSim

4. **SNAP temporal/email baselines**
   - Use as adapter-only temporal communication baselines, especially
     email-Eu-core-temporal.
   - Do not embed real email-derived data in the training app.
   - Sources:
     - https://snap.stanford.edu/data/
     - https://snap.stanford.edu/data/email-Eu-core-temporal.html
     - https://snap.stanford.edu/data/email-Enron.html

5. **SocioPatterns high-school contact network**
   - Use as adapter-only temporal contact/community benchmark after license
     review.
   - Source: https://sociopatterns.org/datasets/high-school-contact-and-friendship-networks/

6. **PaySim mobile-money fraud**
   - Use as a synthetic mobile-money fraud adapter after source and license
     verification.
   - Product use: stress-test transaction imbalance, obvious fraud patterns,
     and hard-negative scenarios against the browser-local review-priority
     workflow.
   - Boundary: do not claim real banking data or production profitability.

7. **IEEE-CIS fraud**
   - Use as a tabular fraud baseline adapter when credentials and competition
     terms are satisfied.
   - Product use: compare graph-enriched features against a tabular baseline
     and detect feature leakage.
   - Boundary: Kaggle/competition terms prevent vendoring into this repo.

8. **DGraph-Fin**
   - Use as a large financial graph anomaly adapter for offline node-risk and
     graph-model evaluation.
   - Product use: stress large-scale graph anomaly scoring and GNN candidate
     gates.
   - Boundary: no embedded rows or calibrated operational score without
     dataset-specific review and validation.

9. **GADBench-style graph anomaly suites**
   - Use as an adapter suite for YelpChi, Amazon, Weibo, Reddit, and related
     public graph anomaly baselines.
   - Product use: model-family comparison and false-positive stress testing.
   - Boundary: each constituent dataset has separate licensing and provenance.

10. **ORBITAAL-style AML graph benchmarks**
    - Use as an AML transaction-graph adapter target for motif/path risk
      scoring and temporal-GNN candidate evaluation.
    - Boundary: no laundering benchmark rows should be copied into the static
      app without source, license, and sensitivity review.

11. **Network Repository and UCINET crime/co-offending references**
    - Use only as topology and wording-test adapters after original source,
      license, and person-identifiability review.
    - Product use: tiny centrality/community sanity checks and explanation
      safety tests.
    - Boundary: do not embed named sensitive criminal networks or claim real
      gang detection.

12. **Synthetic criminal-network generator target**
    - Use as the safe path for additional gang/community, hierarchy, bridge,
      suspicious-transaction, and group-risk examples.
    - Product use: generate fictional, labeled scenarios that can be imported
      through the website and used in local analysis.
    - Boundary: generated fixtures must still pass prohibited-claim review.

## Do Not Embed By Default

- Named covert/criminal/terror networks from repository mirrors or papers until
  original source, license, sensitivity, and person-identifiability risks are
  reviewed.
- Kaggle-hosted fraud datasets such as IEEE-CIS or PaySim unless the user
  provides credentials and accepts the dataset terms in a downloader workflow.

## Implementation Rule

Embedded fixtures must declare source notes, license notes, allowed claims, and
prohibited claims in `packages/guided-workflow/dataset-registry.mjs`.
Benchmark-only local runs must declare `calibrated: false` and
`productionPredictionsEnabled: false`.

## Complete Website Integration Workflow

1. Select an embedded fixture in the website dataset panel to run immediately:
   Harbor Lantern, Dojo karate split, or Synthetic transaction flow.
2. For an adapter-only dataset, use the panel instructions instead of treating
   the external dataset as loaded.
3. Download and validate the external dataset outside the static website,
   preserving license notes, source checksums, schema definitions, labels, and
   time cutoffs.
4. Convert a curated slice to the transaction CSV/JSON schema or to a future
   graph-adapter artifact with explicit rejected-row reporting.
5. In the website, choose the financial transaction use case, load or paste the
   curated rows, preview mapping, apply accepted rows, run automatic local
   analysis, inspect evidence, review reasoning/options, acknowledge the next
   action, mark the finding ready, and run report preflight.
6. Treat every output as decision support. The website must not describe
   adapter-only datasets as embedded, trained, calibrated, SOTA, or
   production-ready.
