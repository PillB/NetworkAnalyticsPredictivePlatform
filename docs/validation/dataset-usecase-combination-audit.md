# Dataset and Use-Case Combination Audit

Date: 2026-06-30

## Principle

Every dataset is now connected to the website by one of three paths:

- **Runs now**: embedded fixture directly drives a website use case.
- **Matched safe demo flow**: external dataset family maps to the closest use
  case and opens that full embedded demo flow, but real data still requires
  offline download/license/schema work.
- **Matched safe demo slice**: external fraud/AML/financial graph family can
  load a synthetic schema-compatible transaction slice into the import flow.

No external sensitive, credentialed, large, or real-person dataset is represented
as embedded training data. The page now states whether the selected dataset uses
all embedded nodes/edges/datapoints in-browser or requires an external adapter
before all source rows can be used.

## AI, ML, and Deep-Learning Semantics

- Harbor temporal flow: deterministic temporal/community reasoning and visual
  split logic; no LLM, no GenAI, no production model.
- Dojo/community flow: CPU deterministic label-propagation baseline with bridge
  uncertainty; calibrated false; no GenAI.
- Fraud/transaction flow: deterministic anomaly scorer plus browser-local
  logistic review-priority model; calibrated false; no LLM/API.
- Deep-learning/GNN/TGNN candidates: described only as offline adapter
  evaluation targets until leakage-safe splits, hard negatives, calibration,
  robustness, explanation, and governance gates pass.

## Combination Matrix

| Dataset family | Harbor temporal | Dojo community | Fraud/local ML |
| --- | --- | --- | --- |
| Harbor Lantern | Runs now | Supporting benchmark | Not primary |
| Synthetic cuentas mulas | Supporting benchmark | Supporting benchmark | Runs now |
| Dojo karate split | Supporting benchmark | Runs now | Not primary |
| TGB/TGB2/TGX | Matched safe demo flow | Requires adapter mapping | Requires adapter mapping |
| Elliptic/Elliptic++ | Requires adapter mapping | Requires adapter mapping | Matched safe demo slice |
| AMLSim | Requires adapter mapping | Requires adapter mapping | Matched safe demo slice |
| PaySim | Requires adapter mapping | Requires adapter mapping | Matched safe demo slice |
| IEEE-CIS | Requires adapter mapping | Requires adapter mapping | Matched safe demo slice |
| DGraph-Fin | Requires adapter mapping | Requires adapter mapping | Matched safe demo slice |
| GADBench | Requires adapter mapping | Requires adapter mapping | Matched safe demo slice |
| ORBITAAL-style AML | Requires adapter mapping | Requires adapter mapping | Matched safe demo slice |
| SNAP temporal communication | Requires adapter mapping | Matched safe demo flow | Requires adapter mapping |
| SocioPatterns contact networks | Requires adapter mapping | Matched safe demo flow | Requires adapter mapping |
| Network Repository crime/co-offending | Requires adapter mapping | Matched safe demo flow | Requires adapter mapping |
| UCINET crime-network references | Requires adapter mapping | Matched safe demo flow | Requires adapter mapping |
| Synthetic criminal-network generator | Requires adapter mapping | Matched safe demo flow | Requires adapter mapping |

## Website Flow

1. User opens Dataset coverage.
2. User selects any dataset family.
3. The panel shows Harbor, Dojo, and Fraud compatibility rows with expected
   AI/ML behavior.
4. **Open built-in demo flow** switches to the closest runnable built-in
   workflow and states that source rows still require adapter mapping.
5. **Load safe transaction slice** is enabled for transaction/AML/fraud-like
   external families and loads synthetic CSV into the import preview workflow.
6. **Open safe demo flow** is enabled for temporal/community/crime/contact
   adapters and opens the closest embedded demo with explicit node/edge/datapoint
   counts.
7. User previews rows, applies accepted rows, runs local analysis, inspects
   evidence, reviews reasoning/options, acknowledges the recommendation, marks
   the finding ready, and runs report preflight.

## Product Review Result

This closes the previous gap where datasets were only cataloged. They are now
actionable in the website through either an embedded full-data flow, a matched
safe demo flow, or a safe synthetic transaction demo slice, while preserving the
boundary that real external data requires offline adapter work.
