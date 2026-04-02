import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes safely — resolves conflicts
 * e.g. cn('px-2 px-4') → 'px-4'
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Get display value from a row — prefers draft over committed
 */
export function getDraftValue<T extends Record<string, unknown>>(
  row: T & { _draft: Record<string, unknown> | null },
  key: string,
): unknown {
  return row._draft && key in row._draft ? row._draft[key] : row[key];
}

/**
 * Generate a unique id
 */
export function generateId(prefix = "row"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Format a date string for display
 */
export function formatDate(
  value: string | null | undefined,
  _format = "DD MMM YYYY",
): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Get days difference from today (negative = past)
 */
export function getDaysFromToday(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

/**
 * Safely get option label from value
 */
export function getOptionLabel(
  value: string | undefined,
  options: { label: string; value: string }[] | undefined,
): string {
  if (!value || !options) return value ?? "";
  return options.find((o) => o.value === value)?.label ?? value;
}

/**
 * Deep clone using structuredClone (safe for row objects)
 */
export function deepClone<T>(obj: T): T {
  return structuredClone(obj);
}

/**
 * Check if two values are deeply equal (for dirty detection)
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
