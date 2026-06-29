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
