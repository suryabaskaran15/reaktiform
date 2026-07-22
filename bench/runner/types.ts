import type { Page, CDPSession } from "playwright";

export type ScenarioContext = {
  page: Page;
  cdp: CDPSession;
  rows: number;
  columns: number;
};

export type ScenarioMetrics = {
  react?: {
    commitCount: number;
    renderCount: number;
    commitDurationMsP50: number;
    commitDurationMsP95: number;
  };
  fps?: { fpsAvg: number; fpsMin: number; droppedFramePct: number };
  longTask?: { longTaskCount: number; longTaskTotalMs: number; longestTaskMs: number };
  trace?: {
    scriptingMs: number;
    layoutMs: number;
    paintMs: number;
    compositeMs: number;
    recalcStyleMs: number;
  };
  memory?: { heapBeforeMB: number | null; heapAfterMB: number | null; heapDeltaMB: number | null };
  cdpHeapMB?: number;
  ux?: { latencyMsP50?: number; latencyMsMax?: number };
};

export type ScenarioDescriptor = {
  input: string;
  action: string;
  metric: string;
  successCriteria: string;
};

export type Scenario = {
  id: string;
  describe: ScenarioDescriptor;
  run: (ctx: ScenarioContext) => Promise<ScenarioMetrics>;
};

export type ScenarioRunResult = {
  scenarioId: string;
  rows: number;
  columns: number;
  durationMs: number;
  /**
   * Time from navigation start to `window.__bench__.ready` (mounted +
   * painted). Captured for every scenario run, not just "initial render" —
   * it's useful context everywhere, and it's what makes the initial-render
   * scenario itself trivial (see bench/scenarios/initial-render.ts): the
   * interesting number is produced here, once, for all scenarios.
   */
  mountToReadyMs: number;
  metrics: ScenarioMetrics;
};
