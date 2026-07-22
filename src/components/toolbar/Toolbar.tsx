import type { Dispatch, SetStateAction } from "react";
import {
  Search,
  Save,
  X,
  RotateCcw,
  RotateCw,
  AlertTriangle,
  Palette,
  Columns3,
  RefreshCw,
  Download,
  FileSpreadsheet,
  Plus,
  Lock,
  Unlock,
} from "lucide-react";
import { cn } from "../../utils";
import { exportToCsv, exportToXlsx } from "./exportHelpers";
import type { GridApi } from "../Reaktiform/types";
import type { ColumnDef, GridConfig } from "../../types";

export function Toolbar<TData>({
  grid,
  config,
  visibleRowsCount,
  visibleDataCols,
  dirtyCount,
  showErrorsOnly,
  setShowErrorsOnly,
  isRefreshing,
  setIsRefreshing,
  setCfAnchor,
  setCfPanelOpen,
  setColVisAnchor,
  setColVisPanelOpen,
}: {
  grid: GridApi<TData>;
  config: GridConfig<TData>;
  visibleRowsCount: number;
  visibleDataCols: ColumnDef<TData>[];
  dirtyCount: number;
  showErrorsOnly: boolean;
  setShowErrorsOnly: Dispatch<SetStateAction<boolean>>;
  isRefreshing: boolean;
  setIsRefreshing: Dispatch<SetStateAction<boolean>>;
  setCfAnchor: Dispatch<SetStateAction<DOMRect | null>>;
  setCfPanelOpen: Dispatch<SetStateAction<boolean>>;
  setColVisAnchor: Dispatch<SetStateAction<DOMRect | null>>;
  setColVisPanelOpen: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <div className="bg-rf-surface border border-rf-border border-b-0 rounded-t-rf-lg px-3 py-2 rf-flex rf-items-center rf-gap-2 rf-flex-wrap">
      {/* Search */}
      <div className="rf-relative rf-flex-1 min-w-[160px] max-w-[240px]">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 rf-icon-sm text-rf-text-3 rf-pointer-events-none" />
        <input
          type="text"
          placeholder="Search all fields…"
          value={grid.searchQuery}
          onChange={(e) => grid.setSearch(e.target.value)}
          className={cn(
            "w-full pl-7 pr-2 py-1.5 text-[13px]",
            "border border-rf-border rounded-rf-md bg-rf-bg text-rf-text-1",
            "outline-none focus:border-rf-accent focus:bg-rf-surface",
            "focus:shadow-[0_0_0_3px_rgba(59,91,219,.10)]",
            "placeholder:text-rf-text-3",
          )}
        />
      </div>

      {/* Edit Lock — session-level "child lock" (see GridConfig.editLocked).
          Narrows what permissions already allow; never widens it. */}
      {config.features?.editLock !== false && (
        <button
          onClick={() => grid.toggleEditLocked()}
          aria-pressed={grid.editLocked}
          title={
            grid.editLocked
              ? "Editing is locked — click to unlock"
              : "Lock editing to browse safely without risking accidental edits"
          }
          className={cn(
            "rf-inline-flex rf-items-center rf-gap-1.5 text-[12px] rf-font-semibold px-2.5 py-1.5 rounded-rf-md border rf-transition-colors rf-flex-shrink-0",
            grid.editLocked
              ? "bg-rf-warn-bg text-amber-800 border-rf-warn-br hover:bg-yellow-100"
              : "bg-rf-surface text-rf-text-2 border-rf-border hover:bg-rf-header",
          )}
        >
          {grid.editLocked ? (
            <>
              <Lock className="rf-icon-sm" /> Locked
            </>
          ) : (
            <>
              <Unlock className="rf-icon-sm" /> Editable
            </>
          )}
        </button>
      )}

      <div className="w-px h-[18px] bg-rf-border rf-flex-shrink-0" />

      {/* Consumer toolbar left slot */}
      {config.toolbarLeft}

      {/* Dirty badge + Save/Discard all */}
      {dirtyCount > 0 && (
        <>
          <span className="rf-inline-flex rf-items-center rf-gap-1.5 text-[12px] rf-font-semibold text-rf-amber bg-rf-amber-bg border border-rf-amber-br rounded-full px-2.5 py-0.5">
            {dirtyCount} unsaved
          </span>
          {grid.permissions.canSave &&
            (() => {
              const isBulkSaving = (grid.savingCount ?? 0) > 0;
              return (
                <button
                  onClick={() => {
                    if (!isBulkSaving) grid.saveAll();
                  }}
                  disabled={isBulkSaving}
                  className="rf-inline-flex rf-items-center rf-gap-1.5 text-[12.5px] rf-font-medium px-3 py-1.5 rounded-rf-md bg-rf-ok-bg text-green-700 border border-rf-ok-br hover:bg-green-100 rf-transition-colors disabled:rf-opacity-60 disabled:rf-cursor-not-allowed"
                >
                  {isBulkSaving ? (
                    <>
                      <svg
                        style={{
                          width: 12,
                          height: 12,
                          animation: "rf-spin 0.8s linear infinite",
                        }}
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeDasharray="32"
                          strokeDashoffset="12"
                          strokeLinecap="round"
                        />
                      </svg>
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save className="rf-icon-sm" /> Save All
                    </>
                  )}
                </button>
              );
            })()}
          <button
            onClick={() => grid.discardAll()}
            disabled={(grid.savingCount ?? 0) > 0}
            className="rf-inline-flex rf-items-center rf-gap-1.5 text-[12.5px] rf-font-medium px-3 py-1.5 rounded-rf-md bg-rf-warn-bg text-amber-800 border border-rf-warn-br hover:bg-yellow-100 rf-transition-colors disabled:rf-opacity-60 disabled:rf-cursor-not-allowed"
          >
            <X className="rf-icon-sm" /> Discard All
          </button>
          <div className="w-px h-[18px] bg-rf-border rf-flex-shrink-0" />
        </>
      )}

      {/* Undo/Redo */}
      {config.features?.undoRedo !== false && (
        <>
          <button
            onClick={grid.undo}
            disabled={!grid.canUndo}
            title="Undo (Ctrl+Z)"
            className="rf-inline-flex rf-items-center rf-gap-1 text-[12px] rf-font-medium px-2.5 py-1.5 rounded-rf-md border border-rf-border bg-rf-surface text-rf-text-2 hover:bg-rf-header hover:text-rf-text-1 disabled:opacity-35 disabled:rf-cursor-not-allowed rf-transition-colors"
          >
            <RotateCcw className="rf-icon-sm" />
            Undo
            {grid.historyCount > 0 && (
              <span className="rf-font-mono text-[10.5px] text-rf-text-3 ml-0.5">
                {grid.historyCount}
              </span>
            )}
          </button>
          <button
            onClick={grid.redo}
            disabled={!grid.canRedo}
            title="Redo (Ctrl+Y)"
            className="rf-inline-flex rf-items-center rf-gap-1 text-[12px] rf-font-medium px-2.5 py-1.5 rounded-rf-md border border-rf-border bg-rf-surface text-rf-text-2 hover:bg-rf-header hover:text-rf-text-1 disabled:opacity-35 disabled:rf-cursor-not-allowed rf-transition-colors"
          >
            Redo
            <RotateCw className="rf-icon-sm" />
          </button>
          <div className="w-px h-[18px] bg-rf-border rf-flex-shrink-0" />
        </>
      )}

      <div className="rf-ml-auto rf-flex rf-items-center rf-gap-2">
        {/* Feature 6 — Show errors only toggle */}
        {(() => {
          const errorCount = grid.rows.filter(
            (r) => Object.keys(r._errors ?? {}).length > 0,
          ).length;
          if (errorCount === 0) return null;
          return (
            <button
              onClick={() => setShowErrorsOnly((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 rounded-rf-md border transition-colors",
                showErrorsOnly
                  ? "bg-rf-err-bg text-rf-err border-rf-err-br"
                  : "bg-rf-surface text-rf-text-2 border-rf-border hover:bg-rf-err-bg hover:text-rf-err hover:border-rf-err-br",
              )}
              title={
                showErrorsOnly
                  ? "Show all rows"
                  : `Show only rows with errors (${errorCount})`
              }
            >
              <AlertTriangle className="rf-icon-sm" />
              {errorCount} {errorCount === 1 ? "error" : "errors"}
              {showErrorsOnly && <X className="rf-icon-xs ml-0.5" />}
            </button>
          );
        })()}
        <span className="text-[12px] text-rf-text-3">
          {grid.processedRows.length} / {visibleRowsCount} rows
        </span>
        {/* Conditional Format button */}
        {config.features?.conditionalFormat !== false && (
          <button
            onClick={(e) => {
              setCfAnchor(
                (e.currentTarget as HTMLButtonElement).getBoundingClientRect(),
              );
              setCfPanelOpen((v) => !v);
            }}
            className={cn(
              "inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1.5 rounded-rf-md border transition-colors",
              grid.cfRules.some((r) => r.enabled)
                ? "bg-rf-purple-bg text-purple-700 border-rf-purple-br"
                : "bg-rf-surface text-rf-text-2 border-rf-border hover:bg-rf-header",
            )}
            title="Conditional formatting"
          >
            <Palette className="rf-icon-sm" />
          </button>
        )}
        {/* Column visibility button */}
        {config.features?.columnHide !== false && (
          <button
            onClick={(e) => {
              setColVisAnchor(
                (e.currentTarget as HTMLButtonElement).getBoundingClientRect(),
              );
              setColVisPanelOpen((v) => !v);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 rounded-rf-md border transition-colors",
              grid.hiddenColumns.size > 0
                ? "bg-rf-accent-bg text-rf-accent border-rf-accent-br"
                : "bg-rf-surface text-rf-text-2 border-rf-border hover:bg-rf-header",
            )}
            title="Show/hide columns"
          >
            <Columns3 className="rf-icon-sm" />
            {grid.hiddenColumns.size > 0 && (
              <span className="text-[10px] rf-font-bold">
                {config.columns.length - grid.hiddenColumns.size}/
                {config.columns.length}
              </span>
            )}
          </button>
        )}
        {/* Sync / Refresh button */}
        {config.onRefresh && (
          <button
            onClick={async () => {
              if (isRefreshing) return;
              setIsRefreshing(true);
              try {
                await config.onRefresh!();
              } finally {
                setIsRefreshing(false);
              }
            }}
            disabled={isRefreshing}
            className={cn(
              "inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1.5 rounded-rf-md border transition-colors",
              isRefreshing
                ? "bg-rf-accent-bg text-rf-accent border-rf-accent-br cursor-not-allowed"
                : "bg-rf-surface text-rf-text-2 border-rf-border hover:bg-rf-header",
            )}
            title="Sync / Refresh data"
          >
            <RefreshCw
              className="rf-icon-sm"
              style={
                isRefreshing
                  ? { animation: "spin 0.8s linear infinite" }
                  : undefined
              }
            />
            {isRefreshing ? "Syncing…" : "Sync"}
          </button>
        )}
        {/* Export — CSV + Excel, client-side or server-side */}
        {grid.permissions.canExport && config.features?.export !== false && (
          <>
            <button
              onClick={async () => {
                if (config.onExport) {
                  await config.onExport("csv");
                } else {
                  exportToCsv(
                    visibleDataCols as ColumnDef[],
                    grid.processedRows,
                    grid.getVal as (
                      row: import("../../types").Row,
                      key: string,
                    ) => unknown,
                  );
                }
              }}
              className="rf-inline-flex rf-items-center rf-gap-1 text-[12px] rf-font-medium px-2.5 py-1.5 rounded-rf-md border border-rf-border bg-rf-surface text-rf-text-2 hover:bg-rf-header rf-transition-colors"
              title={
                config.onExport
                  ? "Export all records to CSV (server)"
                  : "Export visible rows to CSV"
              }
            >
              <Download className="rf-icon-sm" /> CSV
            </button>
            <button
              onClick={async () => {
                if (config.onExport) {
                  await config.onExport("xlsx");
                } else {
                  exportToXlsx(
                    visibleDataCols as ColumnDef[],
                    grid.processedRows,
                    grid.getVal as (
                      row: import("../../types").Row,
                      key: string,
                    ) => unknown,
                  );
                }
              }}
              className="rf-inline-flex rf-items-center rf-gap-1 text-[12px] rf-font-medium px-2.5 py-1.5 rounded-rf-md border border-rf-border bg-rf-surface text-rf-text-2 hover:bg-rf-header rf-transition-colors"
              title={
                config.onExport
                  ? "Export all records to Excel (server)"
                  : "Export visible rows to Excel"
              }
            >
              <FileSpreadsheet className="rf-icon-sm" /> Excel
            </button>
          </>
        )}
        {/* Consumer toolbar right slot */}
        {config.toolbarRight}

        {/* New Record */}
        {grid.permissions.canCreate && (
          <button
            onClick={() => grid.addRow()}
            className="rf-inline-flex rf-items-center rf-gap-1.5 text-[12.5px] rf-font-medium px-3 py-1.5 rounded-rf-md bg-rf-accent text-white border border-rf-accent hover:bg-rf-accent-hover rf-transition-colors"
          >
            <Plus className="rf-icon-sm" /> New Record
          </button>
        )}
      </div>
    </div>
  );
}
