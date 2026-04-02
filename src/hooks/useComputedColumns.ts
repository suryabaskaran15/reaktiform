import { useMemo, useRef } from "react";
import type { ColumnDef, Row } from "../types";

type UseComputedColumnsOptions<TData> = {
  columns: ColumnDef<TData>[];
};

/**
 * Resolves computed column values for a set of rows.
 *
 * Key behaviours:
 * - Only columns with `computed: true` and a `formula` are processed
 * - If `dependsOn` is declared, the formula only re-runs when those
 *   specific field values change (tracked via a per-row cache)
 * - If `dependsOn` is omitted, formula runs on every render for that row
 * - Computed values are NEVER written into the draft or row data —
 *   they are returned as a separate lookup map so the original data
 *   stays clean
 */
export function useComputedColumns<TData = Record<string, unknown>>({
  columns,
}: UseComputedColumnsOptions<TData>) {
  // Only care about columns that have a formula
  const computedCols = useMemo(
    () => columns.filter((c) => c.computed && typeof c.formula === "function"),
    [columns],
  );

  // ── Per-row, per-column cache
  // Structure: Map<rowId, Map<colKey, { depValues: unknown[], result: unknown }>>
  const cacheRef = useRef<
    Map<string, Map<string, { depValues: unknown[]; result: unknown }>>
  >(new Map());

  /**
   * Get the computed value for a specific cell.
   * Uses cache if dependency values haven't changed.
   */
  const getComputedValue = (row: Row<TData>, colKey: string): unknown => {
    const col = computedCols.find((c) => c.key === colKey);
    if (!col?.formula) return undefined;

    // Build the row data object — draft values take priority
    const rowData = buildRowData(row);

    // If no dependsOn declared — always recalculate (no cache)
    if (!col.dependsOn || col.dependsOn.length === 0) {
      return col.formula(rowData as TData);
    }

    // Check cache
    const rowId = row._id;
    const currentDepValues = col.dependsOn.map(
      (field) => (rowData as Record<string, unknown>)[field as string],
    );

    if (!cacheRef.current.has(rowId)) {
      cacheRef.current.set(rowId, new Map());
    }
    const rowCache = cacheRef.current.get(rowId)!;

    if (rowCache.has(colKey)) {
      const cached = rowCache.get(colKey)!;
      // Check if dependency values are still the same
      const depsUnchanged = cached.depValues.every(
        (v, i) => v === currentDepValues[i],
      );
      if (depsUnchanged) {
        return cached.result;
      }
    }

    // Recalculate and cache
    const result = col.formula(rowData as TData);
    rowCache.set(colKey, { depValues: currentDepValues, result });
    return result;
  };

  /**
   * Get ALL computed values for a row as a flat object.
   * Use this to merge into display data for aggregations / sorting.
   */
  const getComputedValues = (row: Row<TData>): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    for (const col of computedCols) {
      result[col.key as string] = getComputedValue(row, col.key as string);
    }
    return result;
  };

  /**
   * Build the full row data object for formula evaluation.
   * Draft values override committed values so formula sees latest edits.
   */
  const buildRowData = (row: Row<TData>): Record<string, unknown> => {
    return {
      ...(row as Record<string, unknown>),
      ...(row._draft ?? {}),
    };
  };

  /**
   * Invalidate cache for a specific row when any of its fields change.
   * Called by useDraft when markDirty fires.
   */
  const invalidateRow = (rowId: string, changedField: string) => {
    const rowCache = cacheRef.current.get(rowId);
    if (!rowCache) return;

    // Only invalidate cols that depend on the changed field
    for (const [colKey, _cached] of rowCache.entries()) {
      const col = computedCols.find((c) => c.key === colKey);
      if (!col?.dependsOn) {
        // No dependsOn — always recalculates anyway, nothing to invalidate
        continue;
      }
      if (col.dependsOn.includes(changedField as keyof TData & string)) {
        rowCache.delete(colKey);
      }
    }
  };

  /**
   * Invalidate entire row cache (e.g. after row is saved / discarded).
   */
  const invalidateRowAll = (rowId: string) => {
    cacheRef.current.delete(rowId);
  };

  /**
   * Build the saveable computed payload for a row.
   * Only includes computed columns where saveable: true.
   */
  const getSaveableComputedValues = (
    row: Row<TData>,
  ): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    for (const col of computedCols) {
      if (col.saveable) {
        result[col.key as string] = getComputedValue(row, col.key as string);
      }
    }
    return result;
  };

  /**
   * Check if a column key is a computed column.
   */
  const isComputed = (colKey: string): boolean => {
    return computedCols.some((c) => c.key === colKey);
  };

  return {
    computedCols,
    getComputedValue,
    getComputedValues,
    getSaveableComputedValues,
    invalidateRow,
    invalidateRowAll,
    isComputed,
  };
}
