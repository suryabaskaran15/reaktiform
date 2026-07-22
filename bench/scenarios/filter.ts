import type { Scenario } from "../runner/types";
import { withFullInstrumentation } from "../runner/runScenario";

// Verified against FilterPanel's actual JSX: the text-filter input has
// autoFocus (so no extra click-to-focus step is needed once the panel
// opens), and Enter commits via handleApply() (onKeyDown checks e.key ===
// "Enter"). The "Add filter" button's title attribute is confirmed in
// ColumnHeader's bottom-row controls.
const COLUMN_LABEL = "Text 0";

// ⚠️ Same known measurement caveat as cell-edit.ts: the typed characters'
// `delay` (45ms total for 3 chars) is included in the markStart/markEnd
// latency window below, not isolated out. Not fixed in Phase 0 — flagged.

export const filterScenario: Scenario = {
  id: "filter",
  describe: {
    input: "Mounted grid, filterable text column",
    action: "Scripted character-by-character filter input, then Enter to apply",
    metric: "Filter-apply-to-visible-result latency",
    successCriteria: "<100ms",
  },
  async run(ctx) {
    const header = ctx.page.locator("th", { hasText: COLUMN_LABEL });
    await header.hover();
    await header.locator('button[title="Add filter"]').click();

    const metrics = await withFullInstrumentation(ctx, async () => {
      await ctx.page.evaluate(() => window.__bench__.timing.markStart("filter"));
      await ctx.page.keyboard.type("row", { delay: 15 });
      await ctx.page.keyboard.press("Enter");
      await ctx.page.evaluate(() => requestAnimationFrame(() => requestAnimationFrame(() => {})));
    });

    const totalMs = await ctx.page.evaluate(() => window.__bench__.timing.markEndAndMeasure("filter"));
    return { ...metrics, ux: { latencyMsP50: totalMs, latencyMsMax: totalMs } };
  },
};
