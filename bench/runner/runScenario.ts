import { chromium } from "playwright";
import { PREVIEW_URL, VIEWPORT, READY_TIMEOUT_MS } from "./browserConfig";
import { createCdpSession, startTracing, stopTracing, getHeapUsageMB } from "../metrics/cdpSession";
import type { Scenario, ScenarioContext, ScenarioMetrics, ScenarioRunResult } from "./types";
export type { ScenarioRunResult } from "./types";

export type RunOptions = {
  scenario: Scenario;
  rows: number;
  columns: number;
  seed?: number;
  variant?: "default" | "large-form";
};

/**
 * Wraps a scenario's page-interaction window with the full instrumentation
 * stack (CDP trace, FPS sampler, long-task observer, memory before/after) so
 * individual scenario files don't each hand-roll the same boilerplate.
 * Not every scenario needs every one of these — callers can ignore whichever
 * fields aren't relevant to what they're measuring.
 */
export async function withFullInstrumentation(
  ctx: ScenarioContext,
  action: () => Promise<void>,
): Promise<ScenarioMetrics> {
  await ctx.page.evaluate(() => {
    window.__bench__.fps.start();
    window.__bench__.longTask.start();
    window.__bench__.memory.before();
    window.__bench__.profiler.reset();
  });
  await startTracing(ctx.cdp);

  await action();

  const trace = await stopTracing(ctx.cdp);
  const inPage = await ctx.page.evaluate(() => {
    const fps = window.__bench__.fps.stop();
    const longTask = window.__bench__.longTask.stop();
    const memory = window.__bench__.memory.after();
    const react = window.__bench__.profiler.summarize();
    return { fps, longTask, memory, react };
  });
  const cdpHeapMB = await getHeapUsageMB(ctx.cdp);

  return { ...inPage, trace, cdpHeapMB };
}

export async function runScenario(opts: RunOptions): Promise<ScenarioRunResult> {
  const browser = await chromium.launch();
  const start = Date.now();
  try {
    const page = await browser.newPage({ viewport: VIEWPORT });
    const cdp = await createCdpSession(page);

    const url = new URL(PREVIEW_URL);
    url.searchParams.set("rows", String(opts.rows));
    url.searchParams.set("columns", String(opts.columns));
    url.searchParams.set("seed", String(opts.seed ?? 42));
    if (opts.variant) url.searchParams.set("variant", opts.variant);

    const navStart = Date.now();
    await page.goto(url.toString());
    await page.waitForFunction(() => window.__bench__?.ready === true, {
      timeout: READY_TIMEOUT_MS,
    });
    const mountToReadyMs = Date.now() - navStart;

    const ctx: ScenarioContext = { page, cdp, rows: opts.rows, columns: opts.columns };
    const metrics = await opts.scenario.run(ctx);

    return {
      scenarioId: opts.scenario.id,
      rows: opts.rows,
      columns: opts.columns,
      durationMs: Date.now() - start,
      mountToReadyMs,
      metrics,
    };
  } finally {
    await browser.close();
  }
}
