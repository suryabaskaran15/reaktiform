// Node-side Chrome DevTools Protocol helper, via Playwright's CDP session.
// This is the one metrics collector that runs OUTSIDE the page (in Node),
// because Layout/Paint/Composite/Scripting breakdown and native heap-size
// reads require browser-internal instrumentation no in-page JS API exposes.
//
// Simplification flagged for this Phase 0 pass: full V8 heap-snapshot
// parsing (for exact detached-DOM-node counts) is NOT implemented here —
// it's a large, complex streamed format (nodes/edges/strings arrays) that
// would be substantial work to parse correctly. Instead, `getHeapUsage`
// uses CDP's much simpler `Runtime.getHeapUsage`, which is sufficient to
// cross-check the in-page `performance.memory` reading (memorySampler.ts).
// Detached-node detection via full heap snapshots is a documented fast-follow,
// not silently dropped.
import type { CDPSession, Page } from "playwright";

export type TraceSummary = {
  scriptingMs: number;
  layoutMs: number;
  paintMs: number;
  compositeMs: number;
  recalcStyleMs: number;
};

const SCRIPTING_EVENTS = new Set(["FunctionCall", "EvaluateScript", "TimerFire", "V8.Execute"]);
const LAYOUT_EVENTS = new Set(["Layout", "UpdateLayoutTree"]);
const PAINT_EVENTS = new Set(["Paint", "PaintImage"]);
const COMPOSITE_EVENTS = new Set(["CompositeLayers"]);
const RECALC_STYLE_EVENTS = new Set(["RecalculateStyles"]);

type RawTraceEvent = {
  name: string;
  ph: string; // phase: 'X' complete, 'B' begin, 'E' end
  dur?: number;
  ts: number;
  pid: number;
  tid: number;
};

// Playwright types Tracing.dataCollected's `value` as a generic
// `{[key: string]: string}[]` (the CDP protocol itself doesn't strictly
// type trace-event fields), not our RawTraceEvent shape — normalize
// defensively rather than fighting Playwright's conservative typing.
type RawTraceEventPayload = { value: Record<string, string>[] };

function normalizeEvent(raw: Record<string, string>): RawTraceEvent | null {
  if (typeof raw.name !== "string" || typeof raw.ph !== "string") return null;
  return {
    name: raw.name,
    ph: raw.ph,
    // exactOptionalPropertyTypes: only include `dur` when actually present,
    // rather than assigning an explicit `undefined`.
    ...(raw.dur !== undefined && { dur: Number(raw.dur) }),
    ts: Number(raw.ts),
    pid: Number(raw.pid),
    tid: Number(raw.tid),
  };
}

let collectedEvents: RawTraceEvent[] = [];
let dataListener: ((params: RawTraceEventPayload) => void) | null = null;

export async function startTracing(cdp: CDPSession): Promise<void> {
  collectedEvents = [];
  dataListener = (params) => {
    for (const raw of params.value) {
      const normalized = normalizeEvent(raw);
      if (normalized) collectedEvents.push(normalized);
    }
  };
  cdp.on("Tracing.dataCollected", dataListener);
  await cdp.send("Tracing.start", {
    categories: [
      "devtools.timeline",
      "disabled-by-default-devtools.timeline",
      "blink.user_timing",
    ].join(","),
    options: "sampling-frequency=1000",
  });
}

export async function stopTracing(cdp: CDPSession): Promise<TraceSummary> {
  const complete = new Promise<void>((resolve) => {
    cdp.once("Tracing.tracingComplete", () => resolve());
  });
  await cdp.send("Tracing.end");
  await complete;
  if (dataListener) cdp.off("Tracing.dataCollected", dataListener);

  return summarizeTrace(collectedEvents);
}

function summarizeTrace(events: RawTraceEvent[]): TraceSummary {
  const totals = { scriptingMs: 0, layoutMs: 0, paintMs: 0, compositeMs: 0, recalcStyleMs: 0 };
  // Pass 1: complete ('X') events carry their own duration directly.
  const openBeginEvents = new Map<string, RawTraceEvent>();
  for (const e of events) {
    const bucket = bucketFor(e.name);
    if (!bucket) continue;
    if (e.ph === "X" && typeof e.dur === "number") {
      totals[bucket] += e.dur / 1000; // CDP durations are in microseconds
    } else if (e.ph === "B") {
      openBeginEvents.set(`${e.name}:${e.pid}:${e.tid}`, e);
    } else if (e.ph === "E") {
      const key = `${e.name}:${e.pid}:${e.tid}`;
      const begin = openBeginEvents.get(key);
      if (begin) {
        totals[bucket] += (e.ts - begin.ts) / 1000;
        openBeginEvents.delete(key);
      }
    }
  }
  for (const key of Object.keys(totals) as (keyof TraceSummary)[]) {
    totals[key] = Number(totals[key].toFixed(2));
  }
  return totals;
}

function bucketFor(name: string): keyof TraceSummary | null {
  if (SCRIPTING_EVENTS.has(name)) return "scriptingMs";
  if (LAYOUT_EVENTS.has(name)) return "layoutMs";
  if (PAINT_EVENTS.has(name)) return "paintMs";
  if (COMPOSITE_EVENTS.has(name)) return "compositeMs";
  if (RECALC_STYLE_EVENTS.has(name)) return "recalcStyleMs";
  return null;
}

export async function getHeapUsageMB(cdp: CDPSession): Promise<number> {
  await cdp.send("Runtime.enable");
  const result = (await cdp.send("Runtime.getHeapUsage")) as {
    usedSize: number;
    totalSize: number;
  };
  return Number((result.usedSize / (1024 * 1024)).toFixed(2));
}

export async function createCdpSession(page: Page): Promise<CDPSession> {
  return page.context().newCDPSession(page);
}
