"use client";

import React, {
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "../../utils";
import { GridStoreProvider } from "../../store";
import { useReaktiform } from "../../hooks/useReaktiform";
import { useKeyboardNav } from "../../hooks/useKeyboardNav";
import { CellRenderer } from "../cells/CellRenderer";
import { ReaktiformPanel } from "../ReaktiformPanel/ReaktiformPanel";
import type {
  GridConfig,
  Row,
  ColumnDef,
  FilterValue,
  CFRule,
  CFConditionOperator,
} from "../../types";

// ── Icons
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Filter,
  Pin,
  PinOff,
  Group,
  Plus,
  Save,
  X,
  Copy,
  Trash2,
  Search,
  ChevronRight,
  ChevronDown as ChevDown,
  RotateCcw,
  RotateCw,
  Palette,
  Columns3,
  Download,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
//  CSV EXPORT UTILITY
// ─────────────────────────────────────────────────────────────
function exportToCsv(
  cols: ColumnDef<any>[],
  rows: import("@tanstack/react-table").Row<import("../../types").Row>[],
  getVal: (row: import("../../types").Row<any>, key: string) => unknown,
  _rowIdKey: string,
) {
  // Build header row
  const headers = cols.map((c) => `"${String(c.label).replace(/"/g, '""')}"`);

  // Build data rows — only visible, processed rows (respects current filters/sort)
  const dataRows = rows
    .filter((r) => !r.getIsGrouped()) // skip group header rows
    .map((tanRow) => {
      const row = tanRow.original;
      return cols
        .map((col) => {
          const val = getVal(row, col.key as string);
          if (val === null || val === undefined) return '""';
          if (Array.isArray(val))
            return `"${val.join(", ").replace(/"/g, '""')}"`;
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(",");
    });

  const csv = [headers.join(","), ...dataRows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────
//  INNER GRID (has access to store context)
// ─────────────────────────────────────────────────────────────
function ReaktiformInner<TData = Record<string, unknown>>(
  props: GridConfig<TData>,
) {
  const grid = useReaktiform<TData>(props);

  // ── Editing cell state
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    colKey: string;
  } | null>(null);

  // ── Filter panel: which column is open + anchor rect for positioning
  const [filterCol, setFilterCol] = useState<string | null>(null);
  const [filterAnchor, setFilterAnchor] = useState<DOMRect | null>(null);

  const openFilter = useCallback(
    (colKey: string, buttonEl: HTMLButtonElement) => {
      if (filterCol === colKey) {
        setFilterCol(null);
        setFilterAnchor(null);
      } else {
        setFilterCol(colKey);
        setFilterAnchor(buttonEl.getBoundingClientRect());
      }
    },
    [filterCol],
  );

  // ── CF panel open
  const [cfPanelOpen, setCfPanelOpen] = useState(false);

  // ── Column visibility panel open
  const [colVisPanelOpen, setColVisPanelOpen] = useState(false);

  const activateCell = useCallback(
    (rowId: string, colKey: string) => {
      const col = props.columns.find((c) => c.key === colKey);
      if (!col || col.computed) return;
      setEditingCell({ rowId, colKey });
    },
    [props.columns],
  );

  const deactivateCell = useCallback(() => setEditingCell(null), []);

  // visibleRows — memoized to avoid allocating a new array on every scroll render
  const visibleRows = useMemo(
    () => grid.processedRows.map((r) => r.original),
    [grid.processedRows],
  );
  const kb = useKeyboardNav<TData>({
    columns: props.columns,
    visibleRows,
    hiddenColumns: grid.hiddenColumns,
    enabled: props.features?.keyboardNav !== false,
    onActivateCell: activateCell,
    onOpenPanel: grid.openPanel,
  });

  // ── Dirty count
  const dirtyCount = grid.dirtyCount;

  // ── Scroll container ref (required by TanStack Virtual)
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Column drag-reorder state
  const dragColRef = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const COL_WIDTHS = { cb: 40, rn: 44, exp: 36, act: 88 };

  // ── Apply column order FIRST — everything below depends on this.
  // columnOrder in store is the user's custom order; empty = use definition order.
  const orderedColumns = useMemo(() => {
    const order = grid.columnOrder;
    if (!order.length) return props.columns;
    const map = new Map(props.columns.map((c) => [c.key as string, c]));
    const sorted = order
      .map((k) => map.get(k))
      .filter(Boolean) as typeof props.columns;
    // Append any columns added after the order was saved
    const inOrder = new Set(order);
    props.columns.forEach((c) => {
      if (!inOrder.has(c.key as string)) sorted.push(c);
    });
    return sorted;
  }, [props.columns, grid.columnOrder]);

  const visibleDataCols = orderedColumns.filter(
    (c) => !grid.hiddenColumns.has(c.key as string),
  );

  const totalWidth =
    COL_WIDTHS.cb +
    COL_WIDTHS.rn +
    COL_WIDTHS.exp +
    visibleDataCols.reduce(
      (sum, c) => sum + (grid.columnWidths[c.key as string] ?? c.width ?? 150),
      0,
    ) +
    COL_WIDTHS.act;

  // ── Pin offsets — computed inline (no useCallback — called once per render)
  const pinOffsets: Record<string, number> = { _cb: 0, _rn: 40, _exp: 84 };
  {
    let left = 120;
    orderedColumns
      .filter(
        (c) =>
          grid.pinnedColumns.has(c.key as string) &&
          !grid.hiddenColumns.has(c.key as string),
      )
      .forEach((c) => {
        pinOffsets[c.key as string] = left;
        left += grid.columnWidths[c.key as string] ?? c.width ?? 150;
      });
  }

  const pinnedList = orderedColumns.filter(
    (c) =>
      grid.pinnedColumns.has(c.key as string) &&
      !grid.hiddenColumns.has(c.key as string),
  );
  const lastPinKey = pinnedList.at(-1)?.key as string | undefined;

  // ── Stable per-column callbacks for ColumnHeaderMemo
  // Inline arrows inside .map() recreate on every render, defeating React.memo.
  // We build Maps keyed by colKey so the identity is stable between renders
  // as long as the underlying grid state hasn't changed for that column.
  const colCallbacks = useMemo(() => {
    const AGG_CYCLE = ["none", "sum", "avg", "min", "max", "count"] as const;
    type AggMode = (typeof AGG_CYCLE)[number];
    const onSort = new Map<string, () => void>();
    const onTogglePin = new Map<string, () => void>();
    const onToggleGroup = new Map<string, (isGrouped: boolean) => void>();
    const onOpenFilter = new Map<string, (btn: HTMLButtonElement) => void>();
    const onResize = new Map<string, (w: number) => void>();
    const onCycleAgg = new Map<string, () => void>();

    orderedColumns.forEach((col) => {
      const k = col.key as string;
      onSort.set(k, () => grid.setSort(k));
      onTogglePin.set(k, () => grid.togglePin(k));
      onToggleGroup.set(k, (grouped: boolean) =>
        grid.setGroupBy(grouped ? null : k),
      );
      onOpenFilter.set(k, (btn: HTMLButtonElement) => openFilter(k, btn));
      onResize.set(k, (w: number) => grid.setColumnWidth(k, w));
      if (col.type === "number" && !col.computed) {
        onCycleAgg.set(k, () => {
          const cur = grid.aggregations[k] ?? "none";
          const next =
            AGG_CYCLE[
              (AGG_CYCLE.indexOf(cur as AggMode) + 1) % AGG_CYCLE.length
            ]!;
          grid.setAggregation(k, next);
        });
      }
    });
    return {
      onSort,
      onTogglePin,
      onToggleGroup,
      onOpenFilter,
      onResize,
      onCycleAgg,
    };
    // Rebuild only when column list or aggregation state changes — not on every scroll
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    orderedColumns,
    grid.aggregations,
    grid.setSort,
    grid.togglePin,
    grid.setGroupBy,
    grid.setColumnWidth,
    grid.setAggregation,
    openFilter,
  ]);
  // count = totalRows (not just loaded rows) so the scrollbar reflects
  // the full dataset size immediately — user can see "5000 rows" from the start
  const ROW_HEIGHT = 46;
  const virtualizer = useVirtualizer({
    count: grid.totalRows,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const totalTableSize = virtualizer.getTotalSize();

  // ── Infinite scroll fetch trigger
  // Watch the last visible virtual item. When it's within fetchThreshold rows
  // of the end of LOADED data, pre-fetch the next page.
  // This fires BEFORE the user reaches the unloaded rows → zero perceived latency.
  useEffect(() => {
    if (!grid.hasMore) return;
    if (!virtualItems.length) return;

    const lastVisibleIndex = virtualItems[virtualItems.length - 1]?.index ?? 0;
    const loadedCount = grid.rows.length;
    const distanceFromEnd = loadedCount - lastVisibleIndex;

    // Pre-fetch when user is fetchThreshold rows from end of loaded data
    if (distanceFromEnd <= grid.fetchThreshold) {
      // Guard: don't double-fetch
      if (grid.isFetchingMoreRef.current) return;
      if (grid.isFetchingMore) return;

      grid.isFetchingMoreRef.current = true;

      const lastRow = grid.rows[loadedCount - 1];
      const cursor = lastRow
        ? String(
            (lastRow as Record<string, unknown>)[props.rowIdKey ?? "id"] ??
              lastRow._id,
          )
        : null;

      const fetchPromise = grid.onFetchMoreRef.current?.({
        cursor,
        offset: loadedCount,
        limit: grid.pageSize,
      });

      // Reset guard when fetch resolves (consumer updates data prop → rows sync)
      if (fetchPromise instanceof Promise) {
        fetchPromise.finally(() => {
          grid.isFetchingMoreRef.current = false;
        });
      } else {
        // Sync callback — reset after microtask so data has time to update
        queueMicrotask(() => {
          grid.isFetchingMoreRef.current = false;
        });
      }
    }
    // virtualItems changes on every scroll — intentional, that's the trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [virtualItems]);

  return (
    <div
      className={cn("flex flex-col w-full", props.className)}
      style={props.style}
    >
      {/* ── TOOLBAR ───────────────────────────────────────── */}
      <div className="bg-rf-surface border border-rf-border border-b-0 rounded-t-rf-lg px-3 py-2 flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px] max-w-[240px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-rf-text-3 pointer-events-none" />
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

        <div className="w-px h-[18px] bg-rf-border flex-shrink-0" />

        {/* Dirty badge + Save/Discard all */}
        {dirtyCount > 0 && (
          <>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-rf-amber bg-rf-amber-bg border border-rf-amber-br rounded-full px-2.5 py-0.5">
              {dirtyCount} unsaved
            </span>
            <button
              onClick={() => grid.saveAll()}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-medium px-3 py-1.5 rounded-rf-md bg-rf-ok-bg text-green-700 border border-rf-ok-br hover:bg-green-100 transition-colors"
            >
              <Save className="w-3 h-3" /> Save All
            </button>
            <button
              onClick={() => grid.discardAll()}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-medium px-3 py-1.5 rounded-rf-md bg-rf-warn-bg text-amber-800 border border-rf-warn-br hover:bg-yellow-100 transition-colors"
            >
              <X className="w-3 h-3" /> Discard All
            </button>
            <div className="w-px h-[18px] bg-rf-border flex-shrink-0" />
          </>
        )}

        {/* Undo/Redo */}
        {props.features?.undoRedo !== false && (
          <>
            <button
              onClick={grid.undo}
              disabled={!grid.canUndo}
              title="Undo (Ctrl+Z)"
              className="inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1.5 rounded-rf-md border border-rf-border bg-rf-surface text-rf-text-2 hover:bg-rf-header hover:text-rf-text-1 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Undo
              {grid.historyCount > 0 && (
                <span className="font-mono text-[10.5px] text-rf-text-3 ml-0.5">
                  {grid.historyCount}
                </span>
              )}
            </button>
            <button
              onClick={grid.redo}
              disabled={!grid.canRedo}
              title="Redo (Ctrl+Y)"
              className="inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1.5 rounded-rf-md border border-rf-border bg-rf-surface text-rf-text-2 hover:bg-rf-header hover:text-rf-text-1 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
            >
              Redo
              <RotateCw className="w-3 h-3" />
            </button>
            <div className="w-px h-[18px] bg-rf-border flex-shrink-0" />
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[12px] text-rf-text-3">
            {grid.processedRows.length} / {visibleRows.length} rows
          </span>
          {/* Conditional Format button */}
          {props.features?.conditionalFormat !== false && (
            <button
              onClick={() => setCfPanelOpen(true)}
              className={cn(
                "inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1.5 rounded-rf-md border transition-colors",
                grid.cfRules.some((r) => r.enabled)
                  ? "bg-rf-purple-bg text-purple-700 border-rf-purple-br"
                  : "bg-rf-surface text-rf-text-2 border-rf-border hover:bg-rf-header",
              )}
              title="Conditional formatting"
            >
              <Palette className="w-3 h-3" />
            </button>
          )}
          {/* Column visibility button */}
          {props.features?.columnHide !== false && (
            <button
              onClick={() => setColVisPanelOpen((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 rounded-rf-md border transition-colors",
                grid.hiddenColumns.size > 0
                  ? "bg-rf-accent-bg text-rf-accent border-rf-accent-br"
                  : "bg-rf-surface text-rf-text-2 border-rf-border hover:bg-rf-header",
              )}
              title="Show/hide columns"
            >
              <Columns3 className="w-3 h-3" />
              {grid.hiddenColumns.size > 0 && (
                <span className="text-[10px] font-bold">
                  {props.columns.length - grid.hiddenColumns.size}/
                  {props.columns.length}
                </span>
              )}
            </button>
          )}
          {/* CSV Export */}
          {props.features?.export !== false && (
            <button
              onClick={() =>
                exportToCsv(
                  visibleDataCols,
                  grid.processedRows,
                  grid.getVal,
                  props.rowIdKey ?? "id",
                )
              }
              className="inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1.5 rounded-rf-md border border-rf-border bg-rf-surface text-rf-text-2 hover:bg-rf-header transition-colors"
              title="Export visible rows to CSV"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          )}
          {/* New Record */}
          <button
            onClick={() => grid.addRow()}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium px-3 py-1.5 rounded-rf-md bg-rf-accent text-white border border-rf-accent hover:bg-rf-accent-hover transition-colors"
          >
            <Plus className="w-3 h-3" /> New Record
          </button>
        </div>
      </div>

      {/* ── ACTIVE FILTERS BAR ────────────────────────────── */}
      {Object.keys(grid.activeFilters).length > 0 && (
        <div className="flex items-center gap-2 flex-wrap px-3 py-2 bg-rf-accent-bg border border-rf-accent-br border-b-0 text-[12px]">
          <span className="font-semibold text-rf-accent">Active filters:</span>
          {Object.entries(grid.activeFilters).map(([key]) => {
            const col = props.columns.find((c) => c.key === key);
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1 bg-rf-surface border border-rf-accent-br rounded-full px-2.5 py-0.5 text-rf-accent font-medium"
              >
                {col?.label ?? key}
                <button
                  onClick={() => grid.clearFilter(key)}
                  className="opacity-60 hover:opacity-100"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            );
          })}
          <button
            onClick={grid.clearAllFilters}
            className="ml-auto text-rf-accent font-medium opacity-70 hover:opacity-100"
          >
            Clear all
          </button>
        </div>
      )}

      {/* ── BULK ACTIONS BAR ──────────────────────────────── */}
      {grid.selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-rf-accent text-white border border-rf-accent border-b-0 rounded-t-rf-lg text-[12.5px] font-medium flex-shrink-0">
          <span className="font-semibold">
            {grid.selectedIds.size} row{grid.selectedIds.size !== 1 ? "s" : ""}{" "}
            selected
          </span>
          <div className="w-px h-4 bg-white/20" />
          {/* Bulk delete */}
          {props.onDelete && (
            <button
              onClick={async () => {
                const ids = [...grid.selectedIds];
                for (const id of ids) {
                  await grid.deleteRow(id);
                }
                grid.clearSelection();
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-rf-md bg-white/10 hover:bg-white/20 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Delete selected
            </button>
          )}
          {/* Bulk save (only dirty rows) */}
          {[...grid.selectedIds].some((id) => {
            const row = grid.rows.find((r) => r._id === id);
            return row && grid.isDirty(row);
          }) && (
            <button
              onClick={() => void grid.saveAll()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-rf-md bg-white/10 hover:bg-white/20 transition-colors"
            >
              <Save className="w-3 h-3" /> Save selected
            </button>
          )}
          <div className="ml-auto" />
          <button
            onClick={grid.clearSelection}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-rf-md bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="w-3 h-3" /> Deselect all
          </button>
        </div>
      )}

      {/* ── GRID ──────────────────────────────────────────── */}
      <div
        className="bg-rf-surface border border-rf-border border-t-0 rounded-b-rf-lg shadow-rf-sm"
        style={{ overflow: "clip" }}
      >
        {/* isFetching — subtle top progress bar (doesn't block interaction) */}
        {grid.isFetching && (
          <div className="h-[3px] bg-rf-accent-bg overflow-hidden">
            <div
              className="h-full bg-rf-accent rounded-full"
              style={{
                animation: "rfFetch 1.4s ease-in-out infinite",
                width: "40%",
              }}
            />
          </div>
        )}

        {/* Single scroll container — overflow in both directions
            thead sticky top-0 works because this div has a fixed maxHeight
            and overflow-y:auto — sticky is relative to this scroll parent  */}
        <div
          ref={scrollRef}
          className="overflow-x-auto overflow-y-auto"
          style={{
            maxHeight: props.maxHeight ?? "calc(100vh - 300px)",
            minHeight: props.minHeight ?? 380,
            // contain:strict improves scroll perf by isolating layout
            contain: "strict",
          }}
        >
          <table
            className="w-full border-separate border-spacing-0"
            style={{
              minWidth: totalWidth,
              tableLayout: "fixed",
              width: totalWidth,
            }}
          >
            <colgroup>
              <col style={{ width: COL_WIDTHS.cb }} />
              <col style={{ width: COL_WIDTHS.rn }} />
              <col style={{ width: COL_WIDTHS.exp }} />
              {visibleDataCols.map((col) => (
                <col
                  key={col.key as string}
                  style={{
                    width:
                      grid.columnWidths[col.key as string] ?? col.width ?? 150,
                  }}
                />
              ))}
              <col style={{ width: COL_WIDTHS.act }} />
            </colgroup>

            {/* ── THEAD ─────────────────────────────────── */}
            <thead className="sticky top-0 z-50">
              <tr>
                {/* Checkbox */}
                <th
                  className="bg-rf-header border-b-2 border-r border-rf-border h-[64px] w-10 text-center sticky z-[45]"
                  style={{ left: pinOffsets["_cb"] }}
                >
                  <div className="flex items-center justify-center h-full">
                    <input
                      type="checkbox"
                      className="w-[14px] h-[14px] rounded-[3px] accent-[var(--rf-accent)] cursor-pointer"
                      onChange={(_e) =>
                        grid.toggleSelectAll(visibleRows.map((r) => r._id))
                      }
                    />
                  </div>
                </th>

                {/* Row # */}
                <th
                  className="bg-rf-header border-b-2 border-r border-rf-border h-[64px] sticky z-[45]"
                  style={{ left: pinOffsets["_rn"] }}
                >
                  <div className="flex items-center justify-center h-[36px] px-2">
                    <span className="text-[10.5px] font-semibold text-rf-text-3 uppercase tracking-wider">
                      #
                    </span>
                  </div>
                  <div className="h-[28px] border-t border-rf-border bg-black/[.015]" />
                </th>

                {/* Expander */}
                <th
                  className={cn(
                    "bg-rf-header border-b-2 border-r border-rf-border h-[64px] sticky z-[45]",
                    !lastPinKey && "shadow-[4px_0_10px_rgba(15,23,42,.08)]",
                  )}
                  style={{ left: pinOffsets["_exp"] }}
                >
                  <div className="flex items-center justify-center h-[36px]">
                    <ChevronRight className="w-3 h-3 text-rf-text-3" />
                  </div>
                  <div className="h-[28px] border-t border-rf-border bg-black/[.015]" />
                </th>

                {/* Data columns — in user-defined order */}
                {visibleDataCols.map((col) => {
                  const colKey = col.key as string;
                  const isPinned = grid.pinnedColumns.has(colKey);
                  const isLastPin = lastPinKey === colKey;
                  const isSorted = grid.sortState?.colKey === colKey;
                  const isFiltered = !!grid.activeFilters[colKey];
                  const isGrouped = grid.groupByCol === colKey;

                  return (
                    <ColumnHeaderMemo
                      key={colKey}
                      col={col as ColumnDef}
                      isPinned={isPinned}
                      isLastPin={isLastPin}
                      isSorted={isSorted}
                      sortDir={grid.sortState?.direction}
                      isFiltered={isFiltered}
                      isGrouped={isGrouped}
                      isDragOver={dragOver === colKey}
                      aggregationMode={grid.aggregations[colKey]}
                      pinOffset={isPinned ? pinOffsets[colKey] : undefined}
                      onSort={colCallbacks.onSort.get(colKey)!}
                      onTogglePin={colCallbacks.onTogglePin.get(colKey)!}
                      onToggleGroup={() =>
                        colCallbacks.onToggleGroup.get(colKey)!(isGrouped)
                      }
                      onOpenFilter={colCallbacks.onOpenFilter.get(colKey)!}
                      onResize={colCallbacks.onResize.get(colKey)!}
                      onDragStart={() => {
                        dragColRef.current = colKey;
                      }}
                      onDragOver={() => setDragOver(colKey)}
                      onDragEnd={() => {
                        const from = dragColRef.current;
                        const to = dragOver;
                        if (from && to && from !== to) {
                          const cur = orderedColumns.map(
                            (c) => c.key as string,
                          );
                          const fromIdx = cur.indexOf(from);
                          const toIdx = cur.indexOf(to);
                          if (fromIdx !== -1 && toIdx !== -1) {
                            const next = [...cur];
                            next.splice(fromIdx, 1);
                            next.splice(toIdx, 0, from);
                            grid.setColumnOrder(next);
                          }
                        }
                        dragColRef.current = null;
                        setDragOver(null);
                      }}
                      onCycleAggregation={colCallbacks.onCycleAgg.get(colKey)}
                    />
                  );
                })}

                {/* Actions */}
                <th className="bg-rf-header border-b-2 border-rf-border h-[64px]">
                  <div className="flex items-center justify-center h-[36px] px-2">
                    <span className="text-[10.5px] font-semibold text-rf-text-3 uppercase tracking-wider">
                      Actions
                    </span>
                  </div>
                  <div className="h-[28px] border-t border-rf-border bg-black/[.015]" />
                </th>
              </tr>
            </thead>

            {/* ── TBODY — TanStack Virtual padding-rows pattern ── */}
            {/*
              Correct approach for virtualizing a native <table>:
              - Keep display:table on <tbody> — native table layout works
              - Render a top-padding <tr> and bottom-padding <tr>
              - Only render virtualItems between them
              - <td> gets explicit width from col.width / grid.columnWidths
              - sticky works correctly because <td> is a table cell, not flex child
            */}
            <tbody>
              {/* isLoading skeleton */}
              {grid.isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr
                    key={`skel-${i}`}
                    style={{
                      height: ROW_HEIGHT,
                      borderBottom: "1px solid var(--rf-border)",
                    }}
                  >
                    <td
                      style={{
                        width: COL_WIDTHS.cb,
                        borderRight: "1px solid var(--rf-border)",
                      }}
                    />
                    <td
                      style={{
                        width: COL_WIDTHS.rn,
                        borderRight: "1px solid var(--rf-border)",
                      }}
                    />
                    <td
                      style={{
                        width: COL_WIDTHS.exp,
                        borderRight: "1px solid var(--rf-border)",
                      }}
                    />
                    {visibleDataCols.map((col) => (
                      <td
                        key={col.key as string}
                        style={{
                          width:
                            grid.columnWidths[col.key as string] ??
                            col.width ??
                            150,
                          borderRight: "1px solid var(--rf-border)",
                          padding: "0 12px",
                        }}
                      >
                        <div
                          style={{
                            height: 14,
                            borderRadius: 4,
                            background: "var(--rf-border)",
                            width: `${55 + ((i * 13 + (col.key as string).length * 7) % 35)}%`,
                            animation: "rfPulse 1.5s ease-in-out infinite",
                            animationDelay: `${i * 0.1}s`,
                          }}
                        />
                      </td>
                    ))}
                    <td style={{ width: COL_WIDTHS.act }} />
                  </tr>
                ))}

              {/* Top padding row — fills space above first virtual item */}
              {!grid.isLoading && virtualItems.length > 0 && (
                <tr style={{ height: virtualItems[0]?.start ?? 0 }}>
                  <td
                    colSpan={visibleDataCols.length + 4}
                    style={{ padding: 0, border: "none" }}
                  />
                </tr>
              )}

              {/* Visible virtual rows — handles group headers, data rows, and unloaded skeletons */}
              {!grid.isLoading &&
                virtualItems.map((virtualRow) => {
                  // ── SKELETON ROW — index is beyond loaded data (infinite scroll)
                  // These rows exist in the virtual space but haven't been fetched yet.
                  // Show shimmer so the user sees content is coming, not blank space.
                  if (virtualRow.index >= grid.processedRows.length) {
                    return (
                      <tr
                        key={`unloaded-${virtualRow.index}`}
                        style={{
                          height: ROW_HEIGHT,
                          borderBottom: "1px solid var(--rf-border)",
                        }}
                      >
                        <td
                          style={{
                            width: COL_WIDTHS.cb,
                            borderRight: "1px solid var(--rf-border)",
                          }}
                        />
                        <td
                          style={{
                            width: COL_WIDTHS.rn,
                            borderRight: "1px solid var(--rf-border)",
                            textAlign: "center",
                          }}
                        >
                          <div
                            style={{
                              width: 24,
                              height: 10,
                              borderRadius: 3,
                              background: "var(--rf-border)",
                              margin: "0 auto",
                              animation: "rfPulse 1.5s ease-in-out infinite",
                            }}
                          />
                        </td>
                        <td
                          style={{
                            width: COL_WIDTHS.exp,
                            borderRight: "1px solid var(--rf-border)",
                          }}
                        />
                        {visibleDataCols.map((col, ci) => (
                          <td
                            key={col.key as string}
                            style={{
                              width:
                                grid.columnWidths[col.key as string] ??
                                col.width ??
                                150,
                              borderRight: "1px solid var(--rf-border)",
                              padding: "0 12px",
                              verticalAlign: "middle",
                            }}
                          >
                            <div
                              style={{
                                height: 12,
                                borderRadius: 3,
                                background: "var(--rf-border)",
                                // Vary skeleton widths per column for realistic look
                                width: `${45 + ((virtualRow.index * 7 + ci * 13) % 40)}%`,
                                animation: "rfPulse 1.5s ease-in-out infinite",
                                // Stagger animation so rows pulse sequentially
                                animationDelay: `${(virtualRow.index % 5) * 0.1}s`,
                              }}
                            />
                          </td>
                        ))}
                        <td style={{ width: COL_WIDTHS.act }} />
                      </tr>
                    );
                  }

                  const tanRow = grid.processedRows[virtualRow.index];
                  if (!tanRow) return null;

                  // ── GROUP HEADER ROW
                  if (tanRow.getIsGrouped()) {
                    const groupVal = tanRow.getGroupingValue(
                      tanRow.groupingColumnId ?? "",
                    );
                    const isExpanded = tanRow.getIsExpanded();
                    const groupColDef = props.columns.find(
                      (c) => c.key === tanRow.groupingColumnId,
                    );
                    const opt = groupColDef?.options?.find(
                      (o) => o.value === String(groupVal ?? ""),
                    );
                    return (
                      <tr
                        key={tanRow.id}
                        style={{
                          height: ROW_HEIGHT,
                          borderBottom: "1px solid var(--rf-border)",
                          background: "var(--rf-header)",
                          cursor: "pointer",
                        }}
                        onClick={() => tanRow.toggleExpanded()}
                      >
                        <td
                          style={{
                            width: COL_WIDTHS.cb,
                            borderRight: "1px solid var(--rf-border)",
                          }}
                        />
                        <td
                          style={{
                            width: COL_WIDTHS.rn,
                            borderRight: "1px solid var(--rf-border)",
                            textAlign: "center",
                            fontSize: 11,
                            color: "var(--rf-text-3)",
                            fontFamily: "var(--rf-font-mono)",
                          }}
                        >
                          {tanRow.subRows.length}
                        </td>
                        <td
                          style={{
                            width: COL_WIDTHS.exp,
                            borderRight: "1px solid var(--rf-border)",
                            textAlign: "center",
                            verticalAlign: "middle",
                          }}
                        >
                          <ChevDown
                            style={{
                              width: 13,
                              height: 13,
                              color: "var(--rf-text-3)",
                              transform: isExpanded
                                ? "rotate(0deg)"
                                : "rotate(-90deg)",
                              transition: "transform .15s",
                            }}
                          />
                        </td>
                        <td
                          colSpan={visibleDataCols.length + 1}
                          style={{ padding: "0 12px", verticalAlign: "middle" }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: ".04em",
                                color: "var(--rf-text-3)",
                              }}
                            >
                              {groupColDef?.label ?? tanRow.groupingColumnId}:
                            </span>
                            <span
                              style={{
                                fontSize: 12.5,
                                fontWeight: 600,
                                color: "var(--rf-text-1)",
                              }}
                            >
                              {opt?.label ?? String(groupVal ?? "—")}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--rf-text-3)",
                                marginLeft: 4,
                              }}
                            >
                              ({tanRow.subRows.length}{" "}
                              {tanRow.subRows.length === 1
                                ? "record"
                                : "records"}
                              )
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  // ── DATA ROW
                  const row = tanRow.original;
                  const rowId = row._id;
                  const isDirty = grid.isDirty(row);
                  const hasErrors = Object.keys(row._errors ?? {}).length > 0;
                  const cfResult = grid.evalCF(row);
                  const isKbFocused = kb.kbFocusRowId === rowId;
                  const isSelected = grid.selectedIds.has(rowId);
                  const isPanelOpen = grid.panelRowId === rowId;

                  const rowStyle: React.CSSProperties = {
                    height: ROW_HEIGHT,
                    borderBottom: "1px solid var(--rf-border)",
                    ...(isDirty
                      ? {
                          background: "var(--rf-row-dirty)",
                          borderLeft: "3px solid var(--rf-row-dirty-border)",
                        }
                      : hasErrors
                        ? { borderLeft: "3px solid var(--rf-err)" }
                        : row._new
                          ? { borderLeft: "3px solid var(--rf-ok)" }
                          : isSelected
                            ? { background: "var(--rf-row-selected)" }
                            : cfResult && !isDirty && !hasErrors
                              ? {
                                  background: cfResult.backgroundColor,
                                  color: cfResult.textColor,
                                }
                              : {}),
                    ...(isKbFocused
                      ? {
                          outline: "2px solid var(--rf-accent)",
                          outlineOffset: "-2px",
                        }
                      : {}),
                  };

                  return (
                    <tr
                      key={rowId}
                      data-row-id={rowId}
                      style={rowStyle}
                      onMouseEnter={(e) => {
                        if (!isDirty && !isSelected)
                          (e.currentTarget as HTMLElement).style.background =
                            "var(--rf-row-hover)";
                      }}
                      onMouseLeave={(e) => {
                        const base = isDirty
                          ? "var(--rf-row-dirty)"
                          : isSelected
                            ? "var(--rf-row-selected)"
                            : cfResult && !isDirty && !hasErrors
                              ? cfResult.backgroundColor
                              : "";
                        (e.currentTarget as HTMLElement).style.background =
                          base;
                      }}
                      onClick={() => kb.setFocus(rowId, kb.kbFocusColIdx ?? 0)}
                    >
                      {/* Checkbox */}
                      <td
                        style={{
                          width: COL_WIDTHS.cb,
                          padding: 0,
                          borderRight: "1px solid var(--rf-border)",
                          background: isDirty
                            ? "var(--rf-row-dirty)"
                            : "var(--rf-surface)",
                          position: "sticky",
                          left: pinOffsets["_cb"] ?? 0,
                          zIndex: 20,
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => grid.toggleSelect(rowId)}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: 14,
                            height: 14,
                            accentColor: "var(--rf-accent)",
                            cursor: "pointer",
                          }}
                        />
                      </td>

                      {/* Row # + state dot */}
                      <td
                        style={{
                          width: COL_WIDTHS.rn,
                          padding: 0,
                          borderRight: "1px solid var(--rf-border)",
                          background: "var(--rf-surface)",
                          position: "sticky",
                          left: pinOffsets["_rn"] ?? 40,
                          zIndex: 20,
                          verticalAlign: "middle",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                            height: "100%",
                          }}
                        >
                          <div
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              flexShrink: 0,
                              background: hasErrors
                                ? "var(--rf-err)"
                                : isDirty
                                  ? "var(--rf-row-dirty-border)"
                                  : row._new
                                    ? "var(--rf-text-3)"
                                    : "var(--rf-ok)",
                            }}
                            title={
                              hasErrors
                                ? "Errors"
                                : isDirty
                                  ? "Unsaved"
                                  : row._new
                                    ? "New"
                                    : "Saved"
                            }
                          />
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--rf-text-3)",
                              fontFamily: "var(--rf-font-mono)",
                            }}
                          >
                            {virtualRow.index + 1}
                          </span>
                        </div>
                      </td>

                      {/* Expander */}
                      <td
                        style={{
                          width: COL_WIDTHS.exp,
                          padding: 0,
                          borderRight: "1px solid var(--rf-border)",
                          background: "var(--rf-surface)",
                          position: "sticky",
                          left: pinOffsets["_exp"] ?? 84,
                          zIndex: 20,
                          textAlign: "center",
                          verticalAlign: "middle",
                          boxShadow: !lastPinKey
                            ? "4px 0 10px rgba(15,23,42,.08)"
                            : undefined,
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            isPanelOpen
                              ? grid.closePanel()
                              : grid.openPanel(rowId);
                          }}
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 6,
                            border: `1px solid ${isPanelOpen ? "var(--rf-accent)" : "var(--rf-border)"}`,
                            background: isPanelOpen
                              ? "var(--rf-accent)"
                              : "transparent",
                            color: isPanelOpen ? "#fff" : "var(--rf-text-3)",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          title="Open detail panel"
                        >
                          <ChevronRight style={{ width: 11, height: 11 }} />
                        </button>
                      </td>

                      {/* Data cells */}
                      {visibleDataCols.map((col, cIdx) => {
                        const colKey = col.key as string;
                        const colWidth =
                          grid.columnWidths[colKey] ?? col.width ?? 150;
                        const isPinned = grid.pinnedColumns.has(colKey);
                        const isLastPinCol = lastPinKey === colKey;
                        const isEditing =
                          editingCell?.rowId === rowId &&
                          editingCell?.colKey === colKey;
                        const isKbCell =
                          isKbFocused && kb.kbFocusColIdx === cIdx;
                        const cellVal = grid.getVal(row, colKey);
                        const computedVal = col.computed
                          ? grid.getComputedValue(row, colKey)
                          : undefined;
                        const errMsg = row._errors?.[colKey];
                        const hasErr = !!errMsg;

                        return (
                          <td
                            key={colKey}
                            style={{
                              width: colWidth,
                              padding: 0,
                              height: ROW_HEIGHT,
                              verticalAlign: "middle",
                              position: isPinned ? "sticky" : undefined,
                              left: isPinned ? pinOffsets[colKey] : undefined,
                              zIndex: isEditing
                                ? 25
                                : isPinned
                                  ? 20
                                  : isKbCell
                                    ? 15
                                    : undefined,
                              background: isEditing
                                ? "var(--rf-accent-bg)"
                                : isPinned && !isDirty
                                  ? "var(--rf-surface)"
                                  : undefined,
                              outline: isEditing
                                ? "2px solid var(--rf-accent)"
                                : isKbCell && !isEditing
                                  ? "2px solid var(--rf-accent-br)"
                                  : undefined,
                              outlineOffset:
                                isEditing || isKbCell ? "-2px" : undefined,
                              boxShadow:
                                hasErr && !isEditing
                                  ? "inset 0 0 0 2px var(--rf-err)"
                                  : isLastPinCol
                                    ? "4px 0 10px rgba(15,23,42,.08)"
                                    : undefined,
                              borderRight: "1px solid var(--rf-border)",
                              overflow: "hidden",
                            }}
                            onClick={() => {
                              if (col.type !== "checkbox" && !col.computed)
                                activateCell(rowId, colKey);
                              kb.setFocus(rowId, cIdx);
                            }}
                          >
                            <CellRenderer
                              row={row}
                              colDef={col as ColumnDef}
                              value={cellVal}
                              isEditing={isEditing}
                              isError={hasErr}
                              onCommit={(val) => {
                                grid.markDirty(rowId, colKey, val);
                                deactivateCell();
                              }}
                              onCancel={deactivateCell}
                              {...(computedVal !== undefined && {
                                computedValue: computedVal,
                              })}
                              {...(errMsg !== undefined && {
                                errorMessage: errMsg,
                              })}
                            />
                          </td>
                        );
                      })}

                      {/* Row Actions */}
                      <td
                        style={{
                          width: COL_WIDTHS.act,
                          padding: 0,
                          verticalAlign: "middle",
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                            height: "100%",
                          }}
                        >
                          {isDirty ? (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void grid.saveRow(rowId);
                                }}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: "3px 8px",
                                  borderRadius: 6,
                                  background: "var(--rf-ok-bg)",
                                  color: "#15803D",
                                  border: "1px solid var(--rf-ok-br)",
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                }}
                              >
                                <Save style={{ width: 11, height: 11 }} /> Save
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  grid.discardRow(rowId);
                                }}
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 4,
                                  background: "var(--rf-err-bg)",
                                  color: "var(--rf-err)",
                                  border: "1px solid var(--rf-err-br)",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                                title="Discard"
                              >
                                <X style={{ width: 12, height: 12 }} />
                              </button>
                            </>
                          ) : (
                            <div
                              style={{ display: "flex", gap: 2 }}
                              onMouseEnter={(e) =>
                                ((
                                  e.currentTarget as HTMLElement
                                ).style.opacity = "1")
                              }
                              onMouseLeave={(e) =>
                                ((
                                  e.currentTarget as HTMLElement
                                ).style.opacity = "0")
                              }
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  grid.duplicateRow(rowId);
                                }}
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 4,
                                  border: "none",
                                  background: "transparent",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "var(--rf-text-3)",
                                }}
                                title="Duplicate"
                              >
                                <Copy style={{ width: 12, height: 12 }} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void grid.deleteRow(rowId);
                                }}
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 4,
                                  border: "none",
                                  background: "transparent",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "var(--rf-text-3)",
                                }}
                                title="Delete"
                              >
                                <Trash2 style={{ width: 12, height: 12 }} />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

              {/* Bottom padding row — fills space below last virtual item */}
              {!grid.isLoading &&
                virtualItems.length > 0 &&
                (() => {
                  const lastItem = virtualItems[virtualItems.length - 1];
                  const bottomPad = lastItem
                    ? totalTableSize - lastItem.end
                    : 0;
                  return bottomPad > 0 ? (
                    <tr style={{ height: bottomPad }}>
                      <td
                        colSpan={visibleDataCols.length + 4}
                        style={{ padding: 0, border: "none" }}
                      />
                    </tr>
                  ) : null;
                })()}

              {/* Add record button */}
              {!grid.isLoading && (
                <tr>
                  <td
                    colSpan={visibleDataCols.length + 4}
                    style={{
                      padding: 0,
                      borderTop: "1px solid var(--rf-border)",
                    }}
                  >
                    <button
                      onClick={() => grid.addRow()}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "9px 16px",
                        fontSize: 12.5,
                        fontWeight: 500,
                        color: "var(--rf-text-3)",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        textAlign: "left",
                      }}
                      onMouseEnter={(e) => {
                        const b = e.currentTarget as HTMLButtonElement;
                        b.style.color = "var(--rf-accent)";
                        b.style.background = "var(--rf-row-hover)";
                      }}
                      onMouseLeave={(e) => {
                        const b = e.currentTarget as HTMLButtonElement;
                        b.style.color = "var(--rf-text-3)";
                        b.style.background = "transparent";
                      }}
                    >
                      <Plus style={{ width: 15, height: 15 }} /> Add record
                    </button>
                  </td>
                </tr>
              )}
            </tbody>

            {/* ── TFOOT — Aggregation row ────────────────── */}
            {visibleDataCols.some(
              (c) =>
                grid.aggregations[c.key as string] &&
                grid.aggregations[c.key as string] !== "none",
            ) && (
              <tfoot className="sticky bottom-0 z-40">
                <tr
                  style={{
                    background: "var(--rf-header)",
                    borderTop: "2px solid var(--rf-border)",
                  }}
                >
                  <td
                    style={{
                      width: COL_WIDTHS.cb,
                      borderRight: "1px solid var(--rf-border)",
                    }}
                  />
                  <td
                    style={{
                      width: COL_WIDTHS.rn,
                      borderRight: "1px solid var(--rf-border)",
                    }}
                  />
                  <td
                    style={{
                      width: COL_WIDTHS.exp,
                      borderRight: "1px solid var(--rf-border)",
                    }}
                  />
                  {visibleDataCols.map((col) => {
                    const colKey = col.key as string;
                    const mode = grid.aggregations[colKey] ?? "none";
                    const result =
                      mode !== "none"
                        ? grid.computeAggregation(colKey, mode)
                        : null;
                    return (
                      <td
                        key={colKey}
                        style={{
                          width: grid.columnWidths[colKey] ?? col.width ?? 150,
                          borderRight: "1px solid var(--rf-border)",
                          padding: "4px 10px",
                          verticalAlign: "middle",
                        }}
                      >
                        {result !== null ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: ".05em",
                                color: "var(--rf-text-3)",
                              }}
                            >
                              {mode}
                            </span>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                fontFamily: "var(--rf-font-mono)",
                                color: "var(--rf-accent)",
                              }}
                            >
                              {result}
                            </span>
                          </div>
                        ) : col.type === "number" ? (
                          <button
                            style={{
                              fontSize: 10,
                              color: "var(--rf-text-3)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                            }}
                            onClick={() => grid.setAggregation(colKey, "sum")}
                            title="Click to add aggregation"
                          >
                            +
                          </button>
                        ) : null}
                      </td>
                    );
                  })}
                  <td style={{ width: COL_WIDTHS.act }} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {/* end scroll container */}

        {/* ── FOOTER ──────────────────────────────────────── */}
        <div className="border-t border-rf-border bg-rf-header px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-4 flex-wrap items-center">
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
                className="flex items-center gap-1 text-[11.5px] text-rf-text-3"
              >
                {label}
                <span className="font-semibold font-mono text-rf-text-2">
                  {val}
                </span>
              </div>
            ))}
            {/* isFetchingMore — inline spinner in footer */}
            {grid.isFetchingMore && (
              <div className="flex items-center gap-1.5 text-[11.5px] text-rf-accent">
                <div
                  className="w-3 h-3 border-2 border-rf-accent border-t-transparent rounded-full"
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
      </div>

      {/* ── KB HINT ─────────────────────────────────────── */}
      {kb.kbFocusRowId && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0F172A] text-[#F1F5F9] rounded-rf-xl px-4 py-2.5 flex items-center gap-3 shadow-rf-lg z-[800] text-[11.5px] font-medium pointer-events-none">
          <kbd className="bg-white/15 rounded px-1.5 py-0.5 font-mono text-[10.5px] font-semibold">
            ↑↓←→
          </kbd>{" "}
          Navigate
          <kbd className="bg-white/15 rounded px-1.5 py-0.5 font-mono text-[10.5px] font-semibold">
            Enter
          </kbd>{" "}
          Edit
          <kbd className="bg-white/15 rounded px-1.5 py-0.5 font-mono text-[10.5px] font-semibold">
            Space
          </kbd>{" "}
          Detail panel
          <kbd className="bg-white/15 rounded px-1.5 py-0.5 font-mono text-[10.5px] font-semibold">
            Esc
          </kbd>{" "}
          Exit
        </div>
      )}

      {/* ── DETAIL PANEL (ReaktiformPanel) ───────────────────────── */}
      {props.features?.sidePanel !== false &&
        (() => {
          const panelRow =
            grid.rows.find((r) => r._id === grid.panelRowId) ?? null;
          const panelIdx = grid.rows.findIndex(
            (r) => r._id === grid.panelRowId,
          );
          return (
            <ReaktiformPanel
              row={panelRow as Row<TData> | null}
              columns={props.columns}
              rowIdKey={props.rowIdKey ?? "id"}
              isOpen={!!grid.panelRowId}
              canGoPrev={panelIdx > 0}
              canGoNext={panelIdx < grid.rows.length - 1}
              onPrev={() => {
                if (panelIdx > 0) grid.openPanel(grid.rows[panelIdx - 1]!._id);
              }}
              onNext={() => {
                if (panelIdx < grid.rows.length - 1)
                  grid.openPanel(grid.rows[panelIdx + 1]!._id);
              }}
              onClose={grid.closePanel}
              onSave={(rowId, data) => {
                Object.entries(data).forEach(([k, v]) =>
                  grid.markDirty(rowId, k, v),
                );
                void grid.saveRow(rowId);
              }}
              onDiscard={(rowId) => grid.discardRow(rowId)}
              {...(props.onAddComment !== undefined && {
                onAddComment: props.onAddComment,
              })}
              {...(props.onUploadFile !== undefined && {
                onUploadFile: props.onUploadFile,
              })}
              {...(props.onDeleteAttachment !== undefined && {
                onDeleteAttachment: props.onDeleteAttachment,
              })}
            />
          );
        })()}

      {/* ── FILTER PANEL ────────────────────────────────── */}
      {filterCol &&
        (() => {
          const col = props.columns.find((c) => c.key === filterCol);
          if (!col) return null;
          const current = grid.activeFilters[filterCol];
          return (
            <FilterPanel
              col={col as ColumnDef}
              current={current}
              anchor={filterAnchor}
              onApply={(val) => {
                grid.setFilter(filterCol, val);
                setFilterCol(null);
              }}
              onClear={() => {
                grid.clearFilter(filterCol);
                setFilterCol(null);
              }}
              onClose={() => {
                setFilterCol(null);
                setFilterAnchor(null);
              }}
            />
          );
        })()}

      {/* ── CF PANEL ────────────────────────────────────── */}
      {cfPanelOpen && (
        <CFPanel
          columns={props.columns as ColumnDef[]}
          rules={grid.cfRules}
          onAddRule={grid.addCFRule}
          onUpdateRule={grid.updateCFRule}
          onDeleteRule={grid.deleteCFRule}
          onClose={() => setCfPanelOpen(false)}
        />
      )}

      {/* ── COLUMN VISIBILITY PANEL ─────────────────────── */}
      {colVisPanelOpen && (
        <ColumnVisibilityPanel
          columns={orderedColumns as ColumnDef[]}
          hiddenColumns={grid.hiddenColumns}
          onToggle={(key) => grid.toggleHide(key)}
          onShowAll={() => {
            [...grid.hiddenColumns].forEach((k) => grid.toggleHide(k));
          }}
          onClose={() => setColVisPanelOpen(false)}
        />
      )}

      {/* ── CSS Keyframes ───────────────────────────────── */}
      <style>{`
        @keyframes rfFetch {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(150%); }
          100% { transform: translateX(150%); }
        }
        @keyframes rfPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @keyframes rfSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  COLUMN HEADER (2-row layout)
// ─────────────────────────────────────────────────────────────
type ColumnHeaderProps = {
  col: ColumnDef;
  isPinned: boolean;
  isLastPin: boolean;
  isSorted: boolean;
  sortDir?: "asc" | "desc" | undefined;
  isFiltered: boolean;
  isGrouped: boolean;
  isDragOver: boolean;
  aggregationMode?: string | undefined;
  pinOffset?: number | undefined;
  onSort: () => void;
  onTogglePin: () => void;
  onToggleGroup: () => void;
  onOpenFilter: (btn: HTMLButtonElement) => void;
  onResize: (width: number) => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
  onCycleAggregation?: (() => void) | undefined;
};

function ColumnHeader({
  col,
  isPinned,
  isLastPin,
  isSorted,
  sortDir,
  isFiltered,
  isGrouped,
  isDragOver,
  aggregationMode,
  pinOffset,
  onSort,
  onTogglePin,
  onToggleGroup,
  onOpenFilter,
  onResize,
  onDragStart,
  onDragOver,
  onDragEnd,
  onCycleAggregation,
}: ColumnHeaderProps) {
  const thRef = useRef<HTMLTableCellElement>(null);
  const resizing = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);
  const lastResizeCall = useRef(0);
  // Controls whether the <th> is draggable — only true while over the drag handle
  const [draggable, setDraggable] = useState(false);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault(); // ← prevents any pending dragstart
    resizing.current = true;
    startX.current = e.clientX;
    startW.current = thRef.current?.offsetWidth ?? 0;

    const onMove = (me: MouseEvent) => {
      if (!resizing.current) return;
      const w = Math.max(60, startW.current + (me.clientX - startX.current));

      // 1. Update <th> via direct DOM — no React re-render cost
      if (thRef.current) thRef.current.style.width = `${w}px`;

      // 2. Keep <col> in sync
      const table = thRef.current?.closest("table");
      const thIndex = thRef.current
        ? Array.from(thRef.current.parentElement?.children ?? []).indexOf(
            thRef.current,
          )
        : -1;
      if (table && thIndex >= 0) {
        const colEl = table.querySelector(
          `colgroup col:nth-child(${thIndex + 1})`,
        ) as HTMLElement | null;
        if (colEl) colEl.style.width = `${w}px`;
      }

      // 3. Throttle Zustand to ~60fps
      const now = Date.now();
      if (now - lastResizeCall.current >= 16) {
        lastResizeCall.current = now;
        onResize(w);
      }
    };

    const onUp = (me: MouseEvent) => {
      resizing.current = false;
      const w = Math.max(60, startW.current + (me.clientX - startX.current));
      onResize(w);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const SortIcon = isSorted
    ? sortDir === "asc"
      ? ChevronUp
      : ChevronDown
    : ChevronsUpDown;

  const sortTooltip = !isSorted
    ? "Click to sort ascending"
    : sortDir === "asc"
      ? "Sorted ascending — click for descending"
      : "Sorted descending — click to clear sort";

  return (
    <th
      ref={thRef}
      // draggable is only true when the cursor is over the drag handle (⠿ grip)
      // so resizing never accidentally triggers column reorder
      draggable={draggable}
      onDragStart={(e) => {
        if (resizing.current) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver();
      }}
      onDragEnd={() => {
        setDraggable(false);
        onDragEnd();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDragEnd();
      }}
      className={cn(
        "border-b-2 border-r border-rf-border h-[64px] font-medium select-none",
        "text-rf-text-2 text-left relative",
        isPinned && "sticky z-[45]",
        isLastPin && "shadow-[4px_0_10px_rgba(15,23,42,.08)]",
        isSorted && "bg-rf-header-sorted",
        isFiltered && !isSorted && "bg-rf-accent-bg",
        isGrouped && "bg-rf-purple-bg",
        !isSorted && !isFiltered && !isGrouped && "bg-rf-header",
        isDragOver &&
          "outline outline-2 outline-rf-accent outline-offset-[-2px]",
      )}
      style={
        isPinned && pinOffset !== undefined ? { left: pinOffset } : undefined
      }
    >
      {/* Top row — drag handle + label + sort
          The ⠿ grip icon on the LEFT is the ONLY draggable zone.
          Hovering it sets draggable=true on the <th>.
          Leaving it (or starting a resize) sets draggable=false.
          This mirrors Google Sheets behaviour exactly.             */}
      <div className="flex items-center h-[36px] px-[10px] gap-1">
        {/* Drag grip — only this activates column reorder */}
        <div
          className="flex-shrink-0 cursor-grab active:cursor-grabbing text-rf-text-3 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity mr-0.5"
          style={{ lineHeight: 1 }}
          onMouseEnter={() => setDraggable(true)}
          onMouseLeave={() => {
            if (!resizing.current) setDraggable(false);
          }}
          title="Drag to reorder column"
        >
          {/* 6-dot grip icon — pure SVG, no extra dep */}
          <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
            <circle cx="2.5" cy="2.5" r="1.4" />
            <circle cx="7.5" cy="2.5" r="1.4" />
            <circle cx="2.5" cy="7" r="1.4" />
            <circle cx="7.5" cy="7" r="1.4" />
            <circle cx="2.5" cy="11.5" r="1.4" />
            <circle cx="7.5" cy="11.5" r="1.4" />
          </svg>
        </div>

        {/* Label + sort — clicking here sorts */}
        <div
          className="flex-1 flex items-center gap-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={onSort}
          title={sortTooltip}
        >
          <span
            className={cn(
              "flex-1 overflow-hidden text-ellipsis whitespace-nowrap",
              "uppercase tracking-[.04em] text-[10.5px] font-semibold",
              isSorted && "text-rf-accent",
              isGrouped && "text-rf-purple",
            )}
          >
            {col.label}
          </span>
          {col.required && (
            <span
              className="text-rf-err text-[12px] font-bold flex-shrink-0 -mt-px"
              title="Required"
            >
              *
            </span>
          )}
          {col.computed && (
            <span className="text-[9px] font-bold text-rf-text-3 border border-rf-border rounded px-1 flex-shrink-0">
              fx
            </span>
          )}
          <SortIcon
            className={cn(
              "w-[11px] h-[11px] flex-shrink-0 transition-opacity",
              isSorted
                ? "opacity-100 text-rf-accent"
                : "opacity-0 hover:opacity-100",
            )}
          />
        </div>
      </div>

      {/* Bottom row — controls */}
      <div className="flex items-center gap-0.5 h-[28px] px-2 border-t border-rf-border bg-black/[.015]">
        {/* Filter */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenFilter(e.currentTarget as HTMLButtonElement);
          }}
          className={cn(
            "w-5 h-5 rounded-[3px] flex items-center justify-center transition-colors",
            isFiltered
              ? "text-rf-accent bg-rf-accent-bg"
              : "text-rf-text-3 hover:bg-rf-surface hover:text-rf-text-1 hover:shadow-rf-sm",
          )}
          title={isFiltered ? "Edit filter" : "Add filter"}
        >
          <Filter className="w-[11px] h-[11px]" />
        </button>

        <div className="w-px h-3 bg-rf-border mx-[1px] flex-shrink-0" />

        {/* Pin */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          className={cn(
            "w-5 h-5 rounded-[3px] flex items-center justify-center transition-colors",
            isPinned
              ? "text-rf-accent bg-rf-accent-bg"
              : "text-rf-text-3 hover:bg-rf-surface hover:text-rf-text-1 hover:shadow-rf-sm",
          )}
          title={isPinned ? "Unpin column" : "Pin column"}
        >
          {isPinned ? (
            <PinOff className="w-[11px] h-[11px]" />
          ) : (
            <Pin className="w-[11px] h-[11px]" />
          )}
        </button>

        {/* Group */}
        {col.groupable && (
          <>
            <div className="w-px h-3 bg-rf-border mx-[1px] flex-shrink-0" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleGroup();
              }}
              className={cn(
                "w-5 h-5 rounded-[3px] flex items-center justify-center transition-colors",
                isGrouped
                  ? "text-rf-purple bg-rf-purple-bg"
                  : "text-rf-text-3 hover:bg-rf-surface hover:text-rf-text-1 hover:shadow-rf-sm",
              )}
              title={isGrouped ? "Remove grouping" : "Group by this column"}
            >
              <Group className="w-[11px] h-[11px]" />
            </button>
          </>
        )}

        {/* Aggregation cycle (number columns only) */}
        {col.type === "number" && !col.computed && onCycleAggregation && (
          <>
            <div className="w-px h-3 bg-rf-border mx-[1px] flex-shrink-0" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCycleAggregation();
              }}
              className={cn(
                "h-5 rounded-[3px] flex items-center justify-center transition-colors px-1",
                aggregationMode && aggregationMode !== "none"
                  ? "text-rf-accent bg-rf-accent-bg text-[9px] font-bold uppercase tracking-[.04em]"
                  : "text-rf-text-3 hover:bg-rf-surface hover:text-rf-text-1 text-[9px] hover:shadow-rf-sm",
              )}
              title={`Aggregation: ${aggregationMode ?? "none"} — click to cycle`}
            >
              {aggregationMode && aggregationMode !== "none"
                ? aggregationMode
                : "Σ"}
            </button>
          </>
        )}

        {/* Resize handle — RIGHT edge, pointer changes to col-resize */}
        <div className="flex-1" />
        <div
          className="w-[6px] h-full flex items-center justify-center cursor-col-resize group/resize flex-shrink-0"
          onMouseDown={(e) => {
            // Disable drag while resizing so th.draggable can't fire
            setDraggable(false);
            handleResizeStart(e);
          }}
          onMouseEnter={() => setDraggable(false)}
        >
          <div className="w-[2px] h-[14px] bg-rf-border-strong rounded-sm group-hover/resize:bg-rf-accent transition-colors" />
        </div>
      </div>
    </th>
  );
}

// Memoize ColumnHeader — it renders N times (one per column) and re-renders
// on every scroll event because the parent virtualizer fires. With React.memo
// it only re-renders when its own props change (sort/filter/pin state etc.)
// This is the single biggest scroll-performance win in the entire component.
const ColumnHeaderMemo = React.memo(ColumnHeader);

// ─────────────────────────────────────────────────────────────
//  COLUMN VISIBILITY PANEL — show/hide columns
// ─────────────────────────────────────────────────────────────
function ColumnVisibilityPanel({
  columns,
  hiddenColumns,
  onToggle,
  onShowAll,
  onClose,
}: {
  columns: ColumnDef[];
  hiddenColumns: Set<string>;
  onToggle: (key: string) => void;
  onShowAll: () => void;
  onClose: () => void;
}) {
  const someHidden = hiddenColumns.size > 0;
  const totalVisible = columns.length - hiddenColumns.size;

  return (
    <div className="fixed inset-0 z-[999]" onClick={onClose}>
      <div
        className="absolute right-4 top-20 w-64 bg-rf-surface border border-rf-border rounded-rf-lg shadow-rf-lg"
        style={{ animation: "rfSlideIn .12s ease" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-rf-border">
          <div>
            <div className="text-[11px] font-bold text-rf-text-3 uppercase tracking-[.06em]">
              Columns
            </div>
            <div className="text-[13px] font-semibold text-rf-text-1">
              {totalVisible} / {columns.length} visible
            </div>
          </div>
          <div className="flex items-center gap-2">
            {someHidden && (
              <button
                onClick={onShowAll}
                className="text-[11.5px] font-medium text-rf-accent hover:underline"
              >
                Show all
              </button>
            )}
            <button
              onClick={onClose}
              className="w-6 h-6 rounded flex items-center justify-center text-rf-text-3 hover:bg-rf-header transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Column list */}
        <div className="py-1.5 max-h-[360px] overflow-y-auto">
          {columns.map((col) => {
            const key = col.key as string;
            const visible = !hiddenColumns.has(key);
            return (
              <label
                key={key}
                className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-rf-row-hover transition-colors"
              >
                {/* Toggle switch */}
                <div
                  onClick={(e) => {
                    e.preventDefault();
                    onToggle(key);
                  }}
                  className={cn(
                    "relative w-8 h-[18px] rounded-full flex-shrink-0 transition-colors cursor-pointer",
                    visible ? "bg-rf-accent" : "bg-rf-border",
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform",
                      visible ? "translate-x-[18px]" : "translate-x-[2px]",
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className={cn(
                      "text-[12.5px] font-medium block truncate",
                      visible ? "text-rf-text-1" : "text-rf-text-3",
                    )}
                  >
                    {col.label}
                  </span>
                  {col.computed && (
                    <span className="text-[10px] text-rf-text-3">computed</span>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  ASYNC SELECT FILTER — search box calling loadOptions
//  Used inside FilterPanel for async/creatable columns
// ─────────────────────────────────────────────────────────────
function AsyncSelectFilter({
  loadOptions,
  selected,
  isCreatable,
  onToggle,
}: {
  loadOptions: (input: string) => Promise<import("../../types").SelectOption[]>;
  selected: string[];
  isCreatable: boolean;
  onToggle: (val: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<import("../../types").SelectOption[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce loadOptions calls at 250ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const opts = await loadOptions(query);
        setResults(opts);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, loadOptions]);

  const inp = cn(
    "w-full px-2.5 py-1.5 text-[12.5px] border border-rf-border rounded-rf-md",
    "bg-rf-bg text-rf-text-1 outline-none",
    "focus:border-rf-accent focus:shadow-[0_0_0_3px_rgba(59,91,219,.10)]",
  );

  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-semibold text-rf-text-2 uppercase tracking-[.04em]">
        Search to filter
      </label>
      <input
        className={inp}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Type to search options…"
        autoFocus
      />
      {/* Selected values */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => onToggle(val)}
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-rf-accent text-white"
            >
              {results.find((o) => o.value === val)?.label ?? val}
              <X className="w-2.5 h-2.5" />
            </button>
          ))}
        </div>
      )}
      {/* Results list */}
      <div className="max-h-[140px] overflow-y-auto rounded-rf-md border border-rf-border bg-rf-bg">
        {loading && (
          <div className="px-3 py-2 text-[12px] text-rf-text-3 italic">
            Loading…
          </div>
        )}
        {!loading && results.length === 0 && query && (
          <div className="px-3 py-2 text-[12px] text-rf-text-3 italic">
            No results
          </div>
        )}
        {!loading &&
          results.map((opt) => {
            const isSel = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onToggle(opt.value)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-1.5 text-[12.5px] text-left transition-colors",
                  isSel
                    ? "bg-rf-accent-bg text-rf-accent font-medium"
                    : "hover:bg-rf-row-hover text-rf-text-1",
                )}
              >
                {opt.label}
                {isSel && <span className="text-rf-accent">✓</span>}
              </button>
            );
          })}
        {/* Creatable — add typed value as custom filter */}
        {isCreatable && query && !results.find((o) => o.label === query) && (
          <button
            type="button"
            onClick={() => {
              onToggle(query);
              setQuery("");
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12.5px] text-left hover:bg-rf-row-hover text-rf-text-2 border-t border-rf-border"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-rf-accent">
              + Create
            </span>
            "{query}"
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  CREATABLE FILTER — type and add custom values to filter set
// ─────────────────────────────────────────────────────────────
function CreatableFilter({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (val: string) => void;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const v = input.trim();
    if (v) {
      onToggle(v);
      setInput("");
    }
  };

  const inp = cn(
    "flex-1 px-2.5 py-1.5 text-[12.5px] border border-rf-border rounded-l-rf-md",
    "bg-rf-bg text-rf-text-1 outline-none",
    "focus:border-rf-accent focus:shadow-[0_0_0_3px_rgba(59,91,219,.10)]",
  );

  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-semibold text-rf-text-2 uppercase tracking-[.04em]">
        Filter by value
      </label>
      <div className="flex">
        <input
          className={inp}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a value…"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
        />
        <button
          type="button"
          onClick={add}
          className="px-3 py-1.5 bg-rf-accent text-white text-[12px] font-semibold rounded-r-rf-md border border-rf-accent hover:bg-rf-accent-hover transition-colors"
        >
          Add
        </button>
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => onToggle(val)}
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-rf-accent text-white"
            >
              {val} <X className="w-2.5 h-2.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  FILTER PANEL — positions below the column filter button
// ─────────────────────────────────────────────────────────────
function FilterPanel({
  col,
  current,
  anchor,
  onApply,
  onClear,
  onClose,
}: {
  col: ColumnDef;
  current: FilterValue | undefined;
  anchor: DOMRect | null;
  onApply: (val: FilterValue) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [textVal, setTextVal] = useState(
    current?.type === "text" ? current.text : "",
  );
  const [numMin, setNumMin] = useState(
    current?.type === "number" ? String(current.min ?? "") : "",
  );
  const [numMax, setNumMax] = useState(
    current?.type === "number" ? String(current.max ?? "") : "",
  );
  const [dateFrom, setDateFrom] = useState(
    current?.type === "date" ? (current.from ?? "") : "",
  );
  const [dateTo, setDateTo] = useState(
    current?.type === "date" ? (current.to ?? "") : "",
  );
  const [selVals, setSelVals] = useState<string[]>(
    current?.type === "select" ? current.values : [],
  );
  const [boolVal, setBoolVal] = useState<boolean | null>(
    current?.type === "checkbox" ? current.value : null,
  );

  const handleApply = () => {
    if (col.type === "text") {
      onApply({ type: "text", text: textVal });
    } else if (col.type === "number") {
      onApply({
        type: "number",
        ...(numMin !== "" && { min: Number(numMin) }),
        ...(numMax !== "" && { max: Number(numMax) }),
      });
    } else if (col.type === "date") {
      onApply({
        type: "date",
        ...(dateFrom && { from: dateFrom }),
        ...(dateTo && { to: dateTo }),
      });
    } else if (col.type === "select" || col.type === "multiselect") {
      // If async/creatable with no options but user typed text, treat as text filter
      const hasStaticOptions = (col.options?.length ?? 0) > 0;
      const isAsync = !!col.loadOptions;
      if (!hasStaticOptions && !isAsync && textVal) {
        onApply({ type: "text", text: textVal });
      } else {
        onApply({ type: "select", values: selVals });
      }
    } else if (col.type === "checkbox") {
      onApply({ type: "checkbox", value: boolVal });
    }
  };

  const inp = cn(
    "w-full px-2.5 py-1.5 text-[12.5px] border border-rf-border rounded-rf-md",
    "bg-rf-bg text-rf-text-1 outline-none",
    "focus:border-rf-accent focus:shadow-[0_0_0_3px_rgba(59,91,219,.10)]",
  );

  // Calculate position: below the filter button, left-aligned to it
  // Clamp to viewport so panel never goes off-screen right edge
  const PANEL_WIDTH = 288;
  const left = anchor
    ? Math.min(anchor.left, window.innerWidth - PANEL_WIDTH - 8)
    : window.innerWidth - PANEL_WIDTH - 8;
  const top = anchor ? anchor.bottom + 4 : 100;

  return (
    <div className="fixed inset-0 z-[999]" onClick={onClose}>
      <div
        className="absolute w-72 bg-rf-surface border border-rf-border rounded-rf-lg shadow-rf-lg"
        style={{
          top,
          left,
          width: PANEL_WIDTH,
          animation: "rfSlideIn .12s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-rf-border">
          <div>
            <div className="text-[11px] font-bold text-rf-text-3 uppercase tracking-[.06em]">
              Filter
            </div>
            <div className="text-[13px] font-semibold text-rf-text-1">
              {col.label}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-rf-md flex items-center justify-center text-rf-text-3 hover:bg-rf-header transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Text filter */}
          {col.type === "text" && (
            <div>
              <label className="block text-[11px] font-semibold text-rf-text-2 uppercase tracking-[.04em] mb-1.5">
                Contains
              </label>
              <input
                className={inp}
                value={textVal}
                onChange={(e) => setTextVal(e.target.value)}
                placeholder={`Search ${col.label.toLowerCase()}…`}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleApply();
                }}
              />
            </div>
          )}

          {/* Number filter */}
          {col.type === "number" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-rf-text-2 uppercase tracking-[.04em] mb-1.5">
                  Min
                </label>
                <input
                  className={inp}
                  type="number"
                  value={numMin}
                  onChange={(e) => setNumMin(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-rf-text-2 uppercase tracking-[.04em] mb-1.5">
                  Max
                </label>
                <input
                  className={inp}
                  type="number"
                  value={numMax}
                  onChange={(e) => setNumMax(e.target.value)}
                  placeholder="∞"
                />
              </div>
            </div>
          )}

          {/* Date filter */}
          {col.type === "date" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-rf-text-2 uppercase tracking-[.04em] mb-1.5">
                  From
                </label>
                <input
                  className={cn(inp, "font-mono")}
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-rf-text-2 uppercase tracking-[.04em] mb-1.5">
                  To
                </label>
                <input
                  className={cn(inp, "font-mono")}
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Select/Multiselect filter — 3 variants:
              a) static options  → pill toggles (existing)
              b) async options   → search input that calls loadOptions
              c) creatable       → text input + add custom values        */}
          {(col.type === "select" || col.type === "multiselect") &&
            (() => {
              const hasStaticOptions = (col.options?.length ?? 0) > 0;
              const isAsync = !!col.loadOptions;
              const isCreatable = !!col.onCreateOption;

              // ── a) Static options — pill toggle grid
              if (hasStaticOptions && !isAsync) {
                return (
                  <div>
                    <label className="block text-[11px] font-semibold text-rf-text-2 uppercase tracking-[.04em] mb-1.5">
                      Include any of
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-[180px] overflow-y-auto">
                      {(col.options ?? []).map((opt) => {
                        const isSel = selVals.includes(opt.value);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              setSelVals(
                                isSel
                                  ? selVals.filter((v) => v !== opt.value)
                                  : [...selVals, opt.value],
                              )
                            }
                            className={cn(
                              "inline-flex items-center gap-1 text-[11.5px] font-medium px-2.5 py-1 rounded-full border transition-all",
                              isSel
                                ? "bg-rf-accent text-white border-rf-accent"
                                : "bg-rf-header text-rf-text-2 border-rf-border hover:border-rf-accent-br hover:bg-rf-accent-bg hover:text-rf-accent",
                            )}
                          >
                            {isSel && <span>✓</span>}
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              // ── b) Async options — search box that calls loadOptions
              if (isAsync) {
                return (
                  <AsyncSelectFilter
                    loadOptions={col.loadOptions!}
                    selected={selVals}
                    isCreatable={isCreatable}
                    onToggle={(val) =>
                      setSelVals((prev) =>
                        prev.includes(val)
                          ? prev.filter((v) => v !== val)
                          : [...prev, val],
                      )
                    }
                  />
                );
              }

              // ── c) Creatable without async — text input to add custom values
              if (isCreatable) {
                return (
                  <CreatableFilter
                    selected={selVals}
                    onToggle={(val) =>
                      setSelVals((prev) =>
                        prev.includes(val)
                          ? prev.filter((v) => v !== val)
                          : [...prev, val],
                      )
                    }
                  />
                );
              }

              // Fallback — no options at all, treat like text
              return (
                <div>
                  <label className="block text-[11px] font-semibold text-rf-text-2 uppercase tracking-[.04em] mb-1.5">
                    Contains
                  </label>
                  <input
                    className={inp}
                    value={textVal}
                    onChange={(e) => setTextVal(e.target.value)}
                    placeholder="Filter value…"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleApply();
                    }}
                  />
                </div>
              );
            })()}

          {/* Checkbox filter */}
          {col.type === "checkbox" && (
            <div>
              <label className="block text-[11px] font-semibold text-rf-text-2 uppercase tracking-[.04em] mb-1.5">
                Value
              </label>
              <div className="flex gap-2">
                {([null, true, false] as const).map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => setBoolVal(v)}
                    className={cn(
                      "flex-1 py-1.5 text-[12px] font-medium rounded-rf-md border transition-colors",
                      boolVal === v
                        ? "bg-rf-accent text-white border-rf-accent"
                        : "bg-rf-surface text-rf-text-2 border-rf-border hover:bg-rf-header",
                    )}
                  >
                    {v === null ? "All" : v ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 pb-4">
          <button
            onClick={handleApply}
            className="flex-1 py-2 text-[12.5px] font-semibold rounded-rf-md bg-rf-accent text-white hover:bg-rf-accent-hover transition-colors"
          >
            Apply
          </button>
          <button
            onClick={onClear}
            className="px-4 py-2 text-[12.5px] font-medium rounded-rf-md border border-rf-border bg-rf-surface text-rf-text-2 hover:bg-rf-header transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  CF PANEL — conditional formatting rules editor
// ─────────────────────────────────────────────────────────────
const CF_COLORS = [
  { label: "Red", bg: "#FFF1F2", text: "#991B1B" },
  { label: "Orange", bg: "#FFF7ED", text: "#9A3412" },
  { label: "Yellow", bg: "#FEFCE8", text: "#854D0E" },
  { label: "Green", bg: "#F0FDF4", text: "#166534" },
  { label: "Blue", bg: "#EFF6FF", text: "#1E40AF" },
  { label: "Purple", bg: "#FAF5FF", text: "#6B21A8" },
];

const CF_OPS = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
  { value: "gte", label: ">=" },
  { value: "lte", label: "<=" },
  { value: "contains", label: "contains" },
  { value: "in", label: "is one of" },
];

function CFPanel({
  columns,
  rules,
  onAddRule,
  onUpdateRule,
  onDeleteRule,
  onClose,
}: {
  columns: ColumnDef[];
  rules: CFRule[];
  onAddRule: () => void;
  onUpdateRule: (id: string, updates: Partial<CFRule>) => void;
  onDeleteRule: (id: string) => void;
  onClose: () => void;
}) {
  const inp = cn(
    "px-2 py-1 text-[12px] border border-rf-border rounded-rf-md",
    "bg-rf-bg text-rf-text-1 outline-none focus:border-rf-accent",
  );

  return (
    <div
      className="fixed inset-0 z-[900] flex items-start justify-end pt-14 pr-4"
      onClick={onClose}
    >
      <div
        className="w-[480px] max-h-[80vh] bg-rf-surface border border-rf-border rounded-rf-lg shadow-rf-lg flex flex-col overflow-hidden"
        style={{ animation: "rfSlideIn .15s ease" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-rf-border bg-rf-header flex-shrink-0">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-purple-600" />
            <span className="text-[14px] font-semibold text-rf-text-1">
              Conditional Formatting
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-rf-md flex items-center justify-center text-rf-text-3 hover:bg-rf-surface transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Rules list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {rules.length === 0 && (
            <div className="text-center py-8 text-[12.5px] text-rf-text-3 italic">
              No rules yet. Add a rule to highlight rows based on conditions.
            </div>
          )}
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="border border-rf-border rounded-rf-lg p-3 bg-rf-bg space-y-2.5"
            >
              {/* Rule header */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(e) =>
                    onUpdateRule(rule.id, { enabled: e.target.checked })
                  }
                  className="w-[13px] h-[13px] accent-[var(--rf-accent)]"
                />
                <input
                  className={cn(inp, "flex-1")}
                  value={rule.label}
                  onChange={(e) =>
                    onUpdateRule(rule.id, { label: e.target.value })
                  }
                  placeholder="Rule name…"
                />
                <select
                  className={inp}
                  value={rule.logic}
                  onChange={(e) =>
                    onUpdateRule(rule.id, {
                      logic: e.target.value as "AND" | "OR",
                    })
                  }
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
                <button
                  onClick={() => onDeleteRule(rule.id)}
                  className="w-6 h-6 rounded flex items-center justify-center text-rf-text-3 hover:text-rf-err hover:bg-rf-err-bg transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              {/* Conditions */}
              {rule.conditions.map((cond, ci) => (
                <div key={ci} className="flex items-center gap-1.5 flex-wrap">
                  <select
                    className={cn(inp, "flex-1 min-w-[100px]")}
                    value={cond.field}
                    onChange={(e) => {
                      const conds = [...rule.conditions];
                      conds[ci] = { ...conds[ci]!, field: e.target.value };
                      onUpdateRule(rule.id, { conditions: conds });
                    }}
                  >
                    {columns
                      .filter((c) => !c.computed)
                      .map((c) => (
                        <option key={c.key as string} value={c.key as string}>
                          {c.label}
                        </option>
                      ))}
                  </select>
                  <select
                    className={inp}
                    value={cond.op}
                    onChange={(e) => {
                      const conds = [...rule.conditions];
                      conds[ci] = {
                        ...conds[ci]!,
                        op: e.target.value as CFConditionOperator,
                      };
                      onUpdateRule(rule.id, { conditions: conds });
                    }}
                  >
                    {CF_OPS.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className={cn(inp, "w-24")}
                    value={cond.value}
                    onChange={(e) => {
                      const conds = [...rule.conditions];
                      conds[ci] = { ...conds[ci]!, value: e.target.value };
                      onUpdateRule(rule.id, { conditions: conds });
                    }}
                    placeholder="value"
                  />
                  {rule.conditions.length > 1 && (
                    <button
                      onClick={() =>
                        onUpdateRule(rule.id, {
                          conditions: rule.conditions.filter(
                            (_, i) => i !== ci,
                          ),
                        })
                      }
                      className="text-rf-text-3 hover:text-rf-err"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}

              {/* Add condition */}
              <button
                onClick={() =>
                  onUpdateRule(rule.id, {
                    conditions: [
                      ...rule.conditions,
                      {
                        field:
                          (columns.find((c) => !c.computed)?.key as string) ??
                          "",
                        op: "eq",
                        value: "",
                      },
                    ],
                  })
                }
                className="text-[11.5px] text-rf-accent hover:underline"
              >
                + Add condition
              </button>

              {/* Color picker */}
              <div className="flex items-center gap-2 pt-1 border-t border-rf-border">
                <span className="text-[11px] font-semibold text-rf-text-3 uppercase tracking-[.04em]">
                  Color:
                </span>
                <div className="flex gap-1.5 flex-wrap">
                  {CF_COLORS.map((c) => (
                    <button
                      key={c.label}
                      title={c.label}
                      onClick={() =>
                        onUpdateRule(rule.id, {
                          backgroundColor: c.bg,
                          textColor: c.text,
                        })
                      }
                      className={cn(
                        "w-5 h-5 rounded-full border-2 transition-all",
                        rule.backgroundColor === c.bg
                          ? "border-rf-accent scale-110"
                          : "border-transparent hover:scale-105",
                      )}
                      style={{ background: c.bg }}
                    />
                  ))}
                </div>
                {/* Preview */}
                <div
                  className="ml-auto px-2.5 py-0.5 rounded text-[11.5px] font-medium border"
                  style={{
                    background: rule.backgroundColor,
                    color: rule.textColor,
                    borderColor: rule.backgroundColor,
                  }}
                >
                  Preview
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-rf-border bg-rf-header">
          <button
            onClick={onAddRule}
            className="w-full py-2 text-[12.5px] font-semibold rounded-rf-md border-2 border-dashed border-rf-border text-rf-text-2 hover:border-rf-accent hover:text-rf-accent hover:bg-rf-accent-bg transition-all"
          >
            + Add Rule
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  PUBLIC Reaktiform — wraps inner with store provider
//
//  Note: React.memo on a generic component requires a cast trick.
//  ReaktiformInner is the performance-critical component — it only
//  re-renders when GridConfig props actually change.
// ─────────────────────────────────────────────────────────────
export function Reaktiform<TData = Record<string, unknown>>(
  props: GridConfig<TData>,
) {
  return (
    <GridStoreProvider storageKey={props?.storageKey}>
      <ReaktiformInner {...props} />
    </GridStoreProvider>
  );
}
