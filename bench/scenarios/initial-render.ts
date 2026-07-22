import type { Scenario } from "../runner/types";

// Trivial by design: the interesting number ("time from navigation start to
// window.__bench__.ready") is captured once, generically, by runScenario.ts
// for every scenario run — see its `mountToReadyMs` field. This scenario
// exists mainly to give "initial render" its own row in the report, and as
// a place to attach React-Profiler mount-phase data specifically.
export const initialRenderScenario: Scenario = {
  id: "initial-render",
  describe: {
    input: "Dataset at each preset size, default columns",
    action: "Cold-navigate and wait for window.__bench__.ready (mounted + painted)",
    metric: "Time from navigation start to ready (mountToReadyMs, captured by the runner)",
    successCriteria:
      "<100ms, and flat across 1k/10k/100k/1M rows (virtualization-bound, not dataset-size-bound)",
  },
  async run(ctx) {
    const react = await ctx.page.evaluate(() => window.__bench__.profiler.summarize());
    return { react };
  },
};
