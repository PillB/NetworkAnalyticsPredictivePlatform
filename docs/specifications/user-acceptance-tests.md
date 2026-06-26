# User Acceptance and Journey Test Specification

Version: 0.1  
Primary fixture: Harbor Lantern

## 1. Test populations

- First-time novice analysts.
- Experienced analyst proxies and, when authorized, representative analysts.
- Reviewers/supervisors.
- Privacy, records, and security staff.
- Keyboard-only users.
- Screen-reader users.
- Users with color-vision and reduced-motion requirements.

Synthetic correctness tests do not substitute for representative-user validation.

## 2. Novice end-to-end acceptance scenario

### UAT-NOV-001 — Start the analysis

The user selects the guided case, understands that data are fictional, and correctly states that the system does not determine guilt.

### UAT-NOV-002 — Confirm purpose

The user explains why purpose and scope are required and confirms the training scope without help.

### UAT-NOV-003 — Understand the question

The user identifies the core question and can restate the suggested subquestions.

### UAT-NOV-004 — Read the first graph

The user correctly interprets node shape/color, edge style, evidence status, and known-at cutoff.

### UAT-NOV-005 — Inspect evidence

The user opens the evidence behind a relationship and distinguishes source reliability, information credibility, and analytical confidence.

### UAT-NOV-006 — Understand dual time

The user explains the difference between when an event happened and when analysts learned about it.

### UAT-NOV-007 — Compare periods

The user identifies the principal changed entities and relationships without manual layout repair.

### UAT-NOV-008 — Interpret a community split

The user states that the split is an algorithmic pattern, not proof of a criminal group.

### UAT-NOV-009 — Review uncertainty

The user finds the alias ambiguity, missing-source interval, and competing explanation.

### UAT-NOV-010 — Test an alternative

The user removes the disputed alias or changes the window, understands that a new analysis version is created, compares the result, and resets to recommended.

### UAT-NOV-011 — Save a finding

The finding includes supporting evidence, contrary evidence, assumptions, confidence, limitations, and an appropriate next action.

### UAT-NOV-012 — Pass report preflight

The user resolves all blocking issues and generates a reconstructable report.

### UAT-NOV-013 — Knowledge check

The user correctly answers:

- community membership is not proof;
- event and known-at time differ;
- missing observations are not negative evidence;
- the uncertain alias changes confidence;
- contrary evidence belongs in the finding.

## 3. Novice quantitative acceptance

- At least 90% complete without facilitator intervention.
- Median completion time at most 20 minutes.
- At least 85% identify the principal observed change.
- At least 90% open supporting evidence.
- At least 85% understand dual time.
- At least 90% reject community-as-proof interpretation.
- At least 85% include contrary evidence.
- At least 90% identify the uncertain alias.
- At least 85% test an alternative and restore defaults.
- At least 95% generate a reconstructable report.
- No critical privacy, access, or dissemination error.

## 4. Delayed retention

Seven to fourteen days later:

- 80% repeat the core workflow.
- 85% retain the meaning of community uncertainty.
- 85% locate provenance.
- 80% interpret “no longer observed” correctly.
- 80% distinguish analytical settings from visual styling.

## 5. Experienced analyst acceptance

### UAT-EXP-001 — Efficient case setup

Define a custom question, event range, known-at cutoff, relation projection, and saved recipe.

### UAT-EXP-002 — Keyboard exploration

Search, expand, multi-select, find a path, inspect evidence, and save a view using keyboard-efficient controls.

### UAT-EXP-003 — Multi-period analysis

Compare periods, inspect changes, switch community objective, and review sensitivity.

### UAT-EXP-004 — Reproducibility

Reopen and reproduce an analysis from its manifest.

### UAT-EXP-005 — Error recovery

Recover from an intentionally incorrect parameter, failed analytical job, and stale evidence dependency.

### Quantitative targets

- 25% faster two-period comparison than baseline.
- 30% fewer community identity-tracking errors.
- 25% faster access to source evidence.
- No increase in unsupported conclusions.
- 90% reproduce a saved analysis.
- 95% recover from an intentional parameter mistake.
- 50% less manual node repositioning.

## 6. Reviewer acceptance

### UAT-REV-001 — Claim trace

Reach supporting source evidence for a factual claim within two interactions.

### UAT-REV-002 — Contrary evidence

Identify a deliberately inserted contradictory source.

### UAT-REV-003 — Derived-output disclosure

Identify an undisclosed algorithmic/model output.

### UAT-REV-004 — Reconstruction

Reconstruct the exact graph, cutoffs, method, parameters, and report version.

### UAT-REV-005 — Sanitized review

Confirm a partner report contains no prohibited source or field.

### Quantitative targets

- 95% of factual claims traced within two interactions.
- 90% identify planted contrary evidence.
- 90% identify undisclosed derived output.
- 95% reconstruct the exact analysis version.
- Review time no more than 10% slower while defect detection improves by 20%.

## 7. Governance acceptance

- Purpose is required and visible.
- Restricted records do not leak through derived output.
- Correction identifies all downstream artifacts and prior recipients.
- Retention and review state are visible.
- Auditor reconstructs an exported conclusion.
- Administrator cannot silently browse analytical case content.

## 8. Accessibility acceptance

- Zero keyboard traps.
- Critical flows complete without pointer input.
- Screen-reader tutorial completion at least 85%.
- Every visual has equivalent text/table behavior.
- Color-vision simulation removes no required meaning.
- Reduced motion preserves comprehension.
- Generated reports pass structural accessibility review.

Manual tests include NVDA/Firefox and VoiceOver/Safari; JAWS is included when available.

## 9. Error-recovery acceptance

- 95% recover from an empty graph.
- 90% recover from a failed community job.
- No saved finding is lost during simulated interruption.
- 90% correctly distinguish valid partial graph data from unavailable analytics.
- Session expiry does not submit stale reports.

## 10. Automation-overreliance acceptance

In controlled misleading scenarios:

- enabling suggestions does not increase unsupported conclusions;
- 85% inspect evidence before accepting a high-impact suggestion;
- 80% reject a persuasive suggestion contradicted by stronger evidence;
- users calibrate confidence better when uncertainty is shown.

## 11. Customization acceptance

Users can:

- change layout, spacing, label density, grouping, edge routing, and annotations;
- switch comparison modes;
- save visualization presets separately from analyses;
- understand which changes affect analysis;
- restore recommended defaults;
- never remove mandatory evidence and uncertainty distinctions.

## 12. Test moderation protocol

- Do not coach unless the scenario explicitly permits help.
- Record completion, time, errors, help usage, evidence opens, resets, and abandonment.
- Capture user interpretation in their own words.
- Include ambiguous and misleading cases.
- Do not collect operational case data in generic usability telemetry.
- Record participant background and accessibility needs without sensitive case content.

## 13. Exit criteria

P0 cannot pass GATE-J or GATE-L until:

- critical qualitative failures are resolved;
- quantitative targets are met or formally revised with evidence;
- unsupported-conclusion rate does not worsen;
- keyboard and screen-reader workflows succeed; and
- the guided flow uses real system functionality rather than mocked outcomes.
