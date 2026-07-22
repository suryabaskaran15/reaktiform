import type { BenchReport } from "./schema";

const STATUS_ICON: Record<string, string> = { pass: "✅", warn: "⚠️", fail: "❌", "n/a": "—" };

function headline(result: BenchReport["results"][number]): string {
  const parts: string[] = [];
  if (result.scenarioId === "initial-render") parts.push(`${result.mountToReadyMs}ms to ready`);
  if (result.metrics.fps) parts.push(`${result.metrics.fps.fpsAvg} fps avg`);
  if (result.metrics.ux?.latencyMsP50 !== undefined) parts.push(`${result.metrics.ux.latencyMsP50}ms p50`);
  if (result.metrics.longTask) parts.push(`${result.metrics.longTask.longTaskCount} long tasks`);
  return parts.join(", ") || "—";
}

export function renderMarkdownReport(report: BenchReport): string {
  const lines: string[] = [];
  lines.push(`# reaktiform benchmark report`);
  lines.push("");
  lines.push(
    `**${report.meta.reaktiformVersion}** · \`${report.meta.commitSha}\` (${report.meta.branch}) · ${report.meta.timestamp}`,
  );
  lines.push("");
  lines.push("| Scenario | Rows | Cols | Status | Headline | Violations |");
  lines.push("|---|---|---|---|---|---|");
  for (const r of report.results) {
    const icon = STATUS_ICON[r.budget.status] ?? "—";
    const violations = r.budget.violations.length ? r.budget.violations.join("; ") : "—";
    lines.push(
      `| ${r.scenarioId} | ${r.rows.toLocaleString()} | ${r.columns} | ${icon} ${r.budget.status} | ${headline(r)} | ${violations} |`,
    );
  }
  lines.push("");
  const failing = report.results.filter((r) => r.budget.status === "fail");
  const warning = report.results.filter((r) => r.budget.status === "warn");
  if (failing.length) {
    lines.push(`**${failing.length} scenario(s) failing budget.**`);
  } else if (warning.length) {
    lines.push(`**${warning.length} scenario(s) at warning threshold, none failing.**`);
  } else {
    lines.push(`All scenarios within budget.`);
  }
  return lines.join("\n");
}
