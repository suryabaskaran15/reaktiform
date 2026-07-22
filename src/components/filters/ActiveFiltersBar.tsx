import { X } from "lucide-react";
import type { GridApi } from "../Reaktiform/types";
import type { GridConfig } from "../../types";

export function ActiveFiltersBar<TData>({
  grid,
  config,
}: {
  grid: GridApi<TData>;
  config: GridConfig<TData>;
}) {
  if (
    config.features?.showActiveFilterChips === false ||
    Object.keys(grid.activeFilters).length === 0
  ) {
    return null;
  }

  return (
    <div className="rf-flex rf-items-center rf-gap-2 rf-flex-wrap px-3 py-2 bg-rf-accent-bg border border-rf-accent-br border-b-0 text-[12px]">
      <span className="rf-font-semibold text-rf-accent">Active filters:</span>
      {Object.entries(grid.activeFilters).map(([key]) => {
        const col = config.columns.find((c) => c.key === key);
        return (
          <span
            key={key}
            className="rf-inline-flex rf-items-center rf-gap-1 bg-rf-surface border border-rf-accent-br rounded-full px-2.5 py-0.5 text-rf-accent rf-font-medium"
          >
            {col?.label ?? key}
            <button
              onClick={() => grid.clearFilter(key)}
              className="rf-opacity-60 hover:opacity-100"
            >
              <X className="rf-icon-xs" />
            </button>
          </span>
        );
      })}
      <button
        onClick={grid.clearAllFilters}
        className="rf-ml-auto text-rf-accent rf-font-medium opacity-70 hover:opacity-100"
      >
        Clear all
      </button>
    </div>
  );
}
