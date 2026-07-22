// Thin wrapper around the standard User Timing API (performance.mark /
// performance.measure) — used for input/scroll/edit latency measurements.
export function markStart(name: string): void {
  performance.mark(`${name}-start`);
}

export function markEndAndMeasure(name: string): number {
  performance.mark(`${name}-end`);
  const measure = performance.measure(name, `${name}-start`, `${name}-end`);
  return Number(measure.duration.toFixed(2));
}

export function clearMarks(name: string): void {
  performance.clearMarks(`${name}-start`);
  performance.clearMarks(`${name}-end`);
  performance.clearMeasures(name);
}
