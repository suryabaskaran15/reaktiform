// Bench-only React Profiler wrapper. This never touches src/ — it wraps
// <Reaktiform> from the outside, exactly as any consumer app could, so it
// exercises the library through its real public API, not an internal hook.
import React, { Profiler, type ProfilerOnRenderCallback } from "react";

export type ProfilerCommit = {
  id: string;
  phase: "mount" | "update" | "nested-update";
  actualDuration: number;
  baseDuration: number;
};

export type ProfilerResult = {
  commitCount: number;
  renderCount: number;
  commitDurationMsP50: number;
  commitDurationMsP95: number;
};

let commits: ProfilerCommit[] = [];

export function resetProfilerData(): void {
  commits = [];
}

export function getProfilerCommits(): ProfilerCommit[] {
  return commits;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] ?? 0;
}

export function summarizeProfilerData(): ProfilerResult {
  const durations = commits.map((c) => c.actualDuration).sort((a, b) => a - b);
  return {
    commitCount: commits.length,
    renderCount: commits.length, // one onRender call per component per commit
    commitDurationMsP50: Number(percentile(durations, 50).toFixed(2)),
    commitDurationMsP95: Number(percentile(durations, 95).toFixed(2)),
  };
}

const onRender: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
) => {
  commits.push({
    id,
    phase,
    actualDuration: Number(actualDuration.toFixed(3)),
    baseDuration: Number(baseDuration.toFixed(3)),
  });
};

export function BenchProfiler({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
}
