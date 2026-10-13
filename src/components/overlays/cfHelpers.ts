import type { ColumnDef } from "../../types";

// ─────────────────────────────────────────────────────────────
//  OPERATORS filtered by column type
// ─────────────────────────────────────────────────────────────
const CF_OPS_TEXT = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "contains", label: "contains" },
];
const CF_OPS_NUMBER = [
  { value: "eq", label: "= equals" },
  { value: "neq", label: "≠ not equals" },
  { value: "gt", label: "> greater than" },
  { value: "gte", label: "≥ at least" },
  { value: "lt", label: "< less than" },
  { value: "lte", label: "≤ at most" },
];
const CF_OPS_SELECT = [
  { value: "eq", label: "is" },
  { value: "neq", label: "is not" },
  { value: "in", label: "is one of" },
];
const CF_OPS_BOOL = [{ value: "eq", label: "is" }];
const CF_OPS_DATE = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "gt", label: "after" },
  { value: "gte", label: "on or after" },
  { value: "lt", label: "before" },
  { value: "lte", label: "on or before" },
];

export function getCFOps(type: ColumnDef["type"] | undefined) {
  if (!type) return CF_OPS_TEXT;
  if (["select", "multiselect", "badge"].includes(type)) return CF_OPS_SELECT;
  if (["checkbox"].includes(type)) return CF_OPS_BOOL;
  if (["number", "currency", "percentage", "rating", "progress"].includes(type))
    return CF_OPS_NUMBER;
  if (type === "date") return CF_OPS_DATE;
  return CF_OPS_TEXT;
}
