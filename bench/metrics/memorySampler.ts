// In-page heap sampler via performance.memory (non-standard but supported by
// the Chromium builds Playwright ships). Optional-chained throughout since
// this API doesn't exist in every browser context — degrades to nulls
// rather than throwing.
export type MemorySample = { heapMB: number | null };
export type MemoryDelta = {
  heapBeforeMB: number | null;
  heapAfterMB: number | null;
  heapDeltaMB: number | null;
};

type ChromeMemory = { usedJSHeapSize: number };
function readHeapMB(): number | null {
  const mem = (performance as unknown as { memory?: ChromeMemory }).memory;
  if (!mem) return null;
  return Number((mem.usedJSHeapSize / (1024 * 1024)).toFixed(2));
}

let before: number | null = null;

export function sampleMemoryBefore(): void {
  before = readHeapMB();
}

export function sampleMemoryAfter(): MemoryDelta {
  const after = readHeapMB();
  return {
    heapBeforeMB: before,
    heapAfterMB: after,
    heapDeltaMB: before !== null && after !== null ? Number((after - before).toFixed(2)) : null,
  };
}
