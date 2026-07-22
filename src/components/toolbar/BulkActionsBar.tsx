import { Trash2, Save, X } from "lucide-react";
import type { GridApi } from "../Reaktiform/types";
import type { GridConfig } from "../../types";

export function BulkActionsBar<TData>({
  grid,
  config,
}: {
  grid: GridApi<TData>;
  config: GridConfig<TData>;
}) {
  if (grid.selectedIds.size === 0) return null;

  return (
    <div className="rf-flex rf-items-center rf-gap-3 px-4 py-2 bg-rf-accent text-white border border-rf-accent border-b-0 rounded-t-rf-lg text-[12.5px] rf-font-medium rf-flex-shrink-0">
      <span className="rf-font-semibold">
        {grid.selectedIds.size} row{grid.selectedIds.size !== 1 ? "s" : ""}{" "}
        selected
      </span>
      <div className="w-px rf-icon-lg bg-white/20" />
      {/* Bulk delete — uses onBulkDelete (single API call) when provided,
           falls back to sequential onDelete calls */}
      {(config.onBulkDelete || config.onDelete) &&
        [...grid.selectedIds].every((id) => {
          const r = grid.rows.find((row) => row._id === id);
          return (
            r && grid.permissions.canDeleteRow(r as Record<string, unknown>)
          );
        }) && (
          <button
            onClick={async () => {
              const ids = [...grid.selectedIds];
              if (config.onBulkDelete) {
                // Preferred: single API call for all selected rows.
                // bulkDeleteRows calls onBulkDelete exactly once and
                // never onDelete — see useDraft.ts.
                await grid.bulkDeleteRows(ids);
              } else {
                // Fallback: sequential — each fires onDelete separately
                for (const id of ids) {
                  await grid.deleteRow(id);
                }
              }
              grid.clearSelection();
            }}
            className="rf-inline-flex rf-items-center rf-gap-1.5 px-2.5 py-1 rounded-rf-md bg-white/10 hover:bg-white/20 rf-transition-colors"
          >
            <Trash2 className="rf-icon-sm" /> Delete{" "}
            {grid.selectedIds.size > 1
              ? `${grid.selectedIds.size} rows`
              : "selected"}
          </button>
        )}
      {/* Bulk save (only dirty rows) — gated by canSave */}
      {grid.permissions.canSave &&
        [...grid.selectedIds].some((id) => {
          const row = grid.rows.find((r) => r._id === id);
          return row && grid.isDirty(row);
        }) && (
          <button
            onClick={() => void grid.saveAll()}
            className="rf-inline-flex rf-items-center rf-gap-1.5 px-2.5 py-1 rounded-rf-md bg-white/10 hover:bg-white/20 rf-transition-colors"
          >
            <Save className="rf-icon-sm" /> Save selected
          </button>
        )}
      <div className="rf-ml-auto" />
      <button
        onClick={grid.clearSelection}
        className="rf-inline-flex rf-items-center rf-gap-1 px-2.5 py-1 rounded-rf-md bg-white/10 hover:bg-white/20 rf-transition-colors"
      >
        <X className="rf-icon-sm" /> Deselect all
      </button>
    </div>
  );
}
