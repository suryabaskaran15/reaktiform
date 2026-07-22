import type { Scenario } from "../runner/types";
import { initialRenderScenario } from "./initial-render";
import { reRenderScenario } from "./re-render";
import { scrollContinuousScenario } from "./scroll-continuous";
import { scrollFastScenario } from "./scroll-fast";
import { keyboardNavScenario } from "./keyboard-nav";
import { cellEditScenario } from "./cell-edit";
import { selectionScenario } from "./selection";
import { multiSelectionScenario } from "./multi-selection";
import { filterScenario } from "./filter";
import { sortScenario } from "./sort";

export const ALL_SCENARIOS: Scenario[] = [
  initialRenderScenario,
  reRenderScenario,
  scrollContinuousScenario,
  scrollFastScenario,
  keyboardNavScenario,
  cellEditScenario,
  selectionScenario,
  multiSelectionScenario,
  filterScenario,
  sortScenario,
];

export const SCENARIO_GROUPS: Record<string, string[]> = {
  scroll: ["scroll-continuous", "scroll-fast"],
  edit: ["cell-edit"],
  selection: ["selection", "multi-selection"],
  filter: ["filter"],
  sort: ["sort"],
  keyboard: ["keyboard-nav"],
  "initial-render": ["initial-render"],
};

export function resolveScenarios(names?: string[]): Scenario[] {
  if (!names || names.length === 0) return ALL_SCENARIOS;
  const ids = new Set(names);
  return ALL_SCENARIOS.filter((s) => ids.has(s.id));
}
