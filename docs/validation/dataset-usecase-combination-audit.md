# Dataset and Use-Case Combination Audit

Date: 2026-06-30

## Principle

Every dataset is now connected to the website by one of three paths:

- **Runs now**: embedded fixture directly drives a website use case.
- **Matched adapter demo**: external dataset family maps to the closest use
  case, but real data still requires offline download/license/schema work.
- **Matched safe demo slice**: external fraud/AML/financial graph family can
  load a synthetic schema-compatible transaction slice into the import flow.

No external sensitive, credentialed, large, or real-person dataset is represented
as embedded training data.

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
| TGB/TGB2/TGX | Matched adapter demo | Supporting benchmark | Not primary |
| Elliptic/Elliptic++ | Supporting benchmark | Supporting benchmark | Matched safe demo slice |
| AMLSim | Supporting benchmark | Supporting benchmark | Matched safe demo slice |
| PaySim | Supporting benchmark | Supporting benchmark | Matched safe demo slice |
| IEEE-CIS | Supporting benchmark | Supporting benchmark | Matched safe demo slice |
| DGraph-Fin | Supporting benchmark | Supporting benchmark | Matched safe demo slice |
| GADBench | Supporting benchmark | Supporting benchmark | Matched safe demo slice |
| ORBITAAL-style AML | Supporting benchmark | Supporting benchmark | Matched safe demo slice |
| SNAP temporal communication | Supporting benchmark | Matched adapter demo | Not primary |
| SocioPatterns contact networks | Supporting benchmark | Matched adapter demo | Not primary |
| Network Repository crime/co-offending | Supporting benchmark | Matched adapter demo | Not primary |
| UCINET crime-network references | Supporting benchmark | Matched adapter demo | Not primary |
| Synthetic criminal-network generator | Supporting benchmark | Supporting benchmark | Matched safe demo slice |

## Website Flow

1. User opens Dataset coverage.
2. User selects any dataset family.
3. The panel shows Harbor, Dojo, and Fraud compatibility rows with expected
   AI/ML behavior.
4. **Open matched flow** switches to the closest runnable built-in workflow.
5. **Load safe demo slice** is enabled only for transaction/AML/fraud-like
   external families and loads synthetic CSV into the import preview workflow.
6. User previews rows, applies accepted rows, runs local analysis, inspects
   evidence, reviews reasoning/options, acknowledges the recommendation, marks
   the finding ready, and runs report preflight.

## Product Review Result

This closes the previous gap where datasets were only cataloged. They are now
actionable in the website through either a matched flow or a safe synthetic
transaction demo slice, while preserving the boundary that real external data
requires offline adapter work.
