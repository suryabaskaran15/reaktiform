import { useCallback, useEffect } from "react";
import { useGridStore, useGridActions } from "../store";
import { validateRow } from "../validation/buildZodSchema";
import type { ColumnDef, Row } from "../types";
import type { HistoryEntry } from "../store/gridStore";

type UseUndoOptions<TData> = {
  columns: ColumnDef<TData>[];
  rowIdKey: string;
  enabled?: boolean;
};

export function useUndo<TData = Record<string, unknown>>({
  columns,
  rowIdKey,
  enabled = true,
}: UseUndoOptions<TData>) {
  const history = useGridStore((s) => s.history);
  const future = useGridStore((s) => s.future);
  const rows = useGridStore((s) => s.rows) as Row<TData>[];
  const actions = useGridActions();

  const canUndo = history.length > 0;
  const canRedo = future.length > 0;

  console.log("rowIdKey :", rowIdKey);
  // ── Apply a history entry (used for both undo and redo)
  const applyEntry = useCallback(
    (entry: HistoryEntry, direction: "undo" | "redo") => {
      if (entry.type === "field") {
        const row = rows.find((r) => r._id === entry.rowId);
        if (!row) return;

        const val = direction === "undo" ? entry.oldVal : entry.newVal;

        // Apply to draft if dirty, else to row directly
        if (row._draft) {
          const newDraft = { ...row._draft, [entry.field!]: val };
          const draftData = {
            ...(row as Record<string, unknown>),
            ...newDraft,
          };
          const errors = validateRow(columns as ColumnDef[], draftData);
          actions.updateRowInStore(row._id, {
            _draft: newDraft,
            _errors: errors,
          });
        } else {
          const data = {
            ...(row as Record<string, unknown>),
            [entry.field!]: val,
          };
          const errors = validateRow(columns as ColumnDef[], data);
          actions.updateRowInStore(row._id, {
            [entry.field!]: val,
            _errors: errors,
          });
        }
      } else if (entry.type === "addRow") {
        if (direction === "undo") {
          // Remove the added row
          actions.removeRowFromStore(entry.rowId);
        } else {
          // Re-add it
          if (entry.snapshot) {
            actions.addRowToStore(entry.snapshot);
          }
        }
      } else if (entry.type === "delRow") {
        if (direction === "undo") {
          // Re-insert deleted row at original index
          if (entry.snapshot) {
            const currentRows = [...rows];
            const insertIdx = Math.min(entry.index ?? 0, currentRows.length);
            currentRows.splice(
              insertIdx,
              0,
              entry.snapshot as unknown as Row<TData>,
            );
            actions.setRows(
              currentRows as unknown as Record<string, unknown>[],
            );
          }
        } else {
          // Re-delete it
          actions.removeRowFromStore(entry.rowId);
        }
      } else if (entry.type === "saveRow") {
        const row = rows.find((r) => r._id === entry.rowId);
        if (!row) return;

        if (direction === "undo") {
          // Restore row to pre-save state (re-open draft)
          const errors = validateRow(columns as ColumnDef[], {
            ...(row as Record<string, unknown>),
            ...entry.draftSnap,
          });
          actions.updateRowInStore(row._id, {
            ...entry.oldData,
            _draft: entry.draftSnap ?? null,
            _saved: false,
            _errors: errors,
          });
        } else {
          // Re-apply save
          actions.updateRowInStore(row._id, {
            ...entry.newData,
            _draft: null,
            _saved: true,
            _errors: {},
          });
        }
      }
    },
    [rows, columns, actions],
  );

  // ── Undo
  const undo = useCallback(() => {
    if (!canUndo) return;
    const entry = actions.popHistory();
    if (!entry) return;
    actions.pushFuture(entry);
    applyEntry(entry, "undo");
  }, [canUndo, actions, applyEntry]);

  // ── Redo
  const redo = useCallback(() => {
    if (!canRedo) return;
    const entry = actions.popFuture();
    if (!entry) return;
    actions.pushHistory(entry);
    applyEntry(entry, "redo");
  }, [canRedo, actions, applyEntry]);

  // ── Keyboard shortcuts (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z)
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;

      const isCtrl = e.ctrlKey || e.metaKey;

      if (isCtrl && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (isCtrl && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, undo, redo]);

  // ── History entries for display (most recent first)
  const historyEntries: HistoryEntry[] = [...history].reverse();

  return {
    undo,
    redo,
    canUndo,
    canRedo,
    historyCount: history.length,
    futureCount: future.length,
    historyEntries,
  };
}
