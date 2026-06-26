# Financial Transaction Fraud-Ring and Cuentas Mulas Use Case

Date: June 25, 2026  
Status: implemented synthetic MVP requirement

## Requirement

The platform must support an analyst-facing workflow for detecting possible fraud rings and cuentas mulas using financial transaction data.

Minimum input fields:

- transaction date and time;
- origin account and/or origin person;
- origin person/account identifier when available;
- destination account and/or destination person;
- destination person/account identifier when available;
- amount;
- currency;
- transaction description and/or transaction type;
- optional device, IP, channel, merchant, complaint, KYC, and account-opening attributes.

## Implemented MVP behavior

- Adds a selectable “Cuentas mulas / fraud ring” guided workflow in the web app.
- Provides a synthetic transaction fixture covering collection, bridge/mule, cash-out, and shared infrastructure nodes.
- Runs an explainable CPU-first mule-indicator detector over account behavior.
- Highlights review-priority accounts using behavioral indicators:
  - multiple inbound origins;
  - fan-out to multiple destinations;
  - rapid outbound movement;
  - high pass-through ratio;
  - round/near-round amounts;
  - shared device/IP context.
- Provides temporal before/after transaction graph comparison.
- Preserves exact synthetic transaction dependencies in reports.
- Includes contrary explanations and calibration limitations.
- Documents advanced-model candidates as gated future models rather than unvalidated production claims.

## Advanced model roadmap

Candidate models remain replaceable derived artifacts:

- temporal event-graph encoders such as TGN/TGAT-style account/person transaction streams;
- dynamic community detection using incremental Leiden/Louvain plus lineage matching;
- streaming label propagation for low-latency baselines;
- sequence models over time gaps, amount buckets, currency/channel patterns, and counterparty churn;
- optional heterogeneous GNNs over account, person, device, IP, merchant, and complaint nodes.

Promotion gates:

- temporal train/test split with leakage controls;
- hard negatives and full-candidate precision at analyst workload budgets;
- calibration and abstention;
- robustness to missing transaction fields, delayed reports, entity-resolution errors, and legitimate processors;
- explanation fidelity against source transactions and motifs;
- human overreliance testing.

## Safety boundaries

Outputs are review-priority decision support, not criminality scores. The product must not infer guilt, dangerousness, protected characteristics, or identity merges from mule indicators alone.

## Executable evidence

- `packages/guided-workflow/financial-fraud.mjs`
- `tests/frontend/financial-fraud.test.mjs`
- `tests/browser/pages.e2e.mjs`
