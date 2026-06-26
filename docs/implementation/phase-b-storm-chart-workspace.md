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
- Add analyst annotations distinct from evidence.
- Save and restore graph layouts separately from analysis versions.
- Render semantic rows for workspace entities, notes, and saved layouts.
- Test the workflow in unit tests and GitHub Pages browser tests.

## Done conditions covered

- Unit tests cover search, pin, expand, path, annotation, and saved layout state.
- Browser test covers search, pin, expand, path, annotation, save layout, restore layout, and final report preflight.
- Static test verifies chart controls and safety language.

## Retrospective

What could make this wrong:

- The current slice is still local and synthetic; it does not yet import analyst-created evidence assertions.
- Path finding is shortest visible path only, not strongest/evidentially weighted path.
- Saved layouts are in session state only, not persisted to report manifests or user presets.
- Annotations are not yet exported in the report; this is intentional until annotation provenance and review semantics are defined.

Next iteration:

- Add explicit chart-edit reducer with undo/redo for annotations and pins.
- Add CSV/JSON import and field mapping for financial transactions.
- Add path explanation with edge evidence dependencies and temporal validity.
- Add persisted visualization presets after report/export semantics are defined.
