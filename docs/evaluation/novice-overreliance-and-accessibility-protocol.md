# Novice, Overreliance, and Assistive-Technology Evaluation Protocol

Version: 1.0  
Date: 2026-06-25  
Status: approved protocol; representative sessions not yet executed

## Purpose

This protocol evaluates whether a first-time analyst can complete one useful,
evidence-grounded temporal network analysis without mistaking associations,
communities, or review-priority values for guilt or predicted criminal conduct.
It also evaluates whether the critical journey remains operable with a screen
reader, keyboard-only input, and 200–400% zoom/reflow.

Automated Playwright checks are prerequisites, not substitutes for these
sessions.

## Participants

Minimum formative round:

- five novice participants with no graph-analysis product experience;
- three experienced intelligence or investigations analysts;
- two keyboard-only or screen-reader users, including at least one user of the
  deployment platform's supported screen reader/browser combination.

Participants must not receive operational case data. Harbor Lantern remains
synthetic and visibly labelled.

## Moderator boundaries

- Use the scripted prompts below.
- Do not explain graph terminology unless the participant requests help.
- Record each requested hint and the UI location that failed to answer it.
- Never coach a participant toward a specific person, community, or conclusion.
- Stop a task if the participant expresses that the tool proves guilt,
  dangerousness, or future offending; capture the triggering UI and conduct
  the correction interview before continuing.

## Core journey

1. State the permitted purpose and explain what data is in scope.
2. Identify what changed across the comparison boundary.
3. Open one relationship and identify its source, valid time, and known-at
   time.
4. Explain one corrected assertion without using future evidence in the earlier
   view.
5. Explain the possible community split and one plausible alternative.
6. Change one analytical assumption, distinguish it from a visual preference,
   and restore the smart default.
7. Review one evidence-priority item and explain what the value does and does
   not mean.
8. Mark a cautious finding, run preflight, and export the report.
9. Use the report to identify exact evidence dependencies and uncertainty.

## ELI5 comprehension questions

Ask without allowing the participant to reread warning text first:

1. “Does a line between two things prove wrongdoing? Why or why not?”
2. “What is the difference between when something happened and when the team
   learned it?”
3. “What could make the apparent group split disappear?”
4. “What does the review-priority value tell you?”
5. “Could a lower or abstained value mean the subject is safe or unimportant?”
6. “Which source would you check before sharing the finding?”

Score each answer:

- 2: correct and independently explained;
- 1: partly correct or correct after one neutral prompt;
- 0: incorrect, unsafe, or requires direct instruction.

No participant may score zero on questions 1, 4, or 5 at release.

## Overreliance challenge

Present three controlled variants in counterbalanced order:

- complete supporting and contrary evidence;
- one high-priority relationship with a source removed;
- an under-supported evidence gap where the system abstains.

Ask participants to select the next review action and explain why. Record:

- whether they follow the numeric order without checking provenance;
- whether abstention is interpreted as “low risk”;
- whether contrary evidence is opened before a finding is marked;
- whether they can override the order and document their reason;
- confidence before and after inspecting sources.

Release thresholds:

- at least 90% of participants correctly state that the value is not a
  probability or person-level risk score;
- zero participants interpret abstention as exculpatory evidence after the
  complete journey;
- at least 80% inspect provenance before accepting the highest-ranked item;
- experienced analysts report that override and rationale capture do not impede
  ordinary review.

## Accessibility sessions

Supported combinations must be named in the deployment profile. The baseline
evaluation includes:

- keyboard-only at 100%, 200%, and 400% browser zoom;
- screen reader with headings/landmarks, controls, tabs, dialog, status
  announcements, evidence table, and report preflight;
- CSS pixel-equivalent reflow at 320 pixels;
- high-contrast mode and reduced motion.

Critical assertions:

- skip navigation reaches the main analysis;
- visible focus is never lost or obscured;
- the seven guided steps, evidence rows, reasoning/options tabs, analytical
  controls, finding action, preflight, and export are reachable;
- graph information has an equivalent semantic table and change summary;
- opening and closing help restores focus;
- no two-dimensional page scrolling is required at 400% zoom, excluding
  bounded data tables that expose their own labelled scroll region;
- status changes are announced without moving focus unexpectedly.

Any blocker in the core journey fails Gate L.

## Quantitative measures

Capture per participant:

- task completion and safe completion;
- completion time;
- wrong turns;
- moderator hints;
- source/provenance inspections;
- unsafe interpretation events;
- analytical-versus-visual setting errors;
- report preflight failures and recovery;
- System Usability Scale;
- Single Ease Question per task;
- screen-reader or keyboard blocker severity.

The product target is not raw speed. A completion is “safe” only if the report
contains qualified language, exact dependencies, and uncertainty, and the
participant rejects guilt/risk interpretations.

## Black-box evidence package

For every session retain only consented, non-case-content evidence:

- participant cohort and accessibility configuration;
- build and fixture version;
- task outcomes and timings;
- scored comprehension answers;
- issue IDs with redacted observations;
- screenshots or recordings only when explicitly consented;
- remediation version and retest result.

Do not store identity-provider credentials, operational evidence, or free-form
case content in telemetry.

## Exit decision

The Reviewer records one result:

- Pass: all safety thresholds and critical accessibility assertions pass.
- Conditional: no unsafe blocker exists, but named usability defects require a
  scheduled remediation and retest.
- Fail: any critical journey blocker, guilt/risk misinterpretation after the
  journey, inaccessible evidence equivalent, or inability to reconstruct the
  report.

Until representative sessions pass, automated browser success must be reported
only as functional conformance evidence.
