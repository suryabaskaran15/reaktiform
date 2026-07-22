// Generates a heterogeneous ColumnDef[] — real 100-column grids aren't 100
// text columns, so this cycles through every ColumnType reaktiform supports.
//
// NOTE: importing `ColumnDef`/`SelectOption` as *types only* from ../../src —
// this is a type-only import (erased at compile time, zero runtime code),
// not a dependency on production runtime behavior. It exists purely so the
// generator produces genuinely-valid column configs.
import type { ColumnDef, ColumnType, SelectOption } from "../../src/types";

export type ColumnFeatureFlags = {
  editableRatio: number; // 0..1 — fraction of columns that are NOT readOnly
  validation: boolean; // attach required/min/max/pattern to a subset
  groupable: boolean; // mark one low-cardinality column groupable
};

const STATUS_OPTIONS: SelectOption[] = [
  { value: "open", label: "Open", color: "info" },
  { value: "in_progress", label: "In Progress", color: "warning" },
  { value: "blocked", label: "Blocked", color: "error" },
  { value: "done", label: "Done", color: "success" },
  { value: "archived", label: "Archived", color: "default" },
];

const TAG_OPTIONS: SelectOption[] = [
  { value: "urgent", label: "Urgent" },
  { value: "backend", label: "Backend" },
  { value: "frontend", label: "Frontend" },
  { value: "infra", label: "Infra" },
  { value: "design", label: "Design" },
];

// Base rotation of column "shapes" — cycled to reach any target column count.
// Order matters: index 0 is always a stable text column used as a display
// anchor by several scenario scripts (e.g. "find row by visible text").
const BASE_TYPES: ColumnType[] = [
  "text",
  "number",
  "select",
  "multiselect",
  "date",
  "time",
  "checkbox",
  "email",
  "url",
  "currency",
  "percentage",
  "rating",
  "badge",
  "progress",
];

export function generateColumns<TData = Record<string, unknown>>(
  columnCount: number,
  features: ColumnFeatureFlags,
): ColumnDef<TData>[] {
  const columns: ColumnDef<TData>[] = [];

  for (let i = 0; i < columnCount; i++) {
    const type = BASE_TYPES[i % BASE_TYPES.length] as ColumnType;
    const key = `col_${type}_${i}` as keyof TData & string;
    const label = `${type[0]!.toUpperCase()}${type.slice(1)} ${i}`;
    // e.g. editableRatio=0.7 → columns 0-6 of every 10 are editable.
    const editable = i % 10 < Math.round(features.editableRatio * 10);
    const readOnly = !editable;

    const base: ColumnDef<TData> = {
      key,
      label,
      type,
      readOnly,
      width: 150,
    };

    if (type === "select") {
      base.options = STATUS_OPTIONS;
    }
    if (type === "multiselect") {
      base.options = TAG_OPTIONS;
    }
    if (features.validation && (type === "number" || type === "currency" || type === "percentage")) {
      base.required = i % 5 === 0;
      base.min = 0;
      base.max = type === "percentage" ? 100 : 1_000_000;
    }
    if (features.validation && type === "text") {
      base.required = i % 7 === 0;
      base.minLength = 2;
      base.maxLength = 120;
    }
    if (features.groupable && type === "select" && !columns.some((c) => c.groupable)) {
      base.groupable = true;
    }

    columns.push(base);
  }

  return columns;
}

// A separate, wider column set for "large form" panel-stress scenarios
// (Phase 4/Phase 0 D13's extension) — 50+ simple, always-editable text/number
// fields, since the panel form doesn't need the full heterogeneous mix to be
// a valid stress test of Zod-schema-rebuild cost per keystroke.
export function generateLargeFormColumns<TData = Record<string, unknown>>(
  fieldCount = 60,
): ColumnDef<TData>[] {
  const columns: ColumnDef<TData>[] = [];
  for (let i = 0; i < fieldCount; i++) {
    const type: ColumnType = i % 3 === 0 ? "number" : "text";
    columns.push({
      key: `field_${i}` as keyof TData & string,
      label: `Field ${i}`,
      type,
      required: i % 4 === 0,
    });
  }
  return columns;
}
