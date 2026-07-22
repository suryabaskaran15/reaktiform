import type { Scenario } from "../runner/types";
import { withFullInstrumentation } from "../runner/runScenario";

// Verified selector: scrollRef is attached to the div with
// "overflow-x-auto overflow-y-auto" classes (Reaktiform.tsx), the direct
// parent of <table> — this is the actual TanStack Virtual scroll container.
const SCROLL_CONTAINER = "[data-reaktiform] .overflow-y-auto";
const SCROLL_DURATION_MS = 3000;

export const scrollContinuousScenario: Scenario = {
  id: "scroll-continuous",
  describe: {
    input: "Mounted grid, each dataset size",
    action: `Scripted smooth scroll top→bottom over ${SCROLL_DURATION_MS}ms`,
    metric: "FPS (rAF sampler), dropped-frame %, Scripting time (CDP trace)",
    successCriteria: "≥60fps sustained, <5% dropped frames",
  },
  async run(ctx) {
    const metrics = await withFullInstrumentation(ctx, async () => {
      // NOTE: deliberately no named `function` declarations inside this
      // evaluate callback — esbuild (via tsx's transform) injects a
      // `__name(fn, "fn")` helper-preservation call for named functions,
      // which Playwright's page.evaluate then fails to resolve (the helper
      // only exists in the original Node module scope, not in the isolated
      // page context the function string is re-evaluated in). A plain
      // while-loop with anonymous arrow functions avoids triggering it.
      await ctx.page.evaluate(
        async ({ selector, durationMs }) => {
          const el = document.querySelector(selector) as HTMLElement | null;
          if (!el) return;
          const maxScroll = el.scrollHeight - el.clientHeight;
          const start = performance.now();
          let progress = 0;
          while (progress < 1) {
            const now = await new Promise<number>((r) => requestAnimationFrame(r));
            progress = Math.min(1, (now - start) / durationMs);
            el.scrollTop = progress * maxScroll;
          }
        },
        { selector: SCROLL_CONTAINER, durationMs: SCROLL_DURATION_MS },
      );
    });
    return metrics;
  },
};
