import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type {
  SortState,
  SortingMode,
  FilterValue,
  CFRule,
  ActiveFilters,
} from "../types";

// ── History entry shape
export type HistoryEntry = {
  type: "field" | "addRow" | "delRow" | "saveRow";
  rowId: string;
  field?: string;
  oldVal?: unknown;
  newVal?: unknown;
  label: string;
  detail?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  draftSnap?: Record<string, unknown>;
  index?: number;
  snapshot?: Record<string, unknown>;
};

// ── Full grid state shape
export type GridState = {
  // ── Data
  rows: Record<string, unknown>[];
  nextId: number;

  // ── Column state
  hiddenColumns: Set<string>;
  pinnedColumns: Set<string>;
  columnWidths: Record<string, number>;
  columnOrder: string[]; // explicit order of column keys; [] = use definition order

  // ── Sort
  sortState: SortState;
  sortingMode: SortingMode; // NEW

  // ── Filters
  activeFilters: ActiveFilters;
  searchQuery: string;

  // ── Group
  groupByCol: string | null;
  collapsedGroups: Set<string>;

  // ── Selection
  selectedIds: Set<string>;

  // ── Conditional formatting
  cfRules: CFRule[];

  // ── Aggregations: colKey → mode
  aggregations: Record<string, string>;

  // ── Undo / Redo stacks
  history: HistoryEntry[];
  future: HistoryEntry[];

  // ── Panel
  panelRowId: string | null;

  // ── Keyboard nav
  kbFocusRowId: string | null;
  kbFocusColIdx: number | null;

  // ── UI flags
  isLoading: boolean;
  isFetching: boolean; // NEW — background refetch indicator
  isSaving: boolean;
};

// ── Actions shape
export type GridActions = {
  // Column
  setRows: (rows: Record<string, unknown>[]) => void;
  addRowToStore: (row: Record<string, unknown>) => void;
  removeRowFromStore: (rowId: string) => void;
  updateRowInStore: (rowId: string, data: Record<string, unknown>) => void;

  // Column
  toggleHideColumn: (colKey: string) => void;
  togglePinColumn: (colKey: string) => void;
  setColumnWidth: (colKey: string, width: number) => void;
  showAllColumns: () => void;
  setColumnOrder: (order: string[]) => void;

  // Sort
  setSort: (colKey: string) => void;
  clearSort: () => void;

  // Filter
  setFilter: (colKey: string, value: FilterValue) => void;
  clearFilter: (colKey: string) => void;
  clearAllFilters: () => void;
  setSearchQuery: (query: string) => void;

  // Group
  setGroupBy: (colKey: string | null) => void;
  toggleCollapsedGroup: (groupKey: string) => void;
  clearGroupBy: () => void;

  // Selection
  toggleSelect: (rowId: string) => void;
  toggleSelectAll: (allIds: string[]) => void;
  clearSelection: () => void;
  setSelectedIds: (ids: string[]) => void;

  // Conditional formatting
  addCFRule: () => void;
  updateCFRule: (id: string, updates: Partial<CFRule>) => void;
  deleteCFRule: (id: string) => void;
  setCFRules: (rules: CFRule[]) => void;

  // Aggregation
  setAggregation: (colKey: string, mode: string) => void;

  // History
  pushHistory: (entry: HistoryEntry) => void;
  popHistory: () => HistoryEntry | undefined;
  pushFuture: (entry: HistoryEntry) => void;
  popFuture: () => HistoryEntry | undefined;
  clearFuture: () => void;

  // Panel
  setPanelRowId: (rowId: string | null) => void;

  // Keyboard nav
  setKbFocus: (rowId: string | null, colIdx: number | null) => void;

  // UI flags
  setLoading: (v: boolean) => void;
  setFetching: (v: boolean) => void; // NEW
  setSaving: (v: boolean) => void;
  setSortingMode: (mode: SortingMode) => void; // NEW

  // Reset entire store
  reset: () => void;
};

export type GridStore = GridState & GridActions;

// ── Max history entries
const MAX_HISTORY = 50;

// ── Default CF rules (empty — consumer provides their own)
const DEFAULT_CF_RULES: CFRule[] = [];

