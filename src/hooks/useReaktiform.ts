import { useMemo, useEffect, useRef, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  type ColumnDef as TanstackColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useGridStore, useGridActions, useGridStoreInstance } from "../store";
import { useDraft } from "./useDraft";
import { useUndo } from "./useUndo";
import { useConditionalFormat } from "./useConditionalFormat";
import { useComputedColumns } from "./useComputedColumns";
import { generateId } from "../utils";
import type { GridConfig, Row, SortingMode, AggregationMode } from "../types";

export function useReaktiform<TData = Record<string, unknown>>(
  config: GridConfig<TData>,
) {
  const {
    columns,
    data,
    rowIdKey = "id",
    sortingMode = "client",
    features = {},
    permissions = {},
    panelTabs,
    isLoading: isLoadingProp = false,
    isFetching: isFetchingProp = false,
    isFetchingMore: isFetchingMoreProp = false,
    // Infinite scroll
    totalRows,
    onFetchMore,
    fetchThreshold = 15,
    pageSize = 30,
    // Server-mode callbacks
    onSortChange,
    onFilterChange,
    onSearchChange,
    onAggregationChange,
    aggregationValues,
    // Row mutation
    onCreate,
    onUpdate,
    onSave,
    onBulkSave,
    onDelete,
    onAdd,
    onSaveSuccess,
    onSaveError,
    // Initial state
    initialSort,
    initialGroupBy,
    initialPinnedColumns = [],
    initialHiddenColumns = [],
    initialCFRules = [],
  } = config;

  const isServerMode = sortingMode === "server";

  // ── Permission helpers — resolve boolean or function permissions
  const resolvePermission = (
    perm: boolean | ((row: Record<string, unknown>) => boolean) | undefined,
    row?: Record<string, unknown>,
  ): boolean => {
    if (perm === undefined) return true;
    if (typeof perm === "boolean") return perm;
    if (row) return perm(row);
    return true;
  };

  const canCreate = permissions.canCreate !== false;
  const canExport = permissions.canExport !== false;
  const canSave = permissions.canSave !== false;

  const canEditRow = (row: Record<string, unknown>) =>
    resolvePermission(permissions.canEdit, row);
  const canDeleteRow = (row: Record<string, unknown>) =>
    resolvePermission(permissions.canDelete, row);
  const canDuplicateRow = (row: Record<string, unknown>) =>
    resolvePermission(permissions.canDuplicate, row);
  const canEditCol = (colKey: string) =>
    permissions.canEditColumn ? permissions.canEditColumn(colKey) : true;
  const canComment = permissions.canComment !== false;
  const canUploadFiles = permissions.canUploadFiles !== false;

  // ── Stable action ref
  const actions = useGridActions();
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  // ── Zustand state
  const sortState = useGridStore((s) => s.sortState);
  const sortModel = useGridStore((s) => s.sortModel);
  const activeFilters = useGridStore((s) => s.activeFilters);
  const searchQuery = useGridStore((s) => s.searchQuery);
  const groupByCol = useGridStore((s) => s.groupByCol);
  const selectedIds = useGridStore((s) => s.selectedIds);
  const hiddenColumns = useGridStore((s) => s.hiddenColumns);
  const pinnedColumns = useGridStore((s) => s.pinnedColumns);
  const columnWidths = useGridStore((s) => s.columnWidths);
  const columnOrder = useGridStore((s) => s.columnOrder);
  const aggregations = useGridStore((s) => s.aggregations);
  const panelRowId = useGridStore((s) => s.panelRowId);
  const kbFocusRowId = useGridStore((s) => s.kbFocusRowId);
  const kbFocusColIdx = useGridStore((s) => s.kbFocusColIdx);

  // ── Init guard — run once on mount
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const a = actionsRef.current;
    a.setSortingMode(sortingMode);

    const enrichedRows = data.map((item) => {
      const record = item as Record<string, unknown>;
      return {
        ...record,
        _id: String(record[rowIdKey] ?? generateId("row")),
        _saved: true,
        _new: false,
        _draft: null,
        _errors: {},
        _comments: record["_comments"] ?? [],
        _attachments: record["_attachments"] ?? [],
      };
    });
    a.setRows(enrichedRows);

    queueMicrotask(() => {
      if (initialSort) a.setSort(initialSort.colKey);
      if (initialGroupBy) a.setGroupBy(initialGroupBy);
      initialPinnedColumns.forEach((k) => a.togglePinColumn(k));
      initialHiddenColumns.forEach((k) => a.toggleHideColumn(k));
      if (initialCFRules.length) a.setCFRules(initialCFRules);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync external data → store when data prop changes
  //
  // The store is the source of truth. This effect only updates rows that
  // are clean (no draft, not mid-save). Rows being edited or currently
  // saving are always preserved from the store.
  //
  // Key: we track a "saving" set of row IDs. While a save is in-flight,
  // any incoming data change for that row is ignored. Once the save
  // completes (or fails), the ID is removed from the set and normal
  // sync resumes for explicit refetches.
  const storeInstance = useGridStoreInstance();
  const savingRowIdsRef = useRef<Set<string>>(new Set());

  // Called by useDraft BEFORE the API call — marks row as saving
  // Called by useDraft AFTER success or failure — clears the mark
  const setSavingRow = useCallback((rowId: string, saving: boolean) => {
    if (saving) {
      savingRowIdsRef.current.add(rowId);
    } else {
      savingRowIdsRef.current.delete(rowId);
    }
  }, []);
  const setSavingRowRef = useRef(setSavingRow);
  setSavingRowRef.current = setSavingRow;

  useEffect(() => {
    if (!initialized.current) return;

    // Build the set of protected row IDs — rows that must NOT be overwritten:
    //   1. Rows with an active draft (user is mid-edit)
    //   2. Rows whose API save is in-flight (setSavingRow called)
    const latestRows = storeInstance.getState().rows as Row<TData>[];
    const skipIds = new Set<string>(savingRowIdsRef.current);

    for (const r of latestRows) {
      if (r._draft !== null && r._draft !== undefined) {
        const id = String((r as Record<string, unknown>)[rowIdKey] ?? r._id);
        skipIds.add(id);
      }
    }

    // Build enriched incoming rows — add reaktiform meta fields
    // preserving existing _id, _comments, _attachments from the store
    const storeRowMap = new Map<string, Row<TData>>();
    for (const r of latestRows) {
      const id = String((r as Record<string, unknown>)[rowIdKey] ?? r._id);
      storeRowMap.set(id, r);
    }

    const enrichedIncoming = data.map((item) => {
      const record = item as Record<string, unknown>;
      const itemId = String(record[rowIdKey] ?? "");
      const existing = storeRowMap.get(itemId);
      return {
        ...record,
        _id: existing?._id ?? String(record[rowIdKey] ?? generateId("row")),
        _saved: true,
        _new: false,
        _draft: null,
        _errors: {},
        _saveError: undefined,
        _comments: existing?._comments ?? record["_comments"] ?? [],
        _attachments: existing?._attachments ?? record["_attachments"] ?? [],
      };
    });

    // Use mergeRows — O(changed rows), Immer structural sharing
    // means React skips re-rendering unchanged rows entirely
    actionsRef.current.mergeRows(enrichedIncoming, rowIdKey, skipIds);
  }, [data, rowIdKey, storeInstance]);

  // ── SERVER MODE: stable callback refs
  // Callbacks from consumer are often inline arrows that recreate every render.
  // Storing in refs means useEffect deps never change identity → no infinite loop.
  const onSortChangeRef = useRef(onSortChange);
  const onFilterChangeRef = useRef(onFilterChange);
  const onSearchChangeRef = useRef(onSearchChange);
  // Keep refs current without triggering effects
  onSortChangeRef.current = onSortChange;
  onFilterChangeRef.current = onFilterChange;
  onSearchChangeRef.current = onSearchChange;

  // Skip-first-fire guards — don't fire callbacks on mount
  const skipFirstSort = useRef(true);
  const skipFirstFilter = useRef(true);
  const skipFirstSearch = useRef(true);

  // Server sort — fire when sortModel/sortState changes
  // For multi-sort: pass full sortModel array; for single sort: pass sortBy/sortDir
  useEffect(() => {
    if (!isServerMode) return;
    if (skipFirstSort.current) {
      skipFirstSort.current = false;
      return;
    }
    if (sortModel.length === 0 && !sortState) return;
    // Always pass sortBy/sortDir for backward compat (first sort entry)
    // Also pass sortModel array for consumers that support multi-sort
    const primary = sortModel[0] ?? sortState;
    if (!primary) return;
    onSortChangeRef.current?.({
      sortBy: primary.colKey,
      sortDir: primary.direction,
      // Filter nulls before passing — SortState is nullable
      sortModel:
        sortModel.length > 1
          ? sortModel.filter((s): s is NonNullable<typeof s> => s !== null)
          : undefined,
    });
    // sortModel ref is stable between renders; sortState stays in sync
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortModel, sortState, isServerMode]);

  // Server filter — fire when activeFilters changes
  useEffect(() => {
    if (!isServerMode) return;
    if (skipFirstFilter.current) {
      skipFirstFilter.current = false;
      return;
    }
    onFilterChangeRef.current?.(activeFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilters, isServerMode]);

  // Server search — fire when searchQuery changes
  // NOTE: In server mode, setSearch still updates Zustand searchQuery.
  // This effect reads it and fires the callback. The callback updates
  // consumer state (setSortParams). That triggers a re-fetch which
  // updates data prop. The data sync effect above updates the store.
  // NO setState is called inside this effect → no loop.
  useEffect(() => {
    if (!isServerMode) return;
    if (skipFirstSearch.current) {
      skipFirstSearch.current = false;
      return;
    }
    onSearchChangeRef.current?.(searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, isServerMode]);

  // ── Infinite scroll — stable callback ref
  // onFetchMore is often an inline function — use ref to keep effect deps stable
  const onFetchMoreRef = useRef(onFetchMore);
  onFetchMoreRef.current = onFetchMore;

  // isFetchingMore guard — prevents double-fetching when virtualizer
  // fires multiple scroll events in quick succession
  const isFetchingMoreRef = useRef(false);

  // ── Computed columns engine
  const computed = useComputedColumns<TData>({ columns });

  // ── Draft operations
  // Stable wrapper so useDraft always calls the current setSavingRow
  const setSavingRowStable = useCallback((rowId: string, saving: boolean) => {
    setSavingRowRef.current(rowId, saving);
  }, []);

  // onRowSaveError: called by useDraft when a save API call fails.
  // Stored in a ref so Reaktiform.tsx can imperatively set it to
  // auto-open the error popover for the failed row.
  const onRowSaveErrorRef = useRef<
    ((rowInternalId: string) => void) | undefined
  >(undefined);
  const onRowSaveErrorStable = useCallback((rowInternalId: string) => {
    onRowSaveErrorRef.current?.(rowInternalId);
  }, []);

  const draft = useDraft<TData>({
    columns,
    rowIdKey,
    computed,
    setSavingRow: setSavingRowStable,
    onRowSaveError: onRowSaveErrorStable,
    ...(onCreate !== undefined && { onCreate }),
    ...(onUpdate !== undefined && { onUpdate }),
    ...(onSave !== undefined && { onSave }),
    ...(onBulkSave !== undefined && { onBulkSave }),
    ...(onDelete !== undefined && { onDelete }),
    ...(onAdd !== undefined && { onAdd }),
    ...(onSaveSuccess !== undefined && { onSaveSuccess }),
    ...(onSaveError !== undefined && { onSaveError }),
  });

  // ── Undo / Redo
  const undoRedo = useUndo<TData>({
    columns,
    rowIdKey,
    enabled: features.undoRedo !== false,
  });

  // ── Conditional formatting
  const cf = useConditionalFormat<TData>();

  // ── TanStack column defs
  const tanstackColumns = useMemo<TanstackColumnDef<Row<TData>>[]>(() => {
    return columns.map(
      (col): TanstackColumnDef<Row<TData>> => ({
        id: col.key as string,
        accessorFn: (row) => draft.getVal(row, col.key as string),
        header: col.label,
        size: col.width ?? 150,
        minSize: col.minWidth ?? 60,
        maxSize: col.maxWidth ?? 600,
        enableSorting: col.sortable !== false && !col.computed,
        enableColumnFilter: col.filterable !== false,
        enableResizing: col.resizable !== false,
        enableHiding: true,
        enablePinning: true,
        meta: { colDef: col },
      }),
    );
  }, [columns, draft]);

  // ── Sort state for TanStack — uses sortModel for multi-column sort
  const sorting = useMemo<SortingState>(() => {
    if (sortModel.length > 0) {
      // Multi-sort: map all entries in order
      // Filter nulls — SortState is { colKey, direction } | null
      return sortModel
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .map((s) => ({ id: s.colKey, desc: s.direction === "desc" }));
    }
    if (!sortState) return [];
    return [{ id: sortState.colKey, desc: sortState.direction === "desc" }];
  }, [sortModel, sortState]);

  // ── Memoized table state slices
  const columnVisibility = useMemo(
    () => Object.fromEntries([...hiddenColumns].map((k) => [k, false])),
    [hiddenColumns],
  );
  const columnPinning = useMemo(
    () => ({ left: [...pinnedColumns] }),
    [pinnedColumns],
  );
  const grouping = useMemo(
    () => (groupByCol ? [groupByCol] : []),
    [groupByCol],
  );

  // ── Client-mode filter function
  // Handles BOTH global search AND per-column activeFilters in one pass.
  // filterValue = combinedFilterKey (searchQuery + '|' + JSON(filters))
  // Performance: early-return on first mismatch, no unnecessary allocations.
  const globalFilterFn = useMemo(() => {
    const fn = (
      row: { original: Row<TData> },
      _colId: string,
      filterValue: string,
    ): boolean => {
      const original = row.original;
      // Extract search text — combinedFilterKey is "search|filtersJson"
      const searchText = filterValue ? (filterValue.split("|")[0] ?? "") : "";

      // 1. Per-column activeFilters — most selective, checked first
      for (const [colKey, filter] of Object.entries(activeFilters)) {
        const rawVal = draft.getVal(original, colKey);

        if (filter.type === "text") {
          if (!filter.text) continue;
          if (
            !String(rawVal ?? "")
              .toLowerCase()
              .includes(filter.text.toLowerCase())
          )
            return false;
        } else if (filter.type === "number") {
          const numV = parseFloat(String(rawVal ?? ""));
          if (!isNaN(numV)) {
            if (filter.min !== undefined && numV < filter.min) return false;
            if (filter.max !== undefined && numV > filter.max) return false;
          }
        } else if (filter.type === "date") {
          const dateV = String(rawVal ?? "");
          if (filter.from && dateV < filter.from) return false;
          if (filter.to && dateV > filter.to) return false;
        } else if (filter.type === "select") {
          if (!filter.values.length) continue;
          const strV = Array.isArray(rawVal)
            ? rawVal.map(String)
            : [String(rawVal ?? "")];
          if (!strV.some((v) => filter.values.includes(v))) return false;
        } else if (filter.type === "checkbox") {
          if (filter.value === null) continue;
          if (Boolean(rawVal) !== filter.value) return false;
        }
      }

      // 2. Global search across all visible columns
      if (searchText) {
        const q = searchText.toLowerCase();
        const matches = columns.some((col) => {
          const v = draft.getVal(original, col.key as string);
          return Array.isArray(v)
            ? v.join(" ").toLowerCase().includes(q)
            : String(v ?? "")
                .toLowerCase()
                .includes(q);
        });
        if (!matches) return false;
      }

      return true;
    };
    // Required by TanStack — removes filter when value is empty/falsy
    fn.autoRemove = (val: unknown) => !val;
    return fn;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, activeFilters]);

  // ── Combined filter key — triggers TanStack to re-run globalFilterFn
  // Using a version counter instead of JSON.stringify(activeFilters) avoids
  // serialising the entire filter object on every render (including scroll).
  // The counter increments whenever activeFilters identity changes.
  const filterVersionRef = useRef(0);
  const prevFiltersRef = useRef(activeFilters);
  if (prevFiltersRef.current !== activeFilters) {
    filterVersionRef.current++;
    prevFiltersRef.current = activeFilters;
  }
  const combinedFilterKey = isServerMode
    ? undefined
    : `${searchQuery}|v${filterVersionRef.current}`;

  // ── TanStack Table instance
  const table = useReactTable<Row<TData>>({
    data: draft.rows,
    columns: tanstackColumns,
    state: {
      sorting,
      globalFilter: combinedFilterKey,
      columnVisibility,
      columnPinning,
      grouping,
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowId: (row) => row._id,

    // CLIENT: false → TanStack sorts rows in memory using getSortedRowModel
    // SERVER: true  → data arrives pre-sorted, TanStack just displays it
    manualSorting: isServerMode,
    onSortingChange: isServerMode
      ? () => {}
      : (updater) => {
          const next =
            typeof updater === "function" ? updater(sorting) : updater;
          if (next.length === 0) {
            // TanStack cleared sort — respect it
            actionsRef.current.clearSort();
          } else {
            const s = next[0]!;
            // Always call setSort — store handles the 3-state cycle:
            //   first click on column  → asc
            //   second click same col  → desc
            //   third click same col   → null (clearSort fires on next render
            //                             when TanStack sees empty SortingState)
            actionsRef.current.setSort(s.id);
          }
        },

    enableColumnResizing: features.columnResize !== false,
    columnResizeMode: "onChange",
    globalFilterFn,
  });

  // ── Aggregation helper
  // ── Keep onAggregationChange in a ref — stable across renders
  const onAggregationChangeRef = useRef(onAggregationChange);
  onAggregationChangeRef.current = onAggregationChange;

  // ── aggregationValues in a ref — always current for the tfoot render
  const aggregationValuesRef = useRef(aggregationValues);
  aggregationValuesRef.current = aggregationValues;

  /**
   * setAggregation — wraps store action + fires server callback in server mode.
   * In client mode: just updates store, computeAggregation handles the math.
   * In server mode: updates store (for mode display) + fires onAggregationChange
   *   so consumer can fetch server-computed result and pass back via aggregationValues.
   */
  const setAggregation = useCallback(
    (colKey: string, mode: string) => {
      actions.setAggregation(colKey, mode);
      if (isServerMode && onAggregationChangeRef.current) {
        onAggregationChangeRef.current(colKey, mode as AggregationMode);
      }
    },
    [actions, isServerMode],
  );

  /**
   * computeAggregation — dual mode:
   *
   * CLIENT MODE: compute from the full filtered row set in memory.
   *   Accurate because all data is loaded.
   *
   * SERVER MODE: return value from aggregationValues prop.
   *   The consumer fetches this from their API via onAggregationChange.
   *   Falls back to a loading indicator if value hasn't arrived yet.
   */
  const computeAggregation = useCallback(
    (colKey: string, mode: string): number | string | null => {
      const col = columns.find((c) => c.key === colKey);
      if (!col || col.type !== "number" || mode === "none") return null;

      // Server mode — use consumer-provided aggregation values
      if (isServerMode) {
        const serverVal = aggregationValuesRef.current?.[colKey];
        if (serverVal !== undefined && serverVal !== null) return serverVal;
        // Value not yet available — show loading indicator
        return "…";
      }

      // Client mode — compute in memory from filtered rows
      const vals = table
        .getFilteredRowModel()
        .rows.map((r) =>
          parseFloat(String(draft.getVal(r.original, colKey) ?? "")),
        )
        .filter((v) => !isNaN(v));

      if (!vals.length) return "—";
      switch (mode) {
        case "sum":
          return vals.reduce((a, b) => a + b, 0).toFixed(2);
        case "avg":
          return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
        case "min":
          return Math.min(...vals).toFixed(2);
        case "max":
          return Math.max(...vals).toFixed(2);
        case "count":
          return vals.length;
        default:
          return null;
      }
    },
    [columns, isServerMode, table, draft],
  );

  const processedRows = table.getRowModel().rows;

  return {
    table,
    processedRows,
    columns,
    sortState,
    sortModel,
    sortingMode: sortingMode as SortingMode,
    activeFilters,
    searchQuery,
    groupByCol,
    selectedIds,
    hiddenColumns,
    pinnedColumns,
    columnWidths,
    columnOrder,
    aggregations,
    panelRowId,
    kbFocusRowId,
    kbFocusColIdx,
    isLoading: isLoadingProp,
    isFetching: isFetchingProp,
    isFetchingMore: isFetchingMoreProp,
    // Infinite scroll
    // totalRows: use prop only when it's a positive number.
    // Jmix (and some other APIs) return X-Total-Count: 0 on first page
    // even when rows exist — fall back to loaded row count in that case.
    totalRows:
      totalRows != null && totalRows > 0 ? totalRows : draft.rows.length,
    pageSize,
    fetchThreshold,
    hasMore:
      totalRows != null && totalRows > 0 && draft.rows.length < totalRows,
    // Permissions — resolved helpers
    permissions: {
      canCreate,
      canExport,
      canSave,
      canEditRow,
      canDeleteRow,
      canDuplicateRow,
      canEditCol,
      canComment,
      canUploadFiles,
    },
    // Panel tabs config
    panelTabs,
    onFetchMoreRef,
    isFetchingMoreRef,
    // Reaktiform.tsx sets this to auto-open the error popover on save failure
    onRowSaveErrorRef,
    ...draft,
    ...undoRedo,
    ...cf,
    getComputedValue: computed.getComputedValue,
    getComputedValues: computed.getComputedValues,
    getSaveableComputedValues: computed.getSaveableComputedValues,
    isComputed: computed.isComputed,
    computedCols: computed.computedCols,
    computeAggregation,
    setAggregation,
    setSort: actions.setSort,
    setSortMulti: actions.setSortMulti,
    clearSort: actions.clearSort,
    setFilter: actions.setFilter,
    clearFilter: actions.clearFilter,
    clearAllFilters: actions.clearAllFilters,
    setSearch: actions.setSearchQuery,
    setGroupBy: actions.setGroupBy,
    clearGroupBy: actions.clearGroupBy,
    toggleCollapsedGroup: actions.toggleCollapsedGroup,
    togglePin: actions.togglePinColumn,
    toggleHide: actions.toggleHideColumn,
    setColumnWidth: actions.setColumnWidth,
    setColumnOrder: actions.setColumnOrder,
    toggleSelect: actions.toggleSelect,
    toggleSelectAll: (allIds: string[]) => actions.toggleSelectAll(allIds),
    clearSelection: actions.clearSelection,
    openPanel: (rowId: string) => actions.setPanelRowId(rowId),
    closePanel: () => actions.setPanelRowId(null),
    addCFRule: actions.addCFRule,
    updateCFRule: actions.updateCFRule,
    deleteCFRule: actions.deleteCFRule,
    setKbFocus: actions.setKbFocus,
  };
}
