// In-page FPS sampler — rAF-based, portable and scriptable (no Chrome-trace
// parsing required for this metric). Runs entirely inside the browser page;
// the Node-side runner starts/stops it via page.evaluate().
export type FpsResult = {
  fpsAvg: number;
  fpsMin: number;
  droppedFramePct: number;
  frameCount: number;
};

let running = false;
let frameTimes: number[] = [];
let rafHandle = 0;

export function startFpsSampling(): void {
  running = true;
  frameTimes = [];
  let last = performance.now();
  const tick = (now: number) => {
    if (!running) return;
    frameTimes.push(now - last);
    last = now;
    rafHandle = requestAnimationFrame(tick);
  };
  rafHandle = requestAnimationFrame(tick);
}

export function stopFpsSampling(): FpsResult {
  running = false;
  cancelAnimationFrame(rafHandle);
  if (frameTimes.length === 0) {
    return { fpsAvg: 0, fpsMin: 0, droppedFramePct: 0, frameCount: 0 };
  }
  // Drop the first sample — it's the delta from sampler-start, not a real frame.
  const deltas = frameTimes.slice(1);
  const fpsSamples = deltas.map((d) => (d > 0 ? 1000 / d : 0));
  const fpsAvg = fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length;
  const fpsMin = Math.min(...fpsSamples);
  const droppedFrames = deltas.filter((d) => d > 16.67 * 1.5).length; // >~25ms
  const droppedFramePct = (droppedFrames / deltas.length) * 100;
  return {
    fpsAvg: Number(fpsAvg.toFixed(1)),
    fpsMin: Number(fpsMin.toFixed(1)),
    droppedFramePct: Number(droppedFramePct.toFixed(2)),
    frameCount: deltas.length,
  };
}
