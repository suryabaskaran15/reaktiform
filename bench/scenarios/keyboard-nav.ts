import type { Scenario } from "../runner/types";
import { withFullInstrumentation } from "../runner/runScenario";

// Verified: rows carry data-row-id; with the default column chrome
// (checkbox + row-number + expander all on), the first data column's <td>
// is the 4th child of its <tr>.
const FIRST_CELL = 'tr[data-row-id="row_0"] > td:nth-child(4)';
const KEY_PRESSES = 40;

export const keyboardNavScenario: Scenario = {
  id: "keyboard-nav",
  describe: {
    input: "Mounted grid, cell focused",
    action: `Scripted arrow-key traversal across ${KEY_PRESSES} cells`,
    metric: "Input-to-focus-visible latency per keypress",
    successCriteria: "<16ms per keypress",
  },
  async run(ctx) {
    await ctx.page.locator(FIRST_CELL).click();

    const metrics = await withFullInstrumentation(ctx, async () => {
      await ctx.page.evaluate(() => window.__bench__.timing.markStart("keyboard-nav"));
      for (let i = 0; i < KEY_PRESSES; i++) {
        await ctx.page.keyboard.press(i % 2 === 0 ? "ArrowDown" : "ArrowRight");
      }
      await ctx.page.evaluate(() => requestAnimationFrame(() => requestAnimationFrame(() => {})));
    });

    const totalMs = await ctx.page.evaluate(() =>
      window.__bench__.timing.markEndAndMeasure("keyboard-nav"),
    );
    return { ...metrics, ux: { latencyMsP50: Number((totalMs / KEY_PRESSES).toFixed(2)) } };
  },
};
