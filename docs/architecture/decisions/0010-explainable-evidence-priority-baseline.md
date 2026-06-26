# ADR 0010: Explainable Evidence-Priority Baseline

## Status

Accepted.

## Decision

Provide a deterministic, CPU-only baseline that orders neutral review items by
the strength and operational relevance of evidence available at an explicit
cutoff. The output is an **evidence-review priority index**, not a guilt,
criminality, dangerousness, or future-conduct score. It cannot create source
assertions or alter evidence.

Inputs are immutable, versioned item snapshots and versioned evidence records.
The baseline selects the latest record version known at the cutoff and excludes
records observed or recorded later. Every ordered output carries the exact
`record_id@version` dependencies and the baseline/input versions.

## Explanation contract

Each selected evidence record has transparent contributions for:

- evidence quality;
- recency at the cutoff;
- corroboration;
- observed change;
- evidence coverage.

Configuration fixes weights, bounds, recency decay, missingness penalties,
uncertainty perturbation, and minimum-evidence gates. Contributions and the
final index are bounded from 0 to 100. Missing factors contribute no positive
points and incur visible penalties.

The output includes:

- factor and record contributions;
- a bounded sensitivity interval, not a confidence or probability interval;
- a counterfactual result after removing each exact evidence dependency;
- excluded future or superseded dependencies;
- explicit abstention reasons and limitations.

If the minimum evidence count or factor coverage is not met, the baseline
abstains and emits no index. Ranking is deterministic: equal indexes share a
competition rank and item ID is only a stable display-order tie breaker.

## Prohibited inputs and language

Protected attributes are rejected in item and evidence metadata, including
nested values. They are not available as factors, proxies, tie breakers, or
evaluation fields. Labels describe only evidence review priority:
`higher`, `standard`, `lower`, or `insufficient evidence for review ordering`.

The baseline must not use labels such as suspect, guilty, criminal, dangerous,
or risk score. Human review remains required; ranking does not establish facts
about a person or organization.

## Evaluation boundary

Evaluation utilities can align ordered outputs with labels observed strictly
after the prediction cutoff and can produce fixed-bin empirical summaries.
Rows preserve baseline, input, and label-definition versions. These utilities
are calibration-ready plumbing only: empirical bins are explicitly marked
uncalibrated and no calibration claim is made without a separately approved,
temporally valid evaluation.

## Consequences

- Results are reproducible without accelerators, randomness, or external
  services.
- Explanations can be reconstructed from exact immutable dependencies.
- Future evidence cannot leak into an earlier ordering.
- Additional learned models must beat this baseline under ADR 0006 gates and
  retain abstention, temporal, protected-attribute, and explanation controls.

## Traceability

ADR 0006; REQ-FR-025–027; GATE-E, F, G, H, K.
