# Neo4j Bloom Graph Exploration Playwright Audit

Generated: 2026-06-26T19:53:57.888Z

## Scope

This audit compares NetworkAnalyticsPredictivePlatform Step 5 graph exploration behavior against public Neo4j Bloom documentation using Playwright. It validates feature-class parity and documented improvements. It does not claim pixel-perfect replication or complete proprietary parity.

The implementation review used a STORM-inspired method: retrieve public references, inspect multiple perspectives (search, graph patterns, scenes/perspectives, legend/rules, analyst safety), synthesize an implementation outline, then verify the product behavior with browser evidence.

## Public References

- Neo4j Bloom user guide: https://neo4j.com/docs/bloom-user-guide/current/
- Neo4j Bloom search bar: https://neo4j.com/docs/bloom-user-guide/current/bloom-visual-tour/search-bar/
- Neo4j Bloom graph pattern search: https://neo4j.com/docs/bloom-user-guide/current/bloom-tutorial/graph-pattern-search/
- Neo4j Bloom legend panel: https://neo4j.com/docs/bloom-user-guide/current/bloom-visual-tour/legend-panel/
- Stanford STORM paper: https://arxiv.org/abs/2402.14207

Screenshots captured:

- `test-results/bloom-parity/neo4j-bloom-home.png`
- `test-results/bloom-parity/neo4j-bloom-search-bar.png`
- `test-results/bloom-parity/neo4j-bloom-graph-pattern-search.png`
- `test-results/bloom-parity/neo4j-bloom-legend-panel.png`
- `test-results/bloom-parity/stanford-storm-paper.png`

Reference text lengths:

- Bloom home: 3297
- Bloom search bar: 4396
- Bloom graph pattern search: 6661
- Bloom legend panel: 5851
- STORM paper: 3261

## NAPP Evidence

- Phrase search screenshot: `test-results/bloom-parity/napp-bloom-phrase.png`
- Scene/path screenshot: `test-results/bloom-parity/napp-bloom-scene-path.png`
- Explanation text length: 501
- Chart row text length: 371

## Feature-Class Comparison

| Capability | Public reference basis | NAPP audit result | NAPP improvement or safety constraint |
| --- | --- | --- | --- |
| Graph phrase search | Neo4j Bloom search bar documentation describes search phrases, full-text search, graph patterns, and actions. | Pass | Phrases execute against the current authorized visible projection and refuse unsupported patterns. |
| Supported analyst phrases | Neo4j Bloom graph pattern search documents near-natural language graph pattern input using perspective vocabulary. | Pass | Path results include exact synthetic transaction dependencies rather than uncited graph hints. |
| Rule styling and legend | Neo4j Bloom legend panel documentation describes categories, styles, filtering/search, and data-driven rules. | Pass | Financial preset applies restrained boardroom styling with evidence-class rule explanations. |
| Scene preset and reset | Neo4j Bloom documentation frames exploration around graph visualization, scenes, and perspectives. | Pass | Scene presets are validated by workflow and infrastructure visibility before application. |
| Grounded synthesis discipline | The Stanford OVAL STORM paper describes retrieval plus multi-perspective question asking to synthesize grounded outlines. | Pass | The UI exposes source dependencies, cutoff, visual rule rationale, and visible rows in one synthesized panel. |

## Verdict

The Playwright audit supports Step 5 feature-class parity for public Neo4j Bloom-style graph exploration concepts relevant to this training application: search-first graph phrases, near-natural graph pattern behavior, scene/perspective-style presets, legend/rule styling, and plain-language graph explanations. NAPP adds evidence-safe controls: authorized-projection execution, exact source dependencies, known-at cutoffs, preset validation, and neutral decision-support language.

## Remaining Risks

- Public documentation cannot prove complete proprietary Neo4j Bloom behavior.
- This is a functional comparison, not visual cloning.
- Phrase support is intentionally narrow and deterministic; unsupported requests are refused instead of guessed.
- Scene presets are training UI state. Production needs server-side authorization-aware saved perspectives, audit, retention, and multi-user persistence.
