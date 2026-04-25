import { Row } from "@/types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Re-export all formatters so consumers can import from 'reaktiform/utils'
// or from the package root './utils'
export {
  formatDate,
  formatDateLocale,
  getDaysFromToday,
  formatNumber,
  formatCurrency,
  formatPercentage,
  formatDuration,
  formatFileSize,
  truncate,
  highlight,
} from "./formatters";

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
