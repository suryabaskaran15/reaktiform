import {
  createContext,
  useContext,
  useRef,
  useMemo,
  type ReactNode,
  useEffect,
} from "react";
import { useStore } from "zustand";
import {
  createGridStore,
  type GridStore,
  type GridStoreInstance,
} from "./gridStore";
import type { GridState } from "./gridStore";
import {
  loadPersistedState,
  useGridPersistence,
} from "../hooks/useGridPersistence";
import { enableMapSet } from "immer";
// ── Context
const GridStoreContext = createContext<GridStoreInstance | null>(null);

// ── Provider — wraps each PMGrid instance
type GridStoreProviderProps = {
  children: ReactNode;
  initialState?: Partial<GridState>;
  // storageKey — if provided, user preferences persist across page refreshes
  storageKey?: string | undefined;
};

export function GridStoreProvider({
  children,
  initialState,
  storageKey,
}: GridStoreProviderProps) {
  const storeRef = useRef<GridStoreInstance | null>(null);

  if (!storeRef.current) {
    storeRef.current = createGridStore(initialState);

    // Load persisted state SYNCHRONOUSLY before first render
    // so columns/filters/CF rules are applied immediately — no flash
    if (storageKey) {
      loadPersistedState(storageKey, storeRef.current);
    }
  }
  useEffect(() => {
    enableMapSet();
  }, []);

  // Subscribe to store changes and persist to localStorage
  // This hook is a no-op if storageKey is undefined
  useGridPersistence(storageKey, storeRef.current);

  return (
    <GridStoreContext.Provider value={storeRef.current}>
      {children}
    </GridStoreContext.Provider>
  );
}

// ── Hook — access store inside any child component
export function useGridStore<T>(selector: (state: GridStore) => T): T {
  const store = useContext(GridStoreContext);
  if (!store) {
    throw new Error(
      "useGridStore must be used inside <GridStoreProvider>. " +
        "Make sure your component is wrapped in <PMGrid>.",
    );
  }
  return useStore(store, selector);
}

// ── Hook — access store actions with stable memoized reference
export function useGridActions() {
  const setRows = useGridStore((s) => s.setRows);
  const addRowToStore = useGridStore((s) => s.addRowToStore);
  const removeRowFromStore = useGridStore((s) => s.removeRowFromStore);
  const updateRowInStore = useGridStore((s) => s.updateRowInStore);
  const toggleHideColumn = useGridStore((s) => s.toggleHideColumn);
  const togglePinColumn = useGridStore((s) => s.togglePinColumn);
  const setColumnWidth = useGridStore((s) => s.setColumnWidth);
  const showAllColumns = useGridStore((s) => s.showAllColumns);
  const setColumnOrder = useGridStore((s) => s.setColumnOrder);
  const setSort = useGridStore((s) => s.setSort);
  const clearSort = useGridStore((s) => s.clearSort);
  const setFilter = useGridStore((s) => s.setFilter);
  const clearFilter = useGridStore((s) => s.clearFilter);
  const clearAllFilters = useGridStore((s) => s.clearAllFilters);
  const setSearchQuery = useGridStore((s) => s.setSearchQuery);
  const setGroupBy = useGridStore((s) => s.setGroupBy);
  const toggleCollapsedGroup = useGridStore((s) => s.toggleCollapsedGroup);
  const clearGroupBy = useGridStore((s) => s.clearGroupBy);
  const toggleSelect = useGridStore((s) => s.toggleSelect);
  const toggleSelectAll = useGridStore((s) => s.toggleSelectAll);
  const clearSelection = useGridStore((s) => s.clearSelection);
  const setSelectedIds = useGridStore((s) => s.setSelectedIds);
  const addCFRule = useGridStore((s) => s.addCFRule);
  const updateCFRule = useGridStore((s) => s.updateCFRule);
  const deleteCFRule = useGridStore((s) => s.deleteCFRule);
  const setCFRules = useGridStore((s) => s.setCFRules);
  const setAggregation = useGridStore((s) => s.setAggregation);
  const pushHistory = useGridStore((s) => s.pushHistory);
  const popHistory = useGridStore((s) => s.popHistory);
  const pushFuture = useGridStore((s) => s.pushFuture);
  const popFuture = useGridStore((s) => s.popFuture);
  const clearFuture = useGridStore((s) => s.clearFuture);
  const setPanelRowId = useGridStore((s) => s.setPanelRowId);
  const setKbFocus = useGridStore((s) => s.setKbFocus);
  const setLoading = useGridStore((s) => s.setLoading);
  const setFetching = useGridStore((s) => s.setFetching);
  const setSaving = useGridStore((s) => s.setSaving);
  const setSortingMode = useGridStore((s) => s.setSortingMode);
  const reset = useGridStore((s) => s.reset);

  return useMemo(
    () => ({
      setRows,
      addRowToStore,
      removeRowFromStore,
      updateRowInStore,
      toggleHideColumn,
      togglePinColumn,
      setColumnWidth,
      showAllColumns,
      setColumnOrder,
      setSort,
      clearSort,
      setFilter,
      clearFilter,
      clearAllFilters,
      setSearchQuery,
      setGroupBy,
      toggleCollapsedGroup,
      clearGroupBy,
      toggleSelect,
      toggleSelectAll,
      clearSelection,
      setSelectedIds,
      addCFRule,
      updateCFRule,
      deleteCFRule,
      setCFRules,
      setAggregation,
      pushHistory,
      popHistory,
      pushFuture,
      popFuture,
      clearFuture,
      setPanelRowId,
      setKbFocus,
      setLoading,
      setFetching,
      setSaving,
      setSortingMode,
      reset,
    }),
    [
      setRows,
      addRowToStore,
      removeRowFromStore,
      updateRowInStore,
      toggleHideColumn,
      togglePinColumn,
      setColumnWidth,
      showAllColumns,
      setColumnOrder,
      setSort,
      clearSort,
      setFilter,
      clearFilter,
      clearAllFilters,
      setSearchQuery,
      setGroupBy,
      toggleCollapsedGroup,
      clearGroupBy,
      toggleSelect,
      toggleSelectAll,
      clearSelection,
      setSelectedIds,
      addCFRule,
      updateCFRule,
      deleteCFRule,
      setCFRules,
      setAggregation,
      pushHistory,
      popHistory,
      pushFuture,
      popFuture,
      clearFuture,
      setPanelRowId,
      setKbFocus,
      setLoading,
      setFetching,
      setSaving,
      setSortingMode,
      reset,
    ],
  );
}
