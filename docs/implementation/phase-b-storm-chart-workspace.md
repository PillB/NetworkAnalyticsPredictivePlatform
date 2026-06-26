# Phase B STORM Synthesis — i2-Class Chart Workspace

Date: June 25, 2026  
Status: first executable Phase B slice implemented

## Research-style perspectives

### Analyst workflow perspective

An i2-class chart workspace must support fast search, visible expansion, path exploration, annotations, and recoverable layout work. Analysts need to ask “what is connected to this?” without losing the source/evidence context or accidentally turning exploratory notes into facts.

### Architecture perspective

Chart authoring has three separate state classes:

- evidence assertions: provenance-backed records from the authorized projection;
- analytical versions: model/filter/temporal decisions that affect outputs;
- visualization workspace state: pins, notes, saved layouts, search state, and visual paths.

Only the first two can affect reports as evidence or analytical assumptions. Workspace state is reversible and non-evidentiary unless explicitly exported as analyst commentary.

### Reviewer/safety perspective

The workspace must avoid visual overclaiming. Pinning, expansion, path display, and annotations do not determine guilt or criminality. Every visual action needs a semantic equivalent so keyboard and assistive-technology users can complete the same workflow.

## Implemented slice

- Search over visible authorized graph nodes and relationships.
- Pin search results into a workspace.
- Expand neighbors around the selected relationship.
- Find a shortest visible path between pinned/selected entities.
- Explain visible paths with exact relationship dependencies, source labels, event time, known-at time, confidence, and caveats.
- Add analyst annotations distinct from evidence.
- Save and restore graph layouts separately from analysis versions.
- Undo and redo workspace authoring actions for pins, expansion, paths, notes, and saved-layout metadata.
- Render semantic rows for workspace entities, notes, and saved layouts.
- Test the workflow in unit tests and GitHub Pages browser tests.

## Done conditions covered

- Unit tests cover search, pin, expand, path, path explanation, annotation, saved layout state, and workspace undo/redo.
- Browser test covers search, pin, expand, path, path dependency display, annotation, workspace undo/redo, save layout, restore layout, and final report preflight.
- Static test verifies chart controls and safety language.

## Retrospective

What could make this wrong:

- The current slice is still local and synthetic; it does not yet import analyst-created evidence assertions.
- Path finding is shortest visible path only, not strongest/evidentially weighted path; the explanation now makes this limitation visible through exact edge dependencies.
- Saved layouts are in session state only, not persisted to report manifests or user presets.
- Annotations are not yet exported in the report; this is intentional until annotation provenance and review semantics are defined.

Next iteration:

- Add CSV/JSON import and field mapping for financial transactions.
- Add weighted/evidence-aware path ranking with temporal validity filters.
- Add persisted visualization presets after report/export semantics are defined.
