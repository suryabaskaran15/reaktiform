import type { BenchReport } from "./schema";

const STATUS_COLOR: Record<string, string> = {
  pass: "#16a34a",
  warn: "#d97706",
  fail: "#dc2626",
  "n/a": "#6b7280",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

export function renderHtmlReport(report: BenchReport): string {
  const rows = report.results
    .map((r) => {
      const color = STATUS_COLOR[r.budget.status] ?? STATUS_COLOR["n/a"];
      const violations = r.budget.violations.length
        ? escapeHtml(r.budget.violations.join("; "))
        : "&mdash;";
      return `<tr>
        <td>${escapeHtml(r.scenarioId)}</td>
        <td>${r.rows.toLocaleString()}</td>
        <td>${r.columns}</td>
        <td><span class="badge" style="background:${color}">${r.budget.status}</span></td>
        <td>${r.metrics.fps ? `${r.metrics.fps.fpsAvg} fps avg / ${r.metrics.fps.fpsMin} min` : "&mdash;"}</td>
        <td>${r.metrics.longTask ? `${r.metrics.longTask.longTaskCount} (${r.metrics.longTask.longTaskTotalMs}ms)` : "&mdash;"}</td>
        <td>${r.metrics.react ? `${r.metrics.react.commitCount} commits, p95 ${r.metrics.react.commitDurationMsP95}ms` : "&mdash;"}</td>
        <td>${r.mountToReadyMs}ms</td>
        <td>${violations}</td>
      </tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>reaktiform benchmark report — ${escapeHtml(report.meta.commitSha)}</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; margin: 2rem; color: #111; background: #fff; }
  @media (prefers-color-scheme: dark) { body { color: #e5e7eb; background: #0b0f19; } }
  h1 { font-size: 1.25rem; }
  .meta { color: #6b7280; font-size: 0.85rem; margin-bottom: 1.5rem; }
  table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
  th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #e5e7eb; }
  @media (prefers-color-scheme: dark) { th, td { border-bottom: 1px solid #1f2937; } }
  th { font-weight: 600; }
  .badge { color: white; padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.75rem; text-transform: uppercase; }
</style>
</head>
<body>
  <h1>reaktiform benchmark report</h1>
  <div class="meta">
    v${escapeHtml(report.meta.reaktiformVersion)} &middot; ${escapeHtml(report.meta.commitSha)} (${escapeHtml(report.meta.branch)})
    &middot; ${escapeHtml(report.meta.timestamp)} &middot; seed ${report.meta.seed} &middot; node ${escapeHtml(report.meta.node)}
  </div>
  <table>
    <thead>
      <tr>
        <th>Scenario</th><th>Rows</th><th>Cols</th><th>Status</th>
        <th>FPS</th><th>Long tasks</th><th>React</th><th>Mount→Ready</th><th>Violations</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
</body>
</html>`;
}
