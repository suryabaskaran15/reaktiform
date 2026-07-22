import type { Scenario } from "../runner/types";
import { withFullInstrumentation } from "../runner/runScenario";

const SCROLL_CONTAINER = "[data-reaktiform] .overflow-y-auto";
const JUMP_PX = 5000;
const JUMP_COUNT = 8;
const PAUSE_BETWEEN_JUMPS_MS = 120;

export const scrollFastScenario: Scenario = {
  id: "scroll-fast",
  describe: {
    input: "Mounted grid, each dataset size",
    action: `Scripted large-jump scrolls (${JUMP_PX}px increments × ${JUMP_COUNT}, simulating a fling)`,
    metric: "FPS, dropped-frame %, visible blank-row-gap duration after a jump",
    successCriteria:
      "No more than N frames of visible blank/skeleton state; FPS recovers to ≥60 within a bounded time after the jump settles",
  },
  async run(ctx) {
    const metrics = await withFullInstrumentation(ctx, async () => {
      for (let i = 0; i < JUMP_COUNT; i++) {
        await ctx.page.evaluate(
          ({ selector, jumpPx }) => {
            const el = document.querySelector(selector) as HTMLElement | null;
            if (!el) return;
            el.scrollTop = Math.min(el.scrollHeight, el.scrollTop + jumpPx);
          },
          { selector: SCROLL_CONTAINER, jumpPx: JUMP_PX },
        );
        await ctx.page.waitForTimeout(PAUSE_BETWEEN_JUMPS_MS);
      }
    });
    return metrics;
  },
};