// ── Initial state factory (called on create + reset)
const initialState = (): GridState => ({
  rows: [],
  nextId: 1,
  hiddenColumns: new Set(),
  pinnedColumns: new Set(),
  columnWidths: {},
  columnOrder: [], // empty = use definition order
  sortState: null,
  sortingMode: "client", // NEW
  activeFilters: {},
  searchQuery: "",
  groupByCol: null,
  collapsedGroups: new Set(),
  selectedIds: new Set(),
  cfRules: DEFAULT_CF_RULES,
  aggregations: {},
  history: [],
  future: [],
  panelRowId: null,
  kbFocusRowId: null,
  kbFocusColIdx: null,
  isLoading: false,
  isFetching: false, // NEW
  isSaving: false,
});

// ── Create the store
// One store per grid instance — created via createGridStore factory
export const createGridStore = (initialOverrides?: Partial<GridState>) =>
  create<GridStore>()(
    devtools(
      subscribeWithSelector(
        immer((set, get) => ({
          ...initialState(),
          ...initialOverrides,

          // ── Row data ──────────────────────────────────────
          setRows: (rows) =>
            set((state) => {
              state.rows = rows;
            }),

          addRowToStore: (row) =>
            set((state) => {
              state.rows.unshift(row);
              state.nextId += 1;
            }),

          removeRowFromStore: (rowId) =>
            set((state) => {
              state.rows = state.rows.filter(
                (r) => (r as Record<string, unknown>)["_id"] !== rowId,
              );
              state.selectedIds.delete(rowId);
            }),

          updateRowInStore: (rowId, data) =>
            set((state) => {
              const idx = state.rows.findIndex(
                (r) => (r as Record<string, unknown>)["_id"] === rowId,
              );
              if (idx !== -1) {
                state.rows[idx] = { ...state.rows[idx], ...data };
              }
            }),

          // ── Column ────────────────────────────────────────
          toggleHideColumn: (colKey) =>
            set((state) => {
              if (state.hiddenColumns.has(colKey)) {
                state.hiddenColumns.delete(colKey);
              } else {
                state.hiddenColumns.add(colKey);
              }
            }),

          togglePinColumn: (colKey) =>
            set((state) => {
              if (state.pinnedColumns.has(colKey)) {
                state.pinnedColumns.delete(colKey);
              } else {
                state.pinnedColumns.add(colKey);
              }
            }),

          setColumnWidth: (colKey, width) =>
            set((state) => {
              state.columnWidths[colKey] = width;
            }),

          showAllColumns: () =>
            set((state) => {
              state.hiddenColumns.clear();
            }),

          setColumnOrder: (order) =>
            set((state) => {
              state.columnOrder = order;
            }),

          // ── Sort ──────────────────────────────────────────
          // 3-state cycle: none → asc → desc → none (clears on 3rd click)
          setSort: (colKey) =>
            set((state) => {
              if (!state.sortState || state.sortState.colKey !== colKey) {
                // New column — start with asc
                state.sortState = { colKey, direction: "asc" };
              } else if (state.sortState.direction === "asc") {
                // asc → desc
                state.sortState.direction = "desc";
              } else {
                // desc → clear (back to default, unsorted)
                state.sortState = null;
              }
            }),

          clearSort: () =>
            set((state) => {
              state.sortState = null;
            }),

          // ── Filter ────────────────────────────────────────
          setFilter: (colKey, value) =>
            set((state) => {
              state.activeFilters[colKey] = value;
            }),

          clearFilter: (colKey) =>
            set((state) => {
              delete state.activeFilters[colKey];
            }),

          clearAllFilters: () =>
            set((state) => {
              state.activeFilters = {};
            }),

          setSearchQuery: (query) =>
            set((state) => {
              state.searchQuery = query;
            }),

          // ── Group ─────────────────────────────────────────
          setGroupBy: (colKey) =>
            set((state) => {
              state.groupByCol = colKey;
              state.collapsedGroups.clear();
            }),

          toggleCollapsedGroup: (groupKey) =>
            set((state) => {
              if (state.collapsedGroups.has(groupKey)) {
                state.collapsedGroups.delete(groupKey);
              } else {
                state.collapsedGroups.add(groupKey);
              }
            }),

          clearGroupBy: () =>
            set((state) => {
              state.groupByCol = null;
              state.collapsedGroups.clear();
            }),

          // ── Selection ─────────────────────────────────────
          toggleSelect: (rowId) =>
            set((state) => {
              if (state.selectedIds.has(rowId)) {
                state.selectedIds.delete(rowId);
              } else {
                state.selectedIds.add(rowId);
              }
            }),

          toggleSelectAll: (allIds) =>
            set((state) => {
              if (state.selectedIds.size === allIds.length) {
                state.selectedIds.clear();
              } else {
                allIds.forEach((id) => state.selectedIds.add(id));
              }
            }),

          clearSelection: () =>
            set((state) => {
              state.selectedIds.clear();
            }),

          setSelectedIds: (ids) =>
            set((state) => {
              state.selectedIds = new Set(ids);
            }),

          // ── CF Rules ──────────────────────────────────────
          addCFRule: () =>
            set((state) => {
              const newRule: CFRule = {
                id: `cf_${Date.now()}`,
                label: `Rule ${state.cfRules.length + 1}`,
                conditions: [{ field: "", op: "eq", value: "" }],
                logic: "AND",
                backgroundColor: "#FEF3C7",
                textColor: "#92400E",
                enabled: true,
              };
              state.cfRules.push(newRule);
            }),

          updateCFRule: (id, updates) =>
            set((state) => {
              const idx = state.cfRules.findIndex((r) => r.id === id);
              if (idx !== -1) {
                const existing = state.cfRules[idx];
                if (existing) {
                  // Merge updates individually to satisfy exactOptionalPropertyTypes
                  if (updates.label !== undefined)
                    existing.label = updates.label;
                  if (updates.conditions !== undefined)
                    existing.conditions = updates.conditions;
                  if (updates.logic !== undefined)
                    existing.logic = updates.logic;
                  if (updates.backgroundColor !== undefined)
                    existing.backgroundColor = updates.backgroundColor;
                  if (updates.textColor !== undefined)
                    existing.textColor = updates.textColor;
                  if (updates.enabled !== undefined)
                    existing.enabled = updates.enabled;
                }
              }
            }),

          deleteCFRule: (id) =>
            set((state) => {
              state.cfRules = state.cfRules.filter((r) => r.id !== id);
            }),

          setCFRules: (rules) =>
            set((state) => {
              state.cfRules = rules;
            }),

          // ── Aggregation ───────────────────────────────────
          setAggregation: (colKey, mode) =>
            set((state) => {
              state.aggregations[colKey] = mode;
            }),

          // ── History ───────────────────────────────────────
          pushHistory: (entry) =>
            set((state) => {
              state.history.push(entry);
              if (state.history.length > MAX_HISTORY) {
                state.history.shift();
              }
            }),

          popHistory: () => {
            const state = get();
            if (!state.history.length) return undefined;
            const entry = state.history[state.history.length - 1];
            set((s) => {
              s.history.pop();
            });
            return entry;
          },

          pushFuture: (entry) =>
            set((state) => {
              state.future.push(entry);
            }),

          popFuture: () => {
            const state = get();
            if (!state.future.length) return undefined;
            const entry = state.future[state.future.length - 1];
            set((s) => {
              s.future.pop();
            });
            return entry;
          },

          clearFuture: () =>
            set((state) => {
              state.future = [];
            }),

          // ── Panel ─────────────────────────────────────────
          setPanelRowId: (rowId) =>
            set((state) => {
              state.panelRowId = rowId;
            }),

          // ── Keyboard nav ──────────────────────────────────
          setKbFocus: (rowId, colIdx) =>
            set((state) => {
              state.kbFocusRowId = rowId;
              state.kbFocusColIdx = colIdx;
            }),

          // ── UI flags ──────────────────────────────────────
          setLoading: (v) =>
            set((state) => {
              state.isLoading = v;
            }),

          setFetching: (v) =>
            set((state) => {
              state.isFetching = v;
            }),

          setSaving: (v) =>
            set((state) => {
              state.isSaving = v;
            }),

          setSortingMode: (mode) =>
            set((state) => {
              state.sortingMode = mode;
            }),

          // ── Reset ─────────────────────────────────────────
          reset: () =>
            set(() => ({
              ...initialState(),
            })),
        })),
      ),
      { name: "reaktiform-grid" },
    ),
  );

// ── Type of the store instance
export type GridStoreInstance = ReturnType<typeof createGridStore>;
