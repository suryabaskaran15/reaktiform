import type { Scenario } from "../runner/types";
import { withFullInstrumentation } from "../runner/runScenario";

// Verified: the sortable column-label div has onClick={onSort} (Reaktiform.tsx
// ColumnHeader) — clicking the label text (which bubbles to that div) sorts.
// "Text 0" is col_text_0's generated label (bench/datasets/columns.ts).
const COLUMN_LABEL = "Text 0";

export const sortScenario: Scenario = {
  id: "sort",
  describe: {
    input: "Mounted grid",
    action: "Scripted header click, asc→desc toggle",
    metric: "Sort-click-to-reordered-rows-visible latency",
    successCriteria: "<150ms",
  },
  async run(ctx) {
    const header = ctx.page.locator("thead").getByText(COLUMN_LABEL, { exact: true });
    let totalMs = 0;
    const metrics = await withFullInstrumentation(ctx, async () => {
      await ctx.page.evaluate(() => window.__bench__.timing.markStart("sort"));
      await header.click(); // asc
      await ctx.page.waitForTimeout(50);
      totalMs += await ctx.page.evaluate(() =>
        window.__bench__.timing.markEndAndMeasure("sort"),
      );

      await ctx.page.evaluate(() => window.__bench__.timing.markStart("sort"));
      await header.click(); // desc
      await ctx.page.waitForTimeout(50);
      totalMs += await ctx.page.evaluate(() =>
        window.__bench__.timing.markEndAndMeasure("sort"),
      );
    });
    return { ...metrics, ux: { latencyMsP50: Number((totalMs / 2).toFixed(2)), latencyMsMax: totalMs } };
  },
};
