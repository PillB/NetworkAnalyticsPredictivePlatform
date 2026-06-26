# Guided Analysis Journey

Status: implementation contract for the P0 user experience

## 1. Synthetic case

**Case:** Harbor Lantern  
**Question:** Did the group associated with Northstar Imports change structure before the March 18 shipment?

The case includes mixed-quality sources, a possible alias, contradictory evidence, missing observations, a late record, a correction, a community split, a dormant/resurgent group, and known synthetic ground truth.

Target guided completion time: 20 minutes.

## 2. Application shell

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Case / Question / Event range / Known-at cutoff / Save / Help      │
├────────────┬───────────────────────────────────────┬────────────────┤
│ Workflow   │ Graph / Timeline / Map / Table        │ Inspector      │
│ steps      │                                       │ Evidence       │
│            │                                       │ Explanation    │
├────────────┴───────────────────────────────────────┴────────────────┤
│ Time / active filters / result count / undo / history / job state  │
└─────────────────────────────────────────────────────────────────────┘
```

The current question, event range, knowledge cutoff, active filters, version, and audit state remain visible.

## 3. Screen-by-screen novice flow

### Screen 1 — Landing

Primary actions:

- Continue recent case.
- Open a case.
- Start guided synthetic analysis.
- Create authorized case.

New users see the guided analysis as the primary action.

Plain-language message:

> This application helps you examine relationships and changes over time. It does not determine guilt.

### Screen 2 — Tutorial introduction

Explain:

- all data are fictional;
- the user will answer one question;
- connections do not prove wrongdoing;
- evidence and interpretation are different;
- actions can be undone;
- every option will include a reason and caution.

Show the seven-step outcome:

1. Understand the question.
2. Review evidence.
3. Compare periods.
4. Examine community change.
5. Test uncertainty and alternatives.
6. Save a finding.
7. Produce a report.

### Screen 3 — Purpose and scope

Pre-filled training values:

- Purpose: training investigation.
- Customer: Harbor task force.
- Permitted period: January 1–March 31.
- Handling: synthetic unrestricted.
- Retention: training session.

ELI5 explanation:

> Scope tells the application what you are allowed to examine and prevents unrelated information from being included.

Missing authorization blocks data access without leaking case metadata.

### Screen 4 — Question setup

Question:

> Did the group associated with Northstar Imports change structure before the March 18 shipment?

Suggested subquestions:

- Who was connected to Northstar Imports?
- Which relationships were active?
- Did groups split, merge, appear, disappear, or change membership?
- Which evidence supports those changes?
- Could missing data or an uncertain identity explain the result?

Smart defaults:

- Focus window: 30 days before March 18.
- Comparison: preceding 30 days.
- Known-at cutoff: March 18 at 23:59.
- Relations: communications, transfers, shared devices, employment, and shipment involvement.
- Hide unrelated isolates.
- Include uncertain evidence with a distinct visual treatment.

Each default has “Why this default?” and “Change it” actions.

### Screen 5 — Graph orientation

Initial graph:

- Northstar Imports centered.
- Directly connected entities.
- At most 25 visible nodes.
- Stable layout and fixed node size.
- Always-visible legend.

Coach marks:

- Shapes are entity types.
- Lines are reported or derived relationships.
- Color indicates type, not suspicion.
- Line and border styles indicate evidence class.
- Select anything to see why it is present.
- The graph reflects the selected known-at cutoff.

Task: open Northstar Imports.

### Screen 6 — Evidence inspector

Tabs:

- Summary.
- Relationships.
- Timeline.
- Evidence.
- Identity.
- Audit history.

Every assertion displays:

- plain-language statement;
- assertion class;
- event and knowledge times;
- source;
- reliability, credibility, and analytical confidence separately;
- restrictions;
- contradiction or supersession;
- original record reference; and
- transformation history.

ELI5 explanation:

> The graph stores claims from sources and how they were processed. It does not store one unquestionable truth.

Task: open evidence for one relationship.

### Screen 7 — Temporal comparison setup

Preset:

- Before: January 18–February 16.
- After: February 17–March 18.

Default: side-by-side with anchored positions.

Controls:

- event ranges;
- known-at cutoff;
- side-by-side, overlay, difference-only, or animation;
- relation types;
- evidence threshold;
- include/exclude uncertain identities.

ELI5 explanation:

> Event time asks when something happened. Known-at time asks when analysts could actually use the information.

### Screen 8 — Synchronized comparison

Both views share positions, zoom, pan, selection, legend, and filters.

Show:

- appeared later;
- no longer observed;
- corrected or changed;
- changed detected community;
- uncertain identity effect;
- source-coverage changes.

Do not call a relationship “ended” unless evidence establishes termination.

Task: inspect the highlighted change around Elena Voss.

### Screen 9 — Community evolution

Intro:

> A community is a pattern an algorithm found under selected rules. It may reflect communication, finance, shared resources, or collection patterns. It is not proof of an organization or crime.

Default analysis:

- independent Leiden/CPM snapshots;
- explicit lineage matching;
- communication and financial projection;
- “Balanced” resolution;
- repeated runs summarized;
- unstable memberships marked.

Show the possible split as a lineage:

```text
Northstar cluster A
       │
       ├── continuation: cluster A1
       └── possible split: cluster A2
