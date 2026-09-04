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
import { GridStoreProvider, useGridStore } from "../../store";
import { useReaktiform } from "../../hooks/useReaktiform";
import { useKeyboardNav } from "../../hooks/useKeyboardNav";
import { mergedRow } from "../cells/CellRenderer";
import { ReaktiformPanel } from "../ReaktiformPanel/ReaktiformPanel";
import { ColumnHeaderMemo } from "./ColumnHeader";
import { GridRow } from "./GridRow";
import { ColumnVisibilityPanel } from "../overlays/ColumnVisibilityPanel";
import { PanelModePanel } from "../overlays/PanelModePanel";
import { CFPanel } from "../overlays/CFPanel";
import { FilterPanel } from "../filters/FilterPanel";
import { Toolbar } from "../toolbar/Toolbar";
import { BulkActionsBar } from "../toolbar/BulkActionsBar";
import { FooterStatsBar } from "../toolbar/FooterStatsBar";
import { ActiveFiltersBar } from "../filters/ActiveFiltersBar";
import type { GridConfig, Row, ColumnDef } from "../../types";

// ── Icons
import { Plus, ChevronRight, ChevronDown as ChevDown } from "lucide-react";

// System column widths — a genuine constant (never depends on props/state).
// Hoisted to module scope so its identity is stable across every render of
// every grid instance — a fresh object literal here would defeat
// React.memo(GridRow) for every row, every render, since it's passed
// straight through as GridRow's colWidths prop.
const COL_WIDTHS = { cb: 40, rn: 44, exp: 36, act: 88 };

