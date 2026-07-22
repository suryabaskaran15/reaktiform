// In-page Long Task observer — native PerformanceObserver, directly matches
// Chrome's own >50ms "long task" definition. No dependency, CI-friendly.
export type LongTaskResult = {
  longTaskCount: number;
  longTaskTotalMs: number;
  longestTaskMs: number;
};

let observer: PerformanceObserver | null = null;
let tasks: number[] = [];

export function startLongTaskObserving(): void {
  tasks = [];
  if (typeof PerformanceObserver === "undefined") return;
  try {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        tasks.push(entry.duration);
      }
    });
    observer.observe({ entryTypes: ["longtask"] });
  } catch {
    // longtask entryType unsupported in this browser — leave tasks empty
    // rather than throwing, so the rest of the metrics pipeline still runs.
    observer = null;
  }
}

export function stopLongTaskObserving(): LongTaskResult {
  observer?.disconnect();
  observer = null;
  return {
    longTaskCount: tasks.length,
    longTaskTotalMs: Number(tasks.reduce((a, b) => a + b, 0).toFixed(1)),
    longestTaskMs: tasks.length ? Number(Math.max(...tasks).toFixed(1)) : 0,
  };
}