```

Expose confidence, supporting changes, missing-source warning, sensitivity, and a competing interpretation.

### Screen 10 — “Why this split?”

Evidence package:

1. Observed membership and interaction changes.
2. Supporting source assertions.
3. Method reasoning in plain language.
4. Missing data and identity uncertainty.
5. Alternative explanations.
6. Counterfactual tests.

Example counterfactuals:

- Excluding the disputed alias lowers confidence.
- Excluding transfers retains the split.
- A longer time window changes the interpretation to gradual drift.

Actions:

- Test alternative.
- Pin evidence.
- Add note.
- Mark unresolved.
- Save preliminary finding.

### Screen 11 — Safe customization

Ask the user to change:

- disputed alias on/off;
- all relations versus communications only;
- 30-day versus 14-day window.

Before applying:

> This creates a new analysis version. Your previous result remains available.

After applying, show exactly which memberships, edges, confidence, and conclusions changed.

Actions:

- Keep version.
- Return.
- Compare versions.
- Reset to recommended.

### Screen 12 — Timeline, map, and table validation

Timeline displays events, intervals, evidence additions, lifecycle events, missing periods, corrections, and the shipment.

Map displays only meaningful spatial evidence, preserves uncertainty radius, and reports missing coordinates.

Table provides the evidence-first equivalent of the graph:

- subject;
- relationship;
- object;
- event time;
- known-at time;
- source;
- evidence class;
- confidence;
- community before/after;
- restrictions.

Selection remains synchronized across all views.

### Screen 13 — Preliminary finding

Structured fields:

- title and question;
- observation;
- supporting and contrary evidence;
- assumptions;
- method and version;
- confidence and limitations;
- alternatives;
- information gaps;
- suggested next lawful action;
- restrictions.

Required language:

> The observed network is consistent with a possible temporary split. Confidence is moderate and sensitive to an unresolved alias and a source-coverage gap.

Prohibited language:

> The system proved that the organization split into criminal cells.

### Screen 14 — Report preflight

Check:

- factual claims have sources;
- charts have both temporal cutoffs;
- model outputs are labeled;
- contrary evidence is included;
- confidence and assumptions are present;
- identity uncertainty is disclosed;
- restrictions and redactions are enforced;
- community wording is neutral;
- the report is reconstructable.

Blocking failures explain how to fix the problem.

### Screen 15 — Report builder

Default sections:

1. Question and scope.
2. Executive assessment.
3. Key evidence.
4. Temporal comparison.
5. Community change.
6. Uncertainty and alternatives.
7. Information gaps.
8. Recommended next actions.
9. Methodology.
10. Provenance appendix.
11. Audit/version metadata.

Users may reorder sections and add graph, timeline, map, or table views. The smart default is an internal report with provenance appendix.

### Screen 16 — Completion

Knowledge check:

- Community membership is not proof.
- Event time and known-at time differ.
- Missing observations are not negative evidence.
- The alias changes confidence.
- Contrary evidence belongs in the finding.
- The report can be reconstructed.

Offer replay of difficult steps and retain the synthetic analysis.

## 4. Expert, reviewer, and administrator journeys

### Expert analyst

- Define custom questions and projections.
- Use keyboard search, expansion, multi-select, and command palette.
- Compare multiple periods and methods.
- Save recipes and visualization presets separately.
- Inspect sensitivity and provenance.
- Submit versioned findings without novice interruptions.

### Reviewer

- Compare submitted versions.
- Jump from claims to supporting and contrary evidence.
- Reconstruct graph state and method.
- Inspect unresolved identities and derived outputs.
- Comment at claim, chart, evidence, or report level.
- Approve, reject, or request changes.

### Administrator/governance officer

- Configure roles, purposes, sources, fields, restrictions, retention, and review.
- Manage approved methods and presets.
- Inspect access, export, correction, and override events.
- Disable analytical versions.
- Trace affected outputs.
- Manage tutorial and competency policies.

Administrative controls remain separate from the investigation workspace.

## 5. State and recovery requirements

### Empty graph

Explain whether filters, access, time, source availability, or processing caused the empty state. Offer safe recovery actions.

### Loading

Name the stages:

1. Reconstructing history.
2. Applying authorization.
3. Retrieving provenance.
4. Detecting communities.
5. Matching lineage.
6. Preparing visualization.

Long jobs are cancellable and may continue in the background.

### Partial result

State which stages completed, which failed, what remains valid, and which outputs are unavailable.

### Error

Include:

- what failed;
- what remains safe;
- what was saved;
- recovery;
- reference ID; and
- expandable technical detail.

### Stale analysis

When evidence changes, show the affected assertions and allow inspection, historical retention, or rerun as a new version.

## 6. Usability acceptance

### Novice guided flow

- At least 90% complete without facilitator intervention.
- Median completion time is at most 20 minutes.
- At least 85% identify the principal observed change.
- At least 90% open supporting source evidence.
- At least 85% distinguish event time from known-at time.
- At least 90% avoid interpreting community membership as proof.
- At least 85% include contrary evidence.
- At least 90% recognize the uncertain alias.
- At least 85% test an alternative and return to defaults.
- At least 95% generate a reconstructable report.
- No critical privacy or dissemination error.

### Experienced analysts

Against an agreed baseline:

- at least 25% faster two-period comparison;
- at least 30% fewer community identity-tracking errors;
- at least 25% faster source access;
- no increase in unsupported conclusions;
- at least 90% reproduce saved analyses;
- at least 95% recover from an intentional parameter mistake;
- at least 50% less manual node repositioning.

### Reviewer

- At least 95% of sampled factual claims reach source evidence within two interactions.
- At least 90% identify planted contradictory evidence.
- At least 90% identify an undisclosed derived/model output.
- At least 95% reconstruct the exact graph and method version.

### Accessibility

- Zero keyboard traps.
- Critical journeys work without pointer input.
- Every visual output has an equivalent table/text view.
- Screen-reader tutorial completion reaches at least 85%.
- Color-vision simulation causes no loss of required meaning.

### Overreliance

- Suggestions do not increase unsupported conclusions.
- At least 85% inspect evidence before accepting high-impact suggestions.
- At least 80% reject a persuasive suggestion contradicted by stronger evidence.

## 7. UX risks

- Guidance may become a feature tour or teach one expected answer.
- Experts may be slowed by novice scaffolding.
- Too many warnings may create fatigue.
- Stable layouts may hide structural change.
- Defaults may be mistaken for authoritative policy.
- Customization may recreate misleading guilt-like visuals.
- Generated report language may be over-trusted.
- Graph accessibility may remain weaker than table-first analysis.
- Provenance may not meet interactive latency.
- Community change may reflect collection change rather than real organizational change.

The implementation must test ambiguous and misleading scenarios, not only the intended happy path.
