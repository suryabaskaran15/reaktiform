import { Row, type ColumnDef } from "@/types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Re-export all formatters so consumers can import from 'reaktiform/utils'
// or from the package root './utils'
export {
  formatDate,
  formatDateLocale,
  formatTime,
  getDaysFromToday,
  formatNumber,
  formatCurrency,
  formatPercentage,
  formatDuration,
  formatFileSize,
  truncate,
  highlight,
} from "./formatters";

export { getNearestScrollLeft } from "./scrollCellIntoView";

/**
 * Merge Tailwind classes safely — resolves conflicts.
 * @example cn('px-2 px-4') → 'px-4'
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Get display value from a row — prefers draft over committed.
 */
export function getDraftValue<T extends Record<string, unknown>>(
  row: T & { _draft: Record<string, unknown> | null },
  key: string,
): unknown {
  return row._draft && key in row._draft ? row._draft[key] : row[key];
}

/**
 * Get a row's value for a column — draft-first, applying valueTransform.read
 * to committed (non-draft) values. This is the single source of truth for
 * resolving a column's draft-aware display/edit value: the grid cell
 * (useDraft's getVal) and the details panel (DetailsTab) both delegate here,
 * so an async select/multiselect field always resolves to the same
 * { value, label } shape in both places, not just in the grid.
 */
export function resolveFieldValue<TData>(
  row: Row<TData>,
  col: ColumnDef<TData>,
): unknown {
  const key = col.key as string;
  const isDraftValue = row._draft !== null && key in row._draft;
  const raw = isDraftValue
    ? row._draft![key]
    : (row as Record<string, unknown>)[key];

  if (
    !isDraftValue &&
    col.valueTransform?.read &&
    raw !== undefined &&
    raw !== null
  ) {
    try {
      return col.valueTransform.read(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

/**
 * Generate a collision-resistant unique id.
 * @example generateId('row') → 'row_1704067200000_a3f7b'
 */
export function generateId(prefix = "row"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Safely get option label from a value string.
 */
export function getOptionLabel(
  value: string | undefined,
  options: { label: string; value: string }[] | undefined,
): string {
  if (!value || !options) return value ?? "";
  return options.find((o) => o.value === value)?.label ?? value;
}

/**
 * Deep clone using structuredClone (safe for row objects with Sets, Dates etc.)
 */
export function deepClone<T>(obj: T): T {
  return structuredClone(obj);
}

/**
 * Structural equality check — used for dirty detection (avoids false positives).
 */
export function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => isEqual(v, b[i]));
  }
  if (typeof a === "object" && a !== null && b !== null) {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    if (ka.length !== kb.length) return false;
    return ka.every((k) =>
      isEqual(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
      ),
    );
  }
  return false;
}

// ─────────────────────────────────────────────────────────────
//  CONSTRAINT RESOLVER
//  Resolves min/max/minDate/maxDate which can be either a static
//  value or a function that receives the current row.
//
//  Usage:
//    const minVal = resolveConstraint(col.min, row)
//    // → number | undefined  regardless of whether col.min is
//    //   a number or (row) => number
// ─────────────────────────────────────────────────────────────
export function resolveConstraint<T, TData>(
  constraint: T | ((row: TData) => T | undefined) | undefined,
  row: Row<TData>,
): T | undefined {
  if (constraint === undefined || constraint === null) return undefined;
  if (typeof constraint === "function") {
    return (constraint as (r: Record<string, unknown>) => T | undefined)(row);
  }
  return constraint;
}
