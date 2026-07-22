import type { ScenarioRunResult } from "../runner/types";
import budgetsJson from "./budgets.json";

export type Budget = {
  target: number;
  warn: number;
  fail: number;
  direction?: string; // compared by value ("higher-is-better") in checkThreshold below —
  // kept as `string` rather than a literal type because budgets.json is a
  // plain JSON import, which TypeScript widens to `string`, not the literal.
  source: string;
};

export type Budgets = Record<string, Budget>;
export const budgets: Budgets = budgetsJson;

export type BudgetStatus = "pass" | "warn" | "fail" | "n/a";

export type ScenarioReportEntry = ScenarioRunResult & {
  budget: { status: BudgetStatus; violations: string[] };
};

export type BenchReport = {
  meta: {
    reaktiformVersion: string;
    commitSha: string;
    branch: string;
    timestamp: string;
    seed: number;
    node: string;
  };
  results: ScenarioReportEntry[];
};

function checkThreshold(
  value: number,
  budget: Budget,
  higherIsBetter: boolean,
): { status: BudgetStatus; violation?: string } {
  if (higherIsBetter) {
    if (value < budget.fail) return { status: "fail", violation: `${value} below fail threshold ${budget.fail}` };
    if (value < budget.warn) return { status: "warn", violation: `${value} below warn threshold ${budget.warn}` };
    return { status: "pass" };
  }
  if (value > budget.fail) return { status: "fail", violation: `${value}ms exceeds fail threshold ${budget.fail}ms` };
  if (value > budget.warn) return { status: "warn", violation: `${value}ms exceeds warn threshold ${budget.warn}ms` };
  return { status: "pass" };
}

const SCENARIO_BUDGET_KEY: Record<string, string> = {
  "initial-render": "initialRenderMs",
  "scroll-continuous": "scrollFpsAvg",
  "scroll-fast": "scrollFpsAvg",
  "cell-edit": "cellUpdateMs",
  filter: "filterMs",
  sort: "sortMs",
  "keyboard-nav": "keyboardLatencyMs",
};

function primaryMetricFor(result: ScenarioRunResult): number | undefined {
  switch (result.scenarioId) {
    case "initial-render":
      return result.mountToReadyMs;
    case "scroll-continuous":
    case "scroll-fast":
      return result.metrics.fps?.fpsAvg;
    case "cell-edit":
    case "filter":
    case "sort":
    case "keyboard-nav":
      return result.metrics.ux?.latencyMsP50;
    default:
      return undefined;
  }
}

export function evaluateBudget(result: ScenarioRunResult): { status: BudgetStatus; violations: string[] } {
  const violations: string[] = [];
  let worst: BudgetStatus = "n/a";

  const budgetKey = SCENARIO_BUDGET_KEY[result.scenarioId];
  const primary = primaryMetricFor(result);
  if (budgetKey && primary !== undefined) {
    const budget = budgets[budgetKey];
    if (budget) {
      const { status, violation } = checkThreshold(primary, budget, budget.direction === "higher-is-better");
      if (violation) violations.push(`[${budgetKey}] ${violation}`);
      worst = worseOf(worst, status);
    }
  }

  // Long-task budgets apply to every scenario, regardless of its primary metric.
  const lt = result.metrics.longTask;
  if (lt) {
    const countBudget = budgets.longTaskCount;
    if (countBudget) {
      const { status, violation } = checkThreshold(lt.longTaskCount, countBudget, false);
      if (violation) violations.push(`[longTaskCount] ${violation}`);
      worst = worseOf(worst, status);
    }
    const longestBudget = budgets.longestTaskMs;
    if (longestBudget) {
      const { status, violation } = checkThreshold(lt.longestTaskMs, longestBudget, false);
      if (violation) violations.push(`[longestTaskMs] ${violation}`);
      worst = worseOf(worst, status);
    }
  }

  return { status: worst === "n/a" ? "pass" : worst, violations };
}

function worseOf(a: BudgetStatus, b: BudgetStatus): BudgetStatus {
  const rank: Record<BudgetStatus, number> = { "n/a": 0, pass: 1, warn: 2, fail: 3 };
  return rank[b] > rank[a] ? b : a;
}
