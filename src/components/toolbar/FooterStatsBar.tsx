import type { GridApi } from "../Reaktiform/types";

export function FooterStatsBar<TData>({
  grid,
  dirtyCount,
}: {
  grid: GridApi<TData>;
  dirtyCount: number;
}) {
  return (
    <div className="border-t border-rf-border bg-rf-header px-4 py-2 rf-flex rf-items-center rf-justify-between rf-gap-3 rf-flex-wrap">
      <div className="rf-flex rf-gap-4 rf-flex-wrap rf-items-center">
        {[
          {
            label: "Records",
            val:
              grid.totalRows !== grid.rows.length
                ? `${grid.rows.length} / ${grid.totalRows}`
                : grid.rows.length,
          },
          { label: "Unsaved", val: dirtyCount },
          { label: "Selected", val: grid.selectedIds.size },
        ].map(({ label, val }) => (
          <div
            key={label}
            className="rf-flex rf-items-center rf-gap-1 text-[11.5px] text-rf-text-3"
          >
            {label}
            <span className="rf-font-semibold rf-font-mono text-rf-text-2">
              {val}
            </span>
          </div>
        ))}
        {/* isFetchingMore — inline spinner in footer */}
        {grid.isFetchingMore && (
          <div className="rf-flex rf-items-center rf-gap-1.5 text-[11.5px] text-rf-accent">
            <div
              className="rf-icon-sm border-2 border-rf-accent border-t-transparent rounded-full"
              style={{ animation: "spin 0.7s linear infinite" }}
            />
            Loading more…
          </div>
        )}
      </div>
      <span className="text-[11px] text-rf-text-3">
        Click cell to edit · Tab/Enter confirm · Esc cancel · ↑↓←→ navigate
      </span>
    </div>
  );
}
