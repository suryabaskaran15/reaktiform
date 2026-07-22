import type { Scenario } from "../runner/types";
import { withFullInstrumentation } from "../runner/runScenario";

// Verified: the header checkbox (th, first column when showSelectColumn is
// on) calls grid.toggleSelectAll(selectableIds) — Reaktiform.tsx.
const HEADER_CHECKBOX = "thead input[type=\"checkbox\"]";

export const multiSelectionScenario: Scenario = {
  id: "multi-selection",
  describe: {
    input: "Mounted grid",
    action: '"Select all" via the header checkbox, then deselect all',
    metric: "Commit duration; time to fully reflect selection",
    successCriteria: "Bounded by visible-row count, not total dataset size",
  },
  async run(ctx) {
    const checkbox = ctx.page.locator(HEADER_CHECKBOX);
    const metrics = await withFullInstrumentation(ctx, async () => {
      await checkbox.click(); // select all
      await ctx.page.waitForTimeout(100);
      await checkbox.click(); // deselect all
    });
    return metrics;
  },
};