// ─────────────────────────────────────────────────────────────
//  INNER GRID (has access to store context)
// ─────────────────────────────────────────────────────────────
function ReaktiformInner<TData = Record<string, unknown>>(
  props: GridConfig<TData>,
) {
  const grid = useReaktiform<TData>(props);

  // Single read of the whole editingCell object — only used by the
  // click-away handler below. Per-cell isEditing checks read their own
  // narrower selector further down (see the DATA ROW render loop).
  const editingCell = useGridStore((s) => s.editingCell);

  // ── Filter panel: which column is open + anchor rect for positioning
  const [filterCol, setFilterCol] = useState<string | null>(null);
  const [filterAnchor, setFilterAnchor] = useState<DOMRect | null>(null);

  // ── Feature 6: show only rows with errors
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);

  // ── Feature 3: error dot popover — which rowId's error popover is open
  const [errorPopoverRowId, setErrorPopoverRowId] = useState<string | null>(
    null,
  );
  // Stable, rowId-parameterized wrappers — passed down to GridRow, must stay
  // stable or they defeat GridRow's React.memo (same reasoning as
  // toggleExpandedRow above).
  const toggleErrorPopover = useCallback(
    (rowId: string) =>
      setErrorPopoverRowId((prev) => (prev === rowId ? null : rowId)),
    [],
  );
  const closeErrorPopover = useCallback(() => setErrorPopoverRowId(null), []);

  // Auto-open the error popover for a row when its save fails.
  // grid.onRowSaveErrorRef is set here so useDraft can call back into this component.
  // Uses the row's internal _id (not the rowIdKey) for reliable lookup.
  useEffect(() => {
    grid.onRowSaveErrorRef.current = (rowInternalId: string) => {
      setErrorPopoverRowId(rowInternalId);
    };
    return () => {
      grid.onRowSaveErrorRef.current = undefined;
    };
  }, [grid.onRowSaveErrorRef]);

  // ── Detail panel open/close notifications.
  // Callbacks live in a ref so a consumer's inline arrow function doesn't make
  // this effect re-run (and re-fire) on every render — only an actual change of
  // the open row does. Page mode leans on these for URL sync, since reaktiform
  // deliberately never touches browser history itself.
  const onPanelOpenRef = useRef(props.onPanelOpen);
  const onPanelCloseRef = useRef(props.onPanelClose);
  onPanelOpenRef.current = props.onPanelOpen;
  onPanelCloseRef.current = props.onPanelClose;

  const panelRowIdForEvents = grid.panelRowId;
  const prevPanelRowId = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevPanelRowId.current;
    prevPanelRowId.current = panelRowIdForEvents;

    if (panelRowIdForEvents) {
      // Fires again when prev/next moves to another record — the panel is now
      // open on a different row, which is what a URL sync needs to hear.
      const opened = grid.rows.find((r) => r._id === panelRowIdForEvents);
      if (opened) onPanelOpenRef.current?.(opened as TData);
    } else if (prev) {
      // `prev` guard: don't fire a spurious close on mount, when the panel was
      // never open in the first place.
      onPanelCloseRef.current?.();
    }
    // grid.rows is deliberately not a dep — this fires on OPEN/CLOSE, not on
    // every edit to the open row. The closure is from the render in which
    // panelRowId changed, so the rows it reads are current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelRowIdForEvents]);

  // ── Expanded rows state — tracks which row IDs are expanded inline
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());
  // useCallback with an empty dep array — safe since it only uses the
  // functional-update form of setExpandedRowIds. Passed down to GridRow,
  // must stay stable or it defeats GridRow's React.memo.
  const toggleExpandedRow = useCallback((rowId: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      next.has(rowId) ? next.delete(rowId) : next.add(rowId);
      return next;
    });
  }, []);

  // ── Sync / Refresh loading state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Column visibility feature flags (from props.features)
  // selectionMode='none' hides the checkbox column entirely; 'single' shows it
  const selectionMode = props.selectionMode ?? "multi";
  const showSelectColumn =
    selectionMode !== "none" && props.features?.showSelectColumn !== false;
  const showRowNumbers = props.features?.showRowNumbers !== false;
  const showExpanderColumn =
    props.features?.showExpanderColumn !== false &&
    props.features?.sidePanel !== false;
  const showActionsColumn = props.features?.showActionsColumn !== false;

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
  const [cfAnchor, setCfAnchor] = useState<DOMRect | null>(null);
  const [colVisAnchor, setColVisAnchor] = useState<DOMRect | null>(null);

  // ── Column visibility panel open
  const [colVisPanelOpen, setColVisPanelOpen] = useState(false);
  const [panelModeAnchor, setPanelModeAnchor] = useState<DOMRect | null>(null);
  const [panelModePanelOpen, setPanelModePanelOpen] = useState(false);

  const deactivateCell = useCallback(
    () => grid.setEditingCell(null, null),
    [grid.setEditingCell],
  );

  // ── Whether a cell can be edited: not read-only, row/col-level permissions
  // allow it, not a checkbox (toggled via its own control, not text-edit),
  // and not a computed column unless explicitly marked editableWhenComputed.
  function canEditCell(row: Row<TData>, col: ColumnDef<TData>): boolean {
    const colKey = col.key as string;
    const merged = mergedRow<TData>(row);
    const isReadOnly =
      col.readOnly === true ||
      (typeof col.readOnly === "function" && col.readOnly(merged));
    return Boolean(
      !isReadOnly &&
      grid.permissions.canEditRow(row as Record<string, unknown>) &&
      grid.permissions.canEditCol(colKey) &&
      col.type !== "checkbox" &&
      (!col.computed || col.editableWhenComputed),
    );
  }

  // visibleRows — memoized to avoid allocating a new array on every scroll render
  const visibleRows = useMemo(
    () => grid.processedRows.map((r) => r.original),
    [grid.processedRows],
  );

  // Refs so activateCellIfAllowed can read the latest row list / gating
  // logic without depending on them — visibleRows and canEditCell both
  // change identity often (every edit), and putting them in activateCell's
  // deps would force useKeyboardNav's window-listener effect to
  // teardown/re-attach on every edit (see the openPanel comment above).
  const visibleRowsRef = useRef(visibleRows);
  visibleRowsRef.current = visibleRows;
  const canEditCellRef = useRef(canEditCell);
  canEditCellRef.current = canEditCell;

  // Shared gate for both the cell onClick handler and useKeyboardNav's
  // Enter-to-edit — single choke point so readOnly / permissions / Edit
  // Lock are enforced identically from mouse and keyboard.
  const activateCellIfAllowed = useCallback(
    (rowId: string, colKey: string) => {
      const row = visibleRowsRef.current.find((r) => r._id === rowId);
      const col = props.columns.find((c) => c.key === colKey);
      if (!row || !col || !canEditCellRef.current(row, col)) return;
      grid.activateCell(rowId, colKey);
    },
    [props.columns, grid.activateCell],
  );

  // ── Stable wrappers around per-keystroke-unstable grid functions, passed
  // down to GridRow. markDirty/discardRow/duplicateRow/saveRow/deleteRow
  // (useDraft.ts) all have `rows` in their useCallback deps — a genuinely
  // fresh row array on every edit, by design — so their identity changes
  // on every keystroke anywhere in the grid. canEditCell (this file) and
  // getComputedValue (useComputedColumns.ts) are plain functions, never
  // memoized. grid.permissions is a fresh object literal every render of
  // useReaktiform. Passed straight through, any of these would defeat
  // React.memo(GridRow) for every row, every render — same reasoning as
  // visibleRowsRef/canEditCellRef above, just one layer further down.
  // Deliberately NOT "fixed" inside useDraft/useComputedColumns/
  // useReaktiform themselves — those are shared, load-bearing hooks
  // (validation/save/undo pipeline, the Edit Lock invariant) well beyond
  // row rendering; the instability is absorbed here instead.
  const markDirtyRef = useRef(grid.markDirty);
  markDirtyRef.current = grid.markDirty;
  const discardRowRef = useRef(grid.discardRow);
  discardRowRef.current = grid.discardRow;
  const duplicateRowRef = useRef(grid.duplicateRow);
  duplicateRowRef.current = grid.duplicateRow;
  const saveRowRef = useRef(grid.saveRow);
  saveRowRef.current = grid.saveRow;
  const deleteRowRef = useRef(grid.deleteRow);
  deleteRowRef.current = grid.deleteRow;
  const getComputedValueRef = useRef(grid.getComputedValue);
  getComputedValueRef.current = grid.getComputedValue;
  const permissionsRef = useRef(grid.permissions);
  permissionsRef.current = grid.permissions;

  const markDirtyStable = useCallback(
    (rowId: string, colKey: string, val: unknown) =>
      markDirtyRef.current(rowId, colKey, val),
    [],
  );
  const discardRowStable = useCallback(
    (rowId: string) => discardRowRef.current(rowId),
    [],
  );
  const duplicateRowStable = useCallback(
    (rowId: string) => duplicateRowRef.current(rowId),
    [],
  );
  const saveRowStable = useCallback(
    (rowId: string) => saveRowRef.current(rowId),
    [],
  );
  const deleteRowStable = useCallback(
    (rowId: string) => deleteRowRef.current(rowId),
    [],
  );
  const getComputedValueStable = useCallback(
    (row: Row<TData>, colKey: string) =>
      getComputedValueRef.current(row, colKey),
    [],
  );
  const canEditCellStable = useCallback(
    (row: Row<TData>, col: ColumnDef<TData>) =>
      canEditCellRef.current(row, col),
    [],
  );
  const canDuplicateRowStable = useCallback(
    (row: Record<string, unknown>) =>
      permissionsRef.current.canDuplicateRow(row),
    [],
  );
  const canDeleteRowStable = useCallback(
    (row: Record<string, unknown>) => permissionsRef.current.canDeleteRow(row),
    [],
  );

  // ── Dirty count
  const dirtyCount = grid.dirtyCount;

  // ── Scroll container ref (required by TanStack Virtual)
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Ref to the currently-active (being-edited) cell's <td>, so the
  // scroll container's outer click handler can tell an inside click
  // (e.g. repositioning the text cursor) apart from a genuine click-away.
  const activeCellRef = useRef<HTMLTableCellElement | null>(null);

  // ── Measured (not hardcoded) sticky thead/tfoot heights, fed to the
  // virtualizer as scrollPaddingStart/End so keyboard-nav auto-scroll
  // knows not to land a focused row underneath either sticky element.
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const tfootRef = useRef<HTMLTableSectionElement>(null);

  // ── Column drag-reorder state
  const dragColRef = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  // ── Column order (respects user drag-reorder)
  const orderedColumns = useMemo(() => {
    const order = grid.columnOrder;
    if (!order.length) return props.columns;
    const map = new Map(props.columns.map((c) => [c.key as string, c]));
    const sorted = order
      .map((k) => map.get(k))
      .filter(Boolean) as typeof props.columns;
    const inOrder = new Set(order);
    props.columns.forEach((c) => {
      if (!inOrder.has(c.key as string)) sorted.push(c);
    });
    return sorted;
  }, [props.columns, grid.columnOrder]);

  // Memoized — passed down to GridRow, must stay stable across renders
  // where the underlying column set hasn't actually changed, or it defeats
  // GridRow's React.memo on every render regardless of everything else.
  const visibleDataCols = useMemo(
    () =>
      orderedColumns.filter((c) => !grid.hiddenColumns.has(c.key as string)),
    [orderedColumns, grid.hiddenColumns],
  );

  // Total table width — only count visible system columns
  const totalWidth =
    (showSelectColumn ? COL_WIDTHS.cb : 0) +
    (showRowNumbers ? COL_WIDTHS.rn : 0) +
    (showExpanderColumn ? COL_WIDTHS.exp : 0) +
    visibleDataCols.reduce(
      (sum, c) => sum + (grid.columnWidths[c.key as string] ?? c.width ?? 150),
      0,
    ) +
    (showActionsColumn ? COL_WIDTHS.act : 0);

  // Pin offsets — computed from visible system columns. Memoized for the
  // same reason as visibleDataCols above (passed down to GridRow).
  const pinOffsets = useMemo(() => {
    const offsets: Record<string, number> = {
      _cb: 0,
      _rn: showSelectColumn ? COL_WIDTHS.cb : 0,
      _exp:
        (showSelectColumn ? COL_WIDTHS.cb : 0) +
        (showRowNumbers ? COL_WIDTHS.rn : 0),
    };
    let left =
      (showSelectColumn ? COL_WIDTHS.cb : 0) +
      (showRowNumbers ? COL_WIDTHS.rn : 0) +
      (showExpanderColumn ? COL_WIDTHS.exp : 0);
    orderedColumns
      .filter(
        (c) =>
          grid.pinnedColumns.has(c.key as string) &&
          !grid.hiddenColumns.has(c.key as string),
      )
      .forEach((c) => {
        offsets[c.key as string] = left;
        left += grid.columnWidths[c.key as string] ?? c.width ?? 150;
      });
    return offsets;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    orderedColumns,
    grid.pinnedColumns,
    grid.hiddenColumns,
    grid.columnWidths,
    showSelectColumn,
    showRowNumbers,
    showExpanderColumn,
  ]);

  // Total width of the pinned-column region (leading system columns +
  // user-pinned data columns) — the left "safe zone" keyboard-nav
  // auto-scroll must keep a focused non-pinned cell clear of. Kept as a
  // sibling memo rather than folded into pinOffsets' return shape, since
  // pinOffsets[key] is bracket-indexed at multiple call sites in this file
  // and GridRow.tsx.
  const totalPinnedWidth = useMemo(() => {
    const leadingWidth =
      (showSelectColumn ? COL_WIDTHS.cb : 0) +
      (showRowNumbers ? COL_WIDTHS.rn : 0) +
      (showExpanderColumn ? COL_WIDTHS.exp : 0);
    return orderedColumns
      .filter(
        (c) =>
          grid.pinnedColumns.has(c.key as string) &&
          !grid.hiddenColumns.has(c.key as string),
      )
      .reduce(
        (sum, c) => sum + (grid.columnWidths[c.key as string] ?? c.width ?? 150),
        leadingWidth,
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    orderedColumns,
    grid.pinnedColumns,
    grid.hiddenColumns,
    grid.columnWidths,
    showSelectColumn,
    showRowNumbers,
    showExpanderColumn,
  ]);

  // Prefix-summed left edge (content-space px) of each visible data column,
  // indexed identically to visibleDataCols/colIdx — lets keyboard-nav
  // compute horizontal scroll purely arithmetically, no DOM reads.
  const colLeftOffsets = useMemo(() => {
    const leadingWidth =
      (showSelectColumn ? COL_WIDTHS.cb : 0) +
      (showRowNumbers ? COL_WIDTHS.rn : 0) +
      (showExpanderColumn ? COL_WIDTHS.exp : 0);
    const offsets: number[] = [];
    let left = leadingWidth;
    visibleDataCols.forEach((c) => {
      offsets.push(left);
      left += grid.columnWidths[c.key as string] ?? c.width ?? 150;
    });
    return offsets;
  }, [
    visibleDataCols,
    grid.columnWidths,
    showSelectColumn,
    showRowNumbers,
    showExpanderColumn,
  ]);

  const lastPinKey = useMemo(() => {
    const pinnedList = orderedColumns.filter(
      (c) =>
        grid.pinnedColumns.has(c.key as string) &&
        !grid.hiddenColumns.has(c.key as string),
    );
    return pinnedList.at(-1)?.key as string | undefined;
  }, [orderedColumns, grid.pinnedColumns, grid.hiddenColumns]);

  // ── Stable per-column callbacks for ColumnHeaderMemo
  // Inline arrows inside .map() recreate on every render, defeating React.memo.
  // We build Maps keyed by colKey so the identity is stable between renders
  // as long as the underlying grid state hasn't changed for that column.
  const colCallbacks = useMemo(() => {
    const AGG_CYCLE = ["none", "sum", "avg", "min", "max", "count"] as const;
    type AggMode = (typeof AGG_CYCLE)[number];
    const onSort = new Map<string, (e: React.MouseEvent) => void>();
    const onTogglePin = new Map<string, () => void>();
    const onToggleGroup = new Map<string, (isGrouped: boolean) => void>();
    const onOpenFilter = new Map<string, (btn: HTMLButtonElement) => void>();
    const onResize = new Map<string, (w: number) => void>();
    const onCycleAgg = new Map<string, () => void>();

    orderedColumns.forEach((col) => {
      const k = col.key as string;
      // Shift+click = multi-sort (append to sort stack), plain click = single sort
      if (col.sortable !== false) {
        onSort.set(k, (e: React.MouseEvent) => {
          if (e.shiftKey) {
            grid.setSortMulti(k);
          } else {
            grid.setSort(k);
          }
        });
      }
      onTogglePin.set(k, () => grid.togglePin(k));
      onToggleGroup.set(k, (grouped: boolean) =>
        grid.setGroupBy(grouped ? null : k),
      );
      if (col.filterable !== false) {
        onOpenFilter.set(k, (btn: HTMLButtonElement) => openFilter(k, btn));
      }
      if (col.resizable !== false) {
        onResize.set(k, (w: number) => grid.setColumnWidth(k, w));
      }
      if (
        col.type === "number" &&
        !col.computed &&
        col.aggregatable !== false
      ) {
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
    grid.setSortMulti,
    grid.togglePin,
    grid.setGroupBy,
    grid.setColumnWidth,
    grid.setAggregation,
    openFilter,
  ]);
  // ── displayRows — respects showErrorsOnly filter.
  // When showErrorsOnly is ON we filter processedRows to only those with
  // validation errors. The virtualizer count updates accordingly.
  const displayRows = useMemo(() => {
    if (!showErrorsOnly) return grid.processedRows;
    return grid.processedRows.filter(
      (r) => Object.keys(r.original._errors ?? {}).length > 0,
    );
  }, [showErrorsOnly, grid.processedRows]);

  const ROW_HEIGHT = props.rowHeight ?? 46;

  // Compute the size of each virtual item accounting for expanded rows.
  // When a row is expanded, its virtual item must include both the data row
  // height AND the expanded content height. The virtualizer calls this per-index
  // so it stays correct as rows expand/collapse without measuring the DOM.
  const EXPANDED_HEIGHT = props.expandedRowHeight ?? 240; // default 240px for expanded content

  // Ref so estimateSize can look up the current displayRows by index without
  // depending on the array's identity — displayRows gets a new top-level
  // reference on every edit (some row's data legitimately changed), and
  // @tanstack/react-virtual treats a fresh estimateSize reference as "the
  // sizing logic may have changed," invalidating its cached offsets for
  // ALL rows, not just the edited one — a full-row-count recompute on
  // every single-cell edit. estimateSize only actually needs to know
  // whether a row is expanded, which doesn't change when unrelated row
  // data changes, so it doesn't need displayRows.length in its deps
  // either — the virtualizer already reacts to row-count changes via its
  // own `count` option below.
  const displayRowsRef = useRef(displayRows);
  displayRowsRef.current = displayRows;

  // Resolves against displayRows (the virtualizer's real index space, which
  // respects showErrorsOnly) rather than visibleRows, since the two diverge
  // when that filter is active. Returns -1 when the row isn't in the
  // virtualizer's current index space — callers must skip vertical scroll.
  const getRowIndex = useCallback(
    (rowId: string) =>
      displayRowsRef.current.findIndex((r) => r.original?._id === rowId),
    [],
  );

  const estimateSize = useCallback(
    (index: number): number => {
      if (!props.renderExpandedRow) return ROW_HEIGHT;
      const tanRow = displayRowsRef.current[index];
      if (!tanRow) return ROW_HEIGHT;
      const rowId = tanRow.original?._id;
      if (rowId && expandedRowIds.has(rowId)) {
        return ROW_HEIGHT + EXPANDED_HEIGHT;
      }
      return ROW_HEIGHT;
      // expandedRowIds is a Set — recreated on toggle, so this dep is correct
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [ROW_HEIGHT, EXPANDED_HEIGHT, expandedRowIds, props.renderExpandedRow],
  );

  const virtualizer = useVirtualizer({
    // Use the greater of server totalRows or actual store rows.
    // When "+ New Record" adds an unsaved row, store.length exceeds
    // the server total — without this fix the virtualizer clips the
    // extra row and it visually "disappears" until after a save+refetch.
    count: showErrorsOnly
      ? displayRows.length
      : Math.max(grid.totalRows, displayRows.length),
    getScrollElement: () => scrollRef.current,
    estimateSize,
    overscan: 5,
    // measureElement is intentionally omitted — we use estimateSize for predictable
    // layout (no layout shift). If consumers need dynamic heights they can set
    // expandedRowHeight to match their content.
    // Sticky thead/tfoot safe zones — measured, not hardcoded, so keyboard-
    // nav's scrollToIndex('auto') never lands a focused row underneath
    // either. setOptions runs every render, so these self-update the
    // moment thead height or tfoot presence changes. 64 is only a
    // pre-mount fallback matching the thead's current fixed h-[64px].
    scrollPaddingStart: theadRef.current?.getBoundingClientRect().height ?? 64,
    scrollPaddingEnd: tfootRef.current?.getBoundingClientRect().height ?? 0,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const totalTableSize = virtualizer.getTotalSize();

  // Single fix point for all keyboard nav (arrows/Tab/Enter/Space/Escape) —
  // called here (rather than near the top of the component) because it
  // needs scrollRef/pinOffsets/totalPinnedWidth/colLeftOffsets/
  // visibleDataCols/virtualizer/getRowIndex, all declared above. Its
  // returned `kb` is only consumed later (setFocus passed to GridRow,
  // kb.kbFocusRowId read further down) — nothing between here and there
  // depends on it.
  const kb = useKeyboardNav<TData>({
    visCols: visibleDataCols,
    visibleRows,
    enabled: props.features?.keyboardNav !== false,
    onActivateCell: activateCellIfAllowed,
    onOpenPanel: grid.openPanel,
    scrollRef,
    virtualizer,
    getRowIndex,
    colLeftOffsets,
    columnWidths: grid.columnWidths,
    pinOffsets,
    totalPinnedWidth,
  });

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

  // ── Dark mode: resolve from prop → CSS class walk → OS preference
  const isDark =
    props.darkMode !== undefined
      ? props.darkMode // explicit prop — highest priority
      : typeof document !== "undefined" &&
        (() => {
          let el: Element | null = document.querySelector("[data-reaktiform]");
          while (el) {
            if (
              el.classList.contains("dark") ||
              el.getAttribute("data-theme") === "dark" ||
              el.getAttribute("data-color-mode") === "dark" ||
              el.getAttribute("data-bs-theme") === "dark"
            )
              return true;
            el = el.parentElement;
          }
          const html = document.documentElement;
          return (
            html.classList.contains("dark") ||
            html.getAttribute("data-theme") === "dark" ||
            document.body?.classList.contains("dark") ||
            (!html.classList.contains("light") &&
              window.matchMedia?.("(prefers-color-scheme: dark)").matches)
          );
        })();

  // ── Explicit maxHeight/minHeight always win — autoHeight only applies
  // when neither is set, so passing a fixed value never gets silently ignored.
  const useAutoHeight =
    !!props.autoHeight &&
    props.maxHeight === undefined &&
    props.minHeight === undefined;

  // ── PAGE MODE ────────────────────────────────────────────────
  // In page mode an open panel takes over the grid's own box: the grid's
  // chrome hides, the panel renders in its place. See the chrome wrapper below.
  const pageActive = grid.panelMode === "page" && !!grid.panelRowId;

  // The grid's maxHeight bounds only the SCROLL CONTAINER — toolbar, filter and
  // bulk bars, and the footer stats bar all sit outside that budget. The page
  // panel's maxHeight bounds its WHOLE shell (its header, tabs and footer are
  // inside it), so handing it the raw value leaves the record page short by
  // exactly the height of the grid chrome.
  //
  // Measure that difference and add it back. The delta — not the total height —
  // because a total would go stale the moment the window is resized while a
  // record is open (the table is hidden, so it can't be re-measured), whereas
  // the delta is a constant that `calc()` re-evaluates against 100vh for free.
  //
  // This is only a valid measurement because nothing else in the root
  // contributes height: FilterPanel/CFPanel/ColumnVisibilityPanel all
  // createPortal to document.body and the keyboard hint is position:fixed.
  // Adding an in-flow child to the root would silently skew it.
  const rootRef = useRef<HTMLDivElement>(null);
  const [chromeDelta, setChromeDelta] = useState(0);
  useEffect(() => {
    // Never measure while the page panel is showing: the root's height IS the
    // panel's height then, which would be a feedback loop. autoHeight needs no
    // measurement at all — the shell's flex:1 already fills its ancestor.
    if (pageActive || useAutoHeight) return;
    const root = rootRef.current;
    const scroller = scrollRef.current;
    if (!root || !scroller || typeof ResizeObserver === "undefined") return;

    const measure = () => {
      const delta =
        root.getBoundingClientRect().height -
        scroller.getBoundingClientRect().height;
      if (delta <= 0) return; // mid-layout / hidden — ignore
      setChromeDelta((prev) => (Math.abs(prev - delta) < 1 ? prev : delta));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    ro.observe(scroller);
    return () => ro.disconnect();
  }, [pageActive, useAutoHeight]);

  // The grid's own ceiling and floor, shifted by the chrome the panel has to
  // absorb — so table and record page end at the same edge.
  const gridMaxHeight = props.maxHeight ?? "calc(100vh - 300px)";
  const pageMaxHeight =
    typeof gridMaxHeight === "number"
      ? gridMaxHeight + chromeDelta
      : `calc(${gridMaxHeight} + ${chromeDelta}px)`;
  const gridMinHeight = props.minHeight ?? 380;
  const pageMinHeight =
    typeof gridMinHeight === "number"
      ? gridMinHeight + chromeDelta
      : `calc(${gridMinHeight} + ${chromeDelta}px)`;

  return (
    <div
      data-reaktiform
      ref={rootRef}
      // When darkMode prop or auto-detection says dark, add the .dark class
      // so all [data-reaktiform] CSS var overrides take effect automatically.
      className={cn(
        "rf-flex rf-flex-col w-full",
        props.autoHeight && "h-full min-h-0",
        isDark && "dark",
        props.className,
      )}
      style={props.style}
    >
      {/* ── GRID CHROME ─────────────────────────────────────
          Everything the page-mode panel replaces: toolbar, filter/bulk bars,
          the scroll container and the keyboard hint.

          This wrapper is ALWAYS rendered and only its `display` changes.
          Wrapping conditionally would change the tree shape and remount the
          whole grid — destroying the scroll position, virtualizer state and
          in-progress filters that hiding (rather than unmounting) exists to
          preserve.

          `display: contents` makes it vanish from layout, so its children keep
          participating in the root's flex column exactly as before — no new
          flex context, no risk to the autoHeight path. Safe here precisely
          because this wrapper has no background or border of its own. */}
      <div style={{ display: pageActive ? "none" : "contents" }}>
        {/* ── TOOLBAR ───────────────────────────────────────── */}
        <Toolbar<TData>
        grid={grid}
        config={props}
        visibleRowsCount={visibleRows.length}
        visibleDataCols={visibleDataCols}
        dirtyCount={dirtyCount}
        showErrorsOnly={showErrorsOnly}
        setShowErrorsOnly={setShowErrorsOnly}
        isRefreshing={isRefreshing}
        setIsRefreshing={setIsRefreshing}
        setCfAnchor={setCfAnchor}
        setCfPanelOpen={setCfPanelOpen}
        setColVisAnchor={setColVisAnchor}
        setColVisPanelOpen={setColVisPanelOpen}
        setPanelModeAnchor={setPanelModeAnchor}
        setPanelModePanelOpen={setPanelModePanelOpen}
      />

      {/* ── ACTIVE FILTERS BAR ────────────────────────────── */}
      <ActiveFiltersBar<TData> grid={grid} config={props} />

      {/* ── BULK ACTIONS BAR ──────────────────────────────── */}
      <BulkActionsBar<TData> grid={grid} config={props} />

      {/* ── GRID ──────────────────────────────────────────── */}
      <div
        className={cn(
          "bg-rf-surface border border-rf-border border-t-0 rounded-b-rf-lg shadow-rf-sm",
          useAutoHeight && "flex-1 min-h-0",
        )}
        style={{ overflow: "clip" }}
      >
        {/* isFetching — subtle top progress bar (doesn't block interaction) */}
        {grid.isFetching && (
          <div className="h-[3px] bg-rf-accent-bg rf-overflow-hidden">
            <div
              className="rf-h-full bg-rf-accent rounded-full"
              style={{
                animation: "rfFetch 1.4s ease-in-out infinite",
                width: "40%",
              }}
            />
          </div>
        )}

        {/* Single scroll container — overflow in both directions
            thead sticky top-0 works because this div has a bounded height
            (either a fixed maxHeight, or h-full inside a flex-1 ancestor
            when autoHeight is on) and overflow-y:auto — sticky is relative
            to this scroll parent  */}
        <div
          ref={scrollRef}
          className={cn(
            "overflow-x-auto overflow-y-auto",
            useAutoHeight && "h-full",
          )}
          style={{
            ...(!useAutoHeight && {
              maxHeight: props.maxHeight ?? "calc(100vh - 300px)",
              minHeight: props.minHeight ?? 380,
            }),
            // NOTE: we cannot use contain:strict here because it creates a
            // new stacking context that traps position:fixed children (error
            // popover, react-select dropdowns) below the sticky thead.
            // contain: 'strict',  ← removed
            position: "relative", // establishes stacking context for sticky thead only
          }}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            // Portaled floating editors (e.g. RichTextPopover) are never a
            // DOM descendant of activeCellRef's <td> even though they're
            // logically "inside" the active cell — the primary guard against
            // this is the popover's own stopPropagation(), this check is
            // defense-in-depth for any future portaled cell editor that
            // forgets it.
            const insidePopover = target?.closest?.(
              "[data-rf-richtext-popover]",
            );
            if (
              editingCell &&
              !activeCellRef.current?.contains(target) &&
              !insidePopover
            ) {
              deactivateCell();
            }
          }}
        >
          <table
            className="border-separate border-spacing-0"
            style={{
              // min-width: the larger of totalWidth or 100% of the container.
              // width: 100% ensures the table fills the full container when
              // columns are few. min-width: totalWidth triggers horizontal scroll
              // when columns are many.
              width: "100%",
              minWidth: totalWidth,
              tableLayout: "fixed",
            }}
          >
            <colgroup>
              {showSelectColumn && <col style={{ width: COL_WIDTHS.cb }} />}
              {showRowNumbers && <col style={{ width: COL_WIDTHS.rn }} />}
              {showExpanderColumn && <col style={{ width: COL_WIDTHS.exp }} />}
              {visibleDataCols.map((col) => (
                <col
                  key={col.key as string}
                  style={{
                    width:
                      grid.columnWidths[col.key as string] ?? col.width ?? 150,
                  }}
                />
              ))}
              {showActionsColumn && <col style={{ width: COL_WIDTHS.act }} />}
            </colgroup>

            {/* ── THEAD ─────────────────────────────────── */}
            {/* z-[45] on the row-group itself (mirrors <tfoot>'s z-40) is
                required: a <tr> with opacity/transform (isRowDisabled, or
                the public rowStyle prop) creates its own stacking context
                and, without this, ties with <thead> at the z-index:auto
                tier — DOM order then puts tbody above thead. */}
            <thead className="sticky top-0 z-[45]" ref={theadRef}>
              <tr>
                {/* Checkbox — optional */}
                {showSelectColumn && (
                  <th
                    className="bg-rf-header border-b-2 border-r border-rf-border h-[64px] w-10 text-center sticky z-[45]"
                    style={{ left: pinOffsets["_cb"] }}
                  >
                    <div className="rf-flex rf-items-center rf-justify-center rf-h-full">
                      <input
                        type="checkbox"
                        className="w-[14px] h-[14px] rounded-[3px] accent-[var(--rf-accent)] rf-cursor-pointer"
                        // Only select rows that pass isRowSelectable
                        onChange={() => {
                          const selectableIds = visibleRows
                            .filter(
                              (r) =>
                                !props.isRowSelectable ||
                                props.isRowSelectable(r as unknown as TData),
                            )
                            .map((r) => r._id);
                          grid.toggleSelectAll(selectableIds);
                          if (props.onSelectionChange) {
                            const allSelected = selectableIds.every((id) =>
                              grid.selectedIds.has(id),
                            );
                            const newIds = allSelected ? [] : selectableIds;
                            const newRows = newIds
                              .map((id) => grid.rows.find((r) => r._id === id))
                              .filter(Boolean) as Row<TData>[];
                            requestAnimationFrame(() =>
                              props.onSelectionChange!(
                                newIds,
                                newRows as unknown as TData[],
                              ),
                            );
                          }
                        }}
                        // Hidden in single-select mode
                        style={
                          selectionMode === "single"
                            ? { display: "none" }
                            : undefined
                        }
                      />
                    </div>
                  </th>
                )}

                {/* Row # — optional */}
                {showRowNumbers && (
                  <th
                    className="bg-rf-header border-b-2 border-r border-rf-border h-[64px] sticky z-[45]"
                    style={{ left: pinOffsets["_rn"] }}
                  >
                    <div className="rf-flex rf-items-center rf-justify-center h-[36px] px-2">
                      <span className="text-[10.5px] rf-font-semibold text-rf-text-3 rf-uppercase tracking-wider">
                        #
                      </span>
                    </div>
                    <div className="h-[28px] border-t border-rf-border bg-black/[.015]" />
                  </th>
                )}

                {/* Expander — optional (auto-hidden if sidePanel is off) */}
                {showExpanderColumn && (
                  <th
                    className={cn(
                      "bg-rf-header border-b-2 border-r border-rf-border h-[64px] sticky z-[45]",
                      !lastPinKey && "shadow-[4px_0_10px_rgba(15,23,42,.08)]",
                    )}
                    style={{ left: pinOffsets["_exp"] }}
                  >
                    <div className="rf-flex rf-items-center rf-justify-center h-[36px]">
                      <ChevronRight className="rf-icon-sm text-rf-text-3" />
                    </div>
                    <div className="h-[28px] border-t border-rf-border bg-black/[.015]" />
                  </th>
                )}

                {/* Data columns — in user-defined order */}
                {visibleDataCols.map((col) => {
                  const colKey = col.key as string;
                  const isPinned = grid.pinnedColumns.has(colKey);
                  const isLastPin = lastPinKey === colKey;
                  const isSorted =
                    grid.sortModel.some((s) => s?.colKey === colKey) ||
                    grid.sortState?.colKey === colKey;
                  const sortEntry = grid.sortModel.find(
                    (s) => s?.colKey === colKey,
                  );
                  const sortPriority =
                    grid.sortModel.length > 1
                      ? grid.sortModel.findIndex((s) => s?.colKey === colKey) +
                        1
                      : undefined;
                  const isFiltered = !!grid.activeFilters[colKey];
                  const isGrouped = grid.groupByCol === colKey;

                  return (
                    <ColumnHeaderMemo
                      key={colKey}
                      col={col as ColumnDef}
                      isPinned={isPinned}
                      isLastPin={isLastPin}
                      isSorted={isSorted}
                      sortDir={
                        sortEntry?.direction ?? grid.sortState?.direction
                      }
                      isFiltered={isFiltered}
                      isGrouped={isGrouped}
                      isDragOver={dragOver === colKey}
                      {...(sortPriority !== undefined && { sortPriority })}
                      {...(grid.aggregations[colKey] !== undefined && {
                        aggregationMode: grid.aggregations[colKey],
                      })}
                      pinOffset={isPinned ? pinOffsets[colKey] : undefined}
                      onSort={colCallbacks.onSort.get(colKey)}
                      onTogglePin={colCallbacks.onTogglePin.get(colKey)!}
                      onToggleGroup={() =>
                        colCallbacks.onToggleGroup.get(colKey)!(isGrouped)
                      }
                      onOpenFilter={colCallbacks.onOpenFilter.get(colKey)}
                      onResize={colCallbacks.onResize.get(colKey)}
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

                {/* Actions — no width, fills remaining space — optional */}
                {showActionsColumn && (
                  <th className="bg-rf-header border-b-2 border-rf-border h-[64px]">
                    <div className="rf-flex rf-items-center rf-justify-center h-[36px] px-2">
                      <span className="text-[10.5px] rf-font-semibold text-rf-text-3 rf-uppercase tracking-wider">
                        Actions
                      </span>
                    </div>
                    <div className="h-[28px] border-t border-rf-border bg-black/[.015]" />
                  </th>
                )}
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
                    {showSelectColumn && (
                      <td
                        style={{
                          width: COL_WIDTHS.cb,
                          borderRight: "1px solid var(--rf-border)",
                        }}
                      />
                    )}
                    {showRowNumbers && (
                      <td
                        style={{
                          width: COL_WIDTHS.rn,
                          borderRight: "1px solid var(--rf-border)",
                        }}
                      />
                    )}
                    {showExpanderColumn && (
                      <td
                        style={{
                          width: COL_WIDTHS.exp,
                          borderRight: "1px solid var(--rf-border)",
                        }}
                      />
                    )}
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
                    {showActionsColumn && <td style={{}} />}
                  </tr>
                ))}

              {/* Top padding row — fills space above first virtual item */}
              {!grid.isLoading && virtualItems.length > 0 && (
                <tr style={{ height: virtualItems[0]?.start ?? 0 }}>
                  <td
                    colSpan={
                      visibleDataCols.length +
                      (showSelectColumn ? 1 : 0) +
                      (showRowNumbers ? 1 : 0) +
                      (showExpanderColumn ? 1 : 0) +
                      (showActionsColumn ? 1 : 0)
                    }
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
                        <td style={{}} />
                      </tr>
                    );
                  }

                  const tanRow = displayRows[virtualRow.index];
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
                  // Row-scoped display state (isDirty, isSelected,
                  // isKbFocused, isPanelOpen, cfResult, editingCell, etc.)
                  // is no longer computed here — GridRow reads it itself
                  // via granular per-row store selectors, which is what
                  // lets React.memo(GridRow) bail out for unrelated rows.
                  // Only what genuinely can't be row-scoped (consumer
                  // callbacks resolved against this row's data) stays here.
                  const row = tanRow.original;
                  const rowId = row._id;
                  const consumerRowData = row as unknown as TData;
                  const isDisabled =
                    props.isRowDisabled?.(consumerRowData) ?? false;
                  const extraClass = props.rowClassName?.(consumerRowData);
                  const extraStyle = props.rowStyle?.(consumerRowData);

                  const dataRow = (
                    <GridRow<TData>
                      key={rowId}
                      row={row}
                      rowIndex={virtualRow.index}
                      columns={visibleDataCols}
                      columnWidths={grid.columnWidths}
                      pinOffsets={pinOffsets}
                      lastPinKey={lastPinKey}
                      showSelectColumn={showSelectColumn}
                      showRowNumbers={showRowNumbers}
                      showExpanderColumn={showExpanderColumn}
                      showActionsColumn={showActionsColumn}
                      selectionMode={selectionMode}
                      colWidths={COL_WIDTHS}
                      rowHeight={ROW_HEIGHT}
                      activeCellRef={activeCellRef}
                      expandedRowIds={expandedRowIds}
                      toggleExpandedRow={toggleExpandedRow}
                      hasRenderExpandedRow={!!props.renderExpandedRow}
                      isErrorPopoverOpen={errorPopoverRowId === rowId}
                      onToggleErrorPopover={toggleErrorPopover}
                      onCloseErrorPopover={closeErrorPopover}
                      isDisabled={isDisabled}
                      extraClass={extraClass}
                      extraStyle={extraStyle}
                      isDark={isDark}
                      onRowClick={props.onRowClick}
                      onRowDoubleClick={props.onRowDoubleClick}
                      isRowSelectable={props.isRowSelectable}
                      onSelectionChange={props.onSelectionChange}
                      markDirty={markDirtyStable}
                      discardRow={discardRowStable}
                      duplicateRow={duplicateRowStable}
                      saveRow={saveRowStable}
                      deleteRow={deleteRowStable}
                      getComputedValue={getComputedValueStable}
                      canDuplicateRow={canDuplicateRowStable}
                      canDeleteRow={canDeleteRowStable}
                      canSave={grid.permissions.canSave}
                      canEditCell={canEditCellStable}
                      setFocus={kb.setFocus}
                      deactivateCell={deactivateCell}
                      openPanel={grid.openPanel}
                      closePanel={grid.closePanel}
                      evalCF={grid.evalCF}
                      getVal={grid.getVal}
                      activateCellIfAllowed={activateCellIfAllowed}
                      toggleSelect={grid.toggleSelect}
                      clearSelection={grid.clearSelection}
                    />
                  );

                  // ── EXPANDED ROW — rendered immediately below parent using Fragment
                  if (props.renderExpandedRow && expandedRowIds.has(rowId)) {
                    const totalCols =
                      visibleDataCols.length +
                      (showSelectColumn ? 1 : 0) +
                      (showRowNumbers ? 1 : 0) +
                      (showExpanderColumn ? 1 : 0) +
                      (showActionsColumn ? 1 : 0);
                    return (
                      <React.Fragment key={`frag-${rowId}`}>
                        {dataRow}
                        <tr
                          style={{
                            background: "var(--rf-accent-bg)",
                            borderBottom: "2px solid var(--rf-accent-br)",
                          }}
                        >
                          <td
                            colSpan={totalCols}
                            style={{
                              padding: 0,
                              borderTop: "1px solid var(--rf-accent-br)",
                            }}
                          >
                            <div
                              style={{
                                padding: "12px 16px",
                                height: props.expandedRowHeight,
                                overflow: props.expandedRowHeight
                                  ? "auto"
                                  : undefined,
                              }}
                            >
                              {props.renderExpandedRow(row as unknown as TData)}
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  }

                  return dataRow;
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
                        colSpan={
                          visibleDataCols.length +
                          (showSelectColumn ? 1 : 0) +
                          (showRowNumbers ? 1 : 0) +
                          (showExpanderColumn ? 1 : 0) +
                          (showActionsColumn ? 1 : 0)
                        }
                        style={{ padding: 0, border: "none" }}
                      />
                    </tr>
                  ) : null;
                })()}

              {/* Empty state — shown when not loading and no rows */}
              {!grid.isLoading && displayRows.length === 0 && (
                <tr>
                  <td
                    colSpan={
                      visibleDataCols.length +
                      (showSelectColumn ? 1 : 0) +
                      (showRowNumbers ? 1 : 0) +
                      (showExpanderColumn ? 1 : 0) +
                      (showActionsColumn ? 1 : 0)
                    }
                    style={{ padding: 0 }}
                  >
                    {props.emptyState ? (
                      <div style={{ padding: "32px 24px" }}>
                        {props.emptyState}
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "40px 24px",
                          gap: 12,
                          color: "var(--rf-text-3)",
                        }}
                      >
                        <svg
                          width="40"
                          height="40"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ opacity: 0.4 }}
                        >
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <path d="M3 9h18M9 21V9" />
                        </svg>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>
                          No records found
                        </span>
                        {Object.keys(grid.activeFilters).length > 0 && (
                          <button
                            onClick={grid.clearAllFilters}
                            style={{
                              fontSize: 12.5,
                              color: "var(--rf-accent)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              textDecoration: "underline",
                            }}
                          >
                            Clear filters to show all records
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )}

              {/* Add record button */}
              {!grid.isLoading &&
                grid.permissions.canCreate &&
                props?.features?.showAddButtonAtFooter && (
                  <tr>
                    <td
                      colSpan={
                        visibleDataCols.length +
                        (showSelectColumn ? 1 : 0) +
                        (showRowNumbers ? 1 : 0) +
                        (showExpanderColumn ? 1 : 0) +
                        (showActionsColumn ? 1 : 0)
                      }
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
              <tfoot className="sticky bottom-0 z-40" ref={tfootRef}>
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
                  <td style={{}} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {/* end scroll container */}

        {/* ── FOOTER ──────────────────────────────────────── */}
        <FooterStatsBar<TData> grid={grid} dirtyCount={dirtyCount} />
      </div>

      {/* ── KB HINT ─────────────────────────────────────── */}
      {kb.kbFocusRowId && props.features?.showHintFloatBar && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0F172A] text-[#F1F5F9] rounded-rf-xl px-4 py-2.5 rf-flex rf-items-center rf-gap-3 shadow-rf-lg z-[800] text-[11.5px] rf-font-medium rf-pointer-events-none">
          <kbd className="bg-white/15 rounded px-1.5 py-0.5 rf-font-mono text-[10.5px] rf-font-semibold">
            ↑↓←→
          </kbd>{" "}
          Navigate
          <kbd className="bg-white/15 rounded px-1.5 py-0.5 rf-font-mono text-[10.5px] rf-font-semibold">
            Enter
          </kbd>{" "}
          Edit
          <kbd className="bg-white/15 rounded px-1.5 py-0.5 rf-font-mono text-[10.5px] rf-font-semibold">
            Space
          </kbd>{" "}
          Detail panel
          <kbd className="bg-white/15 rounded px-1.5 py-0.5 rf-font-mono text-[10.5px] rf-font-semibold">
            Esc
          </kbd>{" "}
          Exit
        </div>
      )}
      </div>
      {/* end grid chrome */}

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
              onFieldChange={(rowId, field, value) => {
                // Called on every keystroke in the panel form —
                // marks the field dirty so the table reflects changes live
                grid.markDirty(rowId, field, value);
              }}
              getComputedValue={getComputedValueStable}
              onSave={(rowId, _data) => {
                // All fields are already dirty from onFieldChange above.
                // Just call saveRow — it reads from the existing _draft.
                void grid.saveRow(rowId);
              }}
              onDiscard={(rowId) => grid.discardRow(rowId)}
              panelTabs={grid.panelTabs ?? undefined}
              mode={grid.panelMode}
              {...(grid.panelWidth !== undefined && {
                width: grid.panelWidth,
              })}
              {...(grid.panelBackLabel !== undefined && {
                backLabel: grid.panelBackLabel,
              })}
              // Page mode replaces the grid's whole box, so it gets the grid's
              // own ceiling and floor PLUS the chrome the grid keeps outside
              // its maxHeight (toolbar, bars, footer) — see chromeDelta above.
              // Computed here rather than in the panel so the two can't drift.
              autoHeight={useAutoHeight}
              maxHeight={pageMaxHeight}
              minHeight={pageMinHeight}
              canSave={grid.permissions.canSave}
              canEdit={grid.permissions.canEditRow(
                (panelRow as Record<string, unknown>) ?? {},
              )}
              editLocked={grid.editLocked}
              canComment={grid.permissions.canComment}
              canUploadFiles={grid.permissions.canUploadFiles}
              {...(props.allowMultipleFileUpload !== undefined && {
                allowMultipleFileUpload: props.allowMultipleFileUpload,
              })}
              {...(props.onAddComment !== undefined && {
                onAddComment: props.onAddComment,
              })}
              {...(props.onLoadAttachments !== undefined && {
                onLoadAttachments: props.onLoadAttachments,
              })}
              {...(props.onUploadFile !== undefined && {
                onUploadFile: props.onUploadFile,
              })}
              {...(props.onDeleteAttachment !== undefined && {
                onDeleteAttachment: props.onDeleteAttachment,
              })}
              {...(props.renderAttachment !== undefined && {
                renderAttachment: props.renderAttachment,
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
              key={`${filterCol}-v${grid.filterVersion}`}
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
              isDark={isDark}
            />
          );
        })()}

      {/* ── CF PANEL ────────────────────────────────────── */}
      {cfPanelOpen && (
        <CFPanel
          anchor={cfAnchor}
          columns={props.columns as ColumnDef[]}
          rules={grid.cfRules}
          onAddRule={grid.addCFRule}
          onUpdateRule={grid.updateCFRule}
          onDeleteRule={grid.deleteCFRule}
          onClose={() => setCfPanelOpen(false)}
          isDark={isDark}
        />
      )}

      {/* ── COLUMN VISIBILITY PANEL ─────────────────────── */}
      {colVisPanelOpen && (
        <ColumnVisibilityPanel
          columns={orderedColumns as ColumnDef[]}
          hiddenColumns={grid.hiddenColumns}
          anchor={colVisAnchor}
          onToggle={(key) => grid.toggleHide(key)}
          onShowAll={() => {
            [...grid.hiddenColumns].forEach((k) => grid.toggleHide(k));
          }}
          onReorder={(newOrder) => grid.setColumnOrder(newOrder)}
          onClose={() => setColVisPanelOpen(false)}
          isDark={isDark}
        />
      )}

      {panelModePanelOpen && (
        <PanelModePanel
          value={grid.panelMode}
          modes={grid.panelModes}
          anchor={panelModeAnchor}
          onSelect={(mode) => grid.setPanelMode(mode)}
          onClose={() => setPanelModePanelOpen(false)}
          isDark={isDark}
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
    <GridStoreProvider
      {...(props.storageKey !== undefined && { storageKey: props.storageKey })}
      initialState={{
        editLocked: props.editLocked ?? props.initialEditLocked ?? false,
      }}
    >
      <ReaktiformInner {...props} />
    </GridStoreProvider>
  );
}
