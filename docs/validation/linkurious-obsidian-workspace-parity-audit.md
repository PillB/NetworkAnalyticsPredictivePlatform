# Linkurious / Obsidian Workspace Parity Playwright Audit

Generated: 2026-06-26T19:20:59.807Z

## Scope

This audit compares NetworkAnalyticsPredictivePlatform Step 3 investigation workspace behavior against public Linkurious product pages and Obsidian Graph View documentation using Playwright. It validates feature-class parity and documented improvements. It does not claim pixel-perfect replication or complete proprietary parity.

## Public References

- Linkurious home: https://linkurious.com/
- Linkurious Analyze & Decide: https://linkurious.com/decision-intelligence-platform-analyze-decide/
- Linkurious Detect: https://linkurious.com/decision-intelligence-platform-detection/
- Linkurious Graph Visualization: https://linkurious.com/decision-intelligence-platform-graph-visualization/
- Obsidian Graph View: https://obsidian.md/help/plugins/graph

Screenshots captured:

- `test-results/workspace-parity/linkurious-home.png`
- `test-results/workspace-parity/linkurious-analyze-decide.png`
- `test-results/workspace-parity/linkurious-detect.png`
- `test-results/workspace-parity/linkurious-graph-visualization.png`
- `test-results/workspace-parity/obsidian-graph-view.png`

Reference text captured:

- Linkurious combined text length: 21860
- Obsidian text length: 4414

## NAPP Evidence

- Workspace screenshot: `test-results/workspace-parity/napp-step3-workspace.png`
- Reloaded workspace screenshot: `test-results/workspace-parity/napp-step3-restored.png`
- Packet status: needs-review
- Review status: ready-for-review
- Saved searches: 1
- Comments: 1
- Case notes: 1
- Tasks: 1
- Audit entries: 6

## Feature-Class Comparison

| Capability | Public reference basis | NAPP audit result | NAPP improvement or safety constraint |
| --- | --- | --- | --- |
| Bounded search, pin, expand, path | Linkurious public pages list no-code query builder, queries, filtering, and search; Obsidian Graph View documents search filters. | Pass | Search and expansion are bounded to the authorized visible projection and explain that boundary. |
| Comments, case notes, audit log | Linkurious public pages describe comments, teammate tagging, shared workspaces, shared queries, and collaboration. | Pass | Comments and case notes carry not-evidence status plus audit entries. |
| Task state, review status, reloadable workspace | Linkurious detection page describes organizing cases, updating status, assignment, and case closure. | Pass | Review state is neutral and reloadable in the training browser session. |
| Neutral case packet | NAPP differentiator | Pass | Packet generation blocks guilt implication and keeps comments separate from evidence. |
| Obsidian-inspired graph interaction already present | NAPP differentiator | Pass | Graph view adds presentation-only boardroom styling, undo/redo, and evidence-safe separation. |

## Verdict

The Playwright audit supports Step 3 feature-class parity for the public Linkurious/Obsidian capabilities relevant to investigation workspace behavior: bounded search, graph exploration, comments, shared workspace concepts, case status/task handling, saved layouts/snapshots, export/publish style packets, and graph interaction controls. NAPP adds evidence-safe boundaries, audit metadata, neutral review language, and packet safeguards that prevent analyst notes from becoming evidence or guilt claims.

## Remaining Risks

- Public pages and documentation cannot prove complete proprietary product behavior.
- The training workspace stores snapshots in browser localStorage; production still needs server-side persistence, authorization, retention, dissemination controls, and multi-user concurrency.
- This audit is a functional and structural comparison, not pixel-perfect visual cloning.
- Representative analyst evaluation remains required to prove operational superiority.
