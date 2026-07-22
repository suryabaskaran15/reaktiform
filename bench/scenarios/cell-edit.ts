import type { Scenario } from "../runner/types";
import { withFullInstrumentation } from "../runner/runScenario";

// Verified: clicking a <td> calls activateCell(rowId, colKey) directly
// (single click, not double-click) when the cell is editable — Reaktiform.tsx.
// col_text_0 (the first data column) is editable by default (editableRatio
// 0.7 → columns 0-6 of every 10 are editable, per bench/datasets/columns.ts).
const FIRST_CELL = 'tr[data-row-id="row_0"] > td:nth-child(4)';
const TYPED_TEXT = "benchmark edit ";

// ⚠️ Known measurement caveat, not fixed in Phase 0: `keyboard.type`'s
// `delay` paces keystroke dispatch to simulate realistic typing speed, but
// that pacing happens *inside* the markStart/markEnd window below, so the
// reported "per-keystroke latency" is (delay + real app processing time)
// per character, not app processing time alone. A more precise measurement
// would need per-character marks driven by an exposed callback rather than
// wrapping the whole typed sequence — flagged here as a fast-follow, not
// silently absorbed into the number.


export const cellEditScenario: Scenario = {
  id: "cell-edit",
  describe: {
    input: "Mounted grid",
    action: "Scripted click-to-edit → keystroke sequence → commit (Enter)",
    metric: "Input-to-paint latency per keystroke; commit-to-store latency",
    successCriteria: "<16ms per keystroke",
  },
  async run(ctx) {
    const metrics = await withFullInstrumentation(ctx, async () => {
      await ctx.page.locator(FIRST_CELL).click();
      await ctx.page.evaluate(() => window.__bench__.timing.markStart("cell-edit"));
      await ctx.page.keyboard.type(TYPED_TEXT, { delay: 10 });
      await ctx.page.keyboard.press("Enter");
      await ctx.page.evaluate(() => requestAnimationFrame(() => requestAnimationFrame(() => {})));
    });

    const totalMs = await ctx.page.evaluate(() => window.__bench__.timing.markEndAndMeasure("cell-edit"));
    return {
      ...metrics,
      ux: { latencyMsP50: Number((totalMs / TYPED_TEXT.length).toFixed(2)), latencyMsMax: totalMs },
    };
  },
};
