import { useEffect, useRef } from "react";
import type { GridStoreInstance } from "../store/gridStore";
import type { ActiveFilters, CFRule } from "../types";

// ─────────────────────────────────────────────────────────────
//  PERSISTED STATE SHAPE
//  Only user preferences — never raw row data or transient UI state.
//  Sort and groupBy are intentionally excluded — they are session-only
//  (resetting them on reload prevents confusing "why is this sorted?" UX).
// ─────────────────────────────────────────────────────────────
type PersistedState = {
  version: number;
  columnWidths: Record<string, number>;
  hiddenColumns: string[];
  pinnedColumns: string[];
  columnOrder: string[];
  activeFilters: ActiveFilters;
  aggregations: Record<string, string>;
  cfRules: CFRule[];
};

// ─────────────────────────────────────────────────────────────
//  VERSION — bump this whenever the persisted shape changes.
//  Old data is automatically cleared on version mismatch.
//  v1 → v2: added sortModel to store state
// ─────────────────────────────────────────────────────────────
const STORAGE_VERSION = 2;

// ─────────────────────────────────────────────────────────────
//  SAFE READ — never throws, returns null on any error
// ─────────────────────────────────────────────────────────────
function readStorage(key: string): PersistedState | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    // Invalidate if version changed
    if (parsed.version !== STORAGE_VERSION) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
//  SAFE WRITE — never throws
// ─────────────────────────────────────────────────────────────
function writeStorage(key: string, state: PersistedState): void {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Storage full or unavailable — fail silently
  }
}

// ─────────────────────────────────────────────────────────────
//  LOAD PERSISTED STATE INTO STORE
//  Called once on mount before first render
// ─────────────────────────────────────────────────────────────
export function loadPersistedState(
  storageKey: string,
  store: GridStoreInstance,
): void {
  const saved = readStorage(storageKey);
  if (!saved) return;

  const state = store.getState();

  // Apply each saved preference via store actions
  if (saved.columnWidths) {
    Object.entries(saved.columnWidths).forEach(([col, width]) => {
      state.setColumnWidth(col, width);
    });
  }
  if (saved.hiddenColumns?.length) {
    saved.hiddenColumns.forEach((col) => state.toggleHideColumn(col));
  }
  if (saved.pinnedColumns?.length) {
    saved.pinnedColumns.forEach((col) => state.togglePinColumn(col));
  }
  if (saved.columnOrder?.length) {
    state.setColumnOrder(saved.columnOrder);
  }
  // sortState and groupByCol intentionally not restored — session-only
  if (saved.activeFilters && Object.keys(saved.activeFilters).length) {
    Object.entries(saved.activeFilters).forEach(([col, filter]) => {
      state.setFilter(col, filter);
    });
  }
  // NOTE: sortState and groupByCol are NOT restored — session-only preferences
  if (saved.aggregations && Object.keys(saved.aggregations).length) {
    Object.entries(saved.aggregations).forEach(([col, mode]) => {
      state.setAggregation(col, mode);
    });
  }
  if (saved.cfRules?.length) {
    state.setCFRules(saved.cfRules);
  }
}

// ─────────────────────────────────────────────────────────────
//  useGridPersistence HOOK
//  Subscribes to store changes and writes to localStorage.
//  Debounced at 300ms to batch rapid changes (e.g. column resize).
// ─────────────────────────────────────────────────────────────
export function useGridPersistence(
  storageKey: string | undefined,
  store: GridStoreInstance | null,
): void {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storeRef = useRef(store);
  storeRef.current = store;

  useEffect(() => {
    if (!storageKey || !store) return;

    // Subscribe to ALL store changes.
    // subscribeWithSelector lets us pick exactly what to watch.
    // We watch the whole state but only write the fields we care about.
    const unsubscribe = store.subscribe((state) => {
      // Cancel any pending write
      if (debounceRef.current) clearTimeout(debounceRef.current);

      // Debounce — batch rapid changes (column resize fires ~60x/sec)
      debounceRef.current = setTimeout(() => {
        const persisted: PersistedState = {
          version: STORAGE_VERSION,
          columnWidths: state.columnWidths,
          hiddenColumns: [...state.hiddenColumns],
          pinnedColumns: [...state.pinnedColumns],
          columnOrder: state.columnOrder,
          activeFilters: state.activeFilters,
          aggregations: state.aggregations,
          cfRules: state.cfRules,
          // sortState and groupByCol intentionally excluded
        };
        writeStorage(storageKey, persisted);
      }, 300);
    });

    return () => {
      // Clean up subscription and any pending write on unmount
      unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [storageKey, store]);
}

// ─────────────────────────────────────────────────────────────
//  CLEAR PERSISTED STATE — exported for consumer use
//  e.g. "Reset to defaults" button
// ─────────────────────────────────────────────────────────────
export function clearPersistedState(storageKey: string): void {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // Ignore
  }
}
