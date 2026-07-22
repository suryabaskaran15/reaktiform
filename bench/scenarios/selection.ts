import type { Scenario } from "../runner/types";
import { withFullInstrumentation } from "../runner/runScenario";

// Kept within the default viewport+overscan render window (maxHeight=600,
// ROW_HEIGHT=46 → ~13 visible + 5 overscan ≈ 18 rows) so every target row
// actually exists in the DOM without needing extra scroll choreography.
const ROWS_TO_TOGGLE = 12;

export const selectionScenario: Scenario = {
  id: "selection",
  describe: {
    input: "Mounted grid",
    action: `Scripted single-row checkbox toggles across ${ROWS_TO_TOGGLE} rows`,
    metric: "Commit duration; render count of uninvolved rows",
    successCriteria:
      "Commit duration flat regardless of total/visible row count; ideally zero re-render of rows not toggled (post-Phase 3)",
  },
  async run(ctx) {
    const metrics = await withFullInstrumentation(ctx, async () => {
      for (let i = 0; i < ROWS_TO_TOGGLE; i++) {
        // Scoped to the first <td> specifically: the dataset generator
        // cycles a "checkbox" *data* column too (col_checkbox_6), so an
        // unscoped `input[type="checkbox"]` match is ambiguous — the row
        // *selection* checkbox is always the first cell (chrome column),
        // per the fixed checkbox→row-number→expander→data-cols DOM order.
        await ctx.page
          .locator(`tr[data-row-id="row_${i}"] > td:nth-child(1) input[type="checkbox"]`)
          .click();
      }
    });
    return metrics;
  },
};
