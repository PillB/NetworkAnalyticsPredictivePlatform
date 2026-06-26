# Automated zoom and reflow accessibility evaluation

## Scope

`tests/browser/accessibility.e2e.mjs` provides repeatable Chromium evidence for the
zoom/reflow portion of the accessibility evaluation. It covers 200%, 300%, and
400% zoom equivalents and is intentionally separate from the broader guided
journey browser test.

The test uses the WCAG reflow equivalence method: a 1280 CSS-pixel desktop
baseline is reduced to the available CSS width at each zoom level.

| Zoom equivalent | Test viewport width | Test viewport height |
| --- | ---: | ---: |
| 200% | 640 CSS px | 900 CSS px |
| 300% | 427 CSS px | 900 CSS px |
| 400% | 320 CSS px | 900 CSS px |

This evaluates responsive reflow at the same effective content widths produced
by browser zoom. It does not claim to reproduce every browser's native zoom
rendering or replace manual testing with assistive technology.

## Automated assertions

At every width, the suite verifies:

1. The document and body do not exceed the viewport width initially, with the
   scope drawer and visualization controls expanded, after completing the
   guide, or after accessing the evidence table.
2. The skip link is the first keyboard stop and displays a visible focus
   outline.
3. Keyboard Tab navigation reaches the guided `Continue` control.
4. The complete seven-stage guide can be advanced using Enter without losing
   focus or hiding the active control outside the viewport.
5. The evidence table remains exposed as a semantic table with seven named
   column headers, explicit `scope="col"` attributes, and six rows.
6. A table row can receive visible keyboard focus and be activated with Enter
   to update the evidence inspector.
7. If the table is wider than its card, overflow remains confined to the
   intentional `.table-scroll` region instead of causing horizontal page
   scrolling.
8. No browser console errors or uncaught page errors occur.

## Running the evaluation

From the repository root:

```sh
node tests/browser/accessibility.e2e.mjs
```

The focused run writes reviewable, non-authoritative artifacts under
`test-results/playwright-accessibility/`:

- `reflow-200.png`
- `reflow-300.png`
- `reflow-400.png`
- `evidence.json`

The JSON file records the tested viewport, observed document width, and the
passing status of the overflow, keyboard journey, visible-focus, and semantic
table checks.

## Evidence and interpretation

The first focused run found that the expanded customization popover could cover
its own toggle at the 200% equivalent width, preventing a normal pointer click
from closing it. The popover anchor was corrected in `apps/web/styles.css` so it
opens below the complete control bar at reflow widths. The keyboard run also
found that the skip link used the browser's thinner default focus outline
because links were missing from the shared `:focus-visible` rule. Links now use
the same explicit 3px focus indicator as other controls. At 400%, the Relations
select also retained a 175px intrinsic width and produced 21px of page overflow;
control-bar selects are now constrained to their responsive label width. The
subsequent focused run passed all assertions at 640, 427, and 320 CSS pixels.

This is evidence for automated reflow and keyboard operability at the tested
widths. It is not a complete WCAG conformance assessment. Remaining manual
evaluation includes native browser zoom across supported browsers, screen
reader reading order and announcements, text-spacing overrides, high-contrast
and forced-colors behavior, target sizing, and representative user testing.
