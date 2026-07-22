import type { Scenario } from "../runner/types";
import { withFullInstrumentation } from "../runner/runScenario";

// Real, verified selector: the column-visibility toggle button carries
// title="Show/hide columns" (Reaktiform.tsx) — opening it changes component
// state (colVisPanelOpen) with zero effect on row data, making it a clean
// "state change unrelated to visible data" probe.
//
// Deliberately a single open (not open-then-close): opening this panel
// mounts a click-outside-to-close backdrop, which then intercepts a second
// click aimed at the same button coordinates (confirmed via Playwright's
// actionability trace during Phase 0 validation — a real, reproducible DOM
// behavior, not a flaky test). A single state transition is sufficient to
// measure the re-render cost; forcing a second click through the backdrop
// would test backdrop-dismissal behavior, not the thing this scenario cares
// about.
export const reRenderScenario: Scenario = {
  id: "re-render",
  describe: {
    input: "Mounted grid + a state change unrelated to visible data",
    action: 'Open the "Show/hide columns" panel',
    metric: "React Profiler commit duration/count for the toggle",
    successCriteria:
      "Commit duration does not scale with total row count — targets Phase 2 findings 1.1-1.3, 2.1-2.2",
  },
  async run(ctx) {
    const button = ctx.page.locator('button[title="Show/hide columns"]');
    const metrics = await withFullInstrumentation(ctx, async () => {
      await button.click();
      await ctx.page.waitForTimeout(150);
    });
    return metrics;
  },
};
