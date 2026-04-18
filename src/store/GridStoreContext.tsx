import {
  createContext,
  useContext,
  useRef,
  useMemo,
  type ReactNode,
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

// ── Context
const GridStoreContext = createContext<GridStoreInstance | null>(null);

// ── Provider — wraps each Reaktiform instance
type GridStoreProviderProps = {
  children: ReactNode;
  initialState?: Partial<GridState>;
  storageKey?: string;
};

export function GridStoreProvider({
  children,
  initialState,
  storageKey,
}: GridStoreProviderProps) {
  const storeRef = useRef<GridStoreInstance | null>(null);

  if (!storeRef.current) {
    storeRef.current = createGridStore(initialState);
    if (storageKey) {
      loadPersistedState(storageKey, storeRef.current);
    }
  }

  useGridPersistence(storageKey, storeRef.current);

  return (
    <GridStoreContext.Provider value={storeRef.current}>
      {children}
    </GridStoreContext.Provider>
  );
}

// ── Hook — subscribe to store with a selector
export function useGridStore<T>(selector: (state: GridStore) => T): T {
  const store = useContext(GridStoreContext);
  if (!store) {
    throw new Error(
      "useGridStore must be used inside <GridStoreProvider>. " +
        "Make sure your component is wrapped in <Reaktiform>.",
    );
  }
  return useStore(store, selector);
}

// ── Hook — access the raw store instance (for getState() in effects)
export function useGridStoreInstance(): GridStoreInstance {
  const store = useContext(GridStoreContext);
  if (!store) {
    throw new Error(
      "useGridStoreInstance must be used inside <GridStoreProvider>.",
    );
  }
  return store;
}

// ── Hook — access store actions with stable memoized references
export function useGridActions() {
  const setRows = useGridStore((s) => s.setRows);
  const mergeRows = useGridStore((s) => s.mergeRows);
  const addRowToStore = useGridStore((s) => s.addRowToStore);
  const removeRowFromStore = useGridStore((s) => s.removeRowFromStore);
  const updateRowInStore = useGridStore((s) => s.updateRowInStore);
  const toggleHideColumn = useGridStore((s) => s.toggleHideColumn);
  const togglePinColumn = useGridStore((s) => s.togglePinColumn);
  const setColumnWidth = useGridStore((s) => s.setColumnWidth);
  const showAllColumns = useGridStore((s) => s.showAllColumns);
  const setColumnOrder = useGridStore((s) => s.setColumnOrder);
  const setSort = useGridStore((s) => s.setSort);
  const setSortMulti = useGridStore((s) => s.setSortMulti);
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
      mergeRows,
      addRowToStore,
      removeRowFromStore,
      updateRowInStore,
      toggleHideColumn,
      togglePinColumn,
      setColumnWidth,
      showAllColumns,
      setColumnOrder,
      setSort,
      setSortMulti,
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
      mergeRows,
      addRowToStore,
      removeRowFromStore,
      updateRowInStore,
      toggleHideColumn,
      togglePinColumn,
      setColumnWidth,
      showAllColumns,
      setColumnOrder,
      setSort,
      setSortMulti,
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
