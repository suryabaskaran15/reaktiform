import type { ColumnDef } from "./column";
import type { CFRule, ActiveFilters } from "./filter";
import type { RowAttachment, RowComment } from "./row";

// ─────────────────────────────────────────────────────────────
//  FEATURE FLAGS
// ─────────────────────────────────────────────────────────────

/**
 * Feature flags for `<Reaktiform>`.
 * All features default to `true` — set to `false` to disable.
 *
 * @example
 * <Reaktiform
 *   features={{
 *     undoRedo:     true,
 *     sidePanel:    true,
 *     export:       true,
 *     columnReorder: true,
 *   }}
 * />
 */
export type GridFeatures = {
  /** Enable group-by column (collapsible row groups). Default: `true` */
  groupBy?: boolean;
  /** Enable conditional formatting rules editor. Default: `true` */
  conditionalFormat?: boolean;
  /** Enable the detail side panel (ReaktiformPanel). Default: `true` */
  sidePanel?: boolean;
  /** Enable undo/redo with Ctrl+Z / Ctrl+Y. Default: `true` */
  undoRedo?: boolean;
  /** Enable column resize by dragging the right edge of a header. Default: `true` */
  columnResize?: boolean;
  /** Enable column pin (sticky left). Default: `true` */
  columnPin?: boolean;
  /** Enable column show/hide panel. Default: `true` */
  columnHide?: boolean;
  /** Enable column reorder by dragging the ⠿ grip in the header. Default: `true` */
  columnReorder?: boolean;
  /** Enable arrow-key keyboard navigation between cells. Default: `true` */
  keyboardNav?: boolean;
  /** Enable CSV export button in the toolbar. Default: `true` */
  export?: boolean;
  /** Row drag-to-reorder. Coming in v2. */
  rowDrag?: boolean;
  /** Import from CSV/XLSX. Coming in v2. */
  import?: boolean;
};

// ─────────────────────────────────────────────────────────────
//  SORT / FILTER TYPES
// ─────────────────────────────────────────────────────────────

/** Current sort state. `null` means unsorted. */
export type SortState = {
  colKey: string;
  direction: "asc" | "desc";
} | null;

/** Aggregation mode for number columns. Cycles via the Σ button in the column header. */
export type AggregationMode = "none" | "sum" | "avg" | "min" | "max" | "count";

/**
 * Controls where sorting, filtering, and search happen.
 *
 * - `'client'` — TanStack Table sorts/filters in memory. No API calls on sort.
 *   Use when all data is loaded at once.
 *
 * - `'server'` — Reaktiform fires `onSortChange`, `onFilterChange`, `onSearchChange`
 *   callbacks. Consumer re-fetches data and updates the `data` prop.
 *   Use with large datasets and infinite scroll (`onFetchMore`).
 */
export type SortingMode = "client" | "server";

/** Parameters passed to `onSortChange`. */
export type SortChangeParams = {
  sortBy: string;
  sortDir: "asc" | "desc";
};

/** Parameters passed to `onFetchMore` during infinite scroll. */
export type FetchMoreParams = {
  /** Last loaded row's ID — for cursor-based pagination APIs. */
  cursor: string | null;
  /** Number of already-loaded rows — for offset-based pagination APIs. */
  offset: number;
  /** How many rows to fetch — equals the `pageSize` prop. */
  limit: number;
};

/** @internal — server-side fetch parameters (used in consumer code, not reaktiform core) */
export type FetchParams = {
  sortBy?: string;
  sortDir?: "asc" | "desc";
  search?: string;
  filters?: Record<string, unknown>;
  page?: number;
  pageSize?: number;
};

// ─────────────────────────────────────────────────────────────
//  MAIN GRID CONFIG
// ─────────────────────────────────────────────────────────────

/**
 * All props for `<Reaktiform>` and `useReaktiform`.
 *
 * @template TData — Your row data type. Inferred automatically when you pass `columns` and `data`.
 *
 * @example
 * ```tsx
 * type RiskRow = { id: string; title: string; status: string }
 *
 * const columns: ColumnDef<RiskRow>[] = [
 *   { key: 'title',  label: 'Title',  type: 'text',   required: true },
 *   { key: 'status', label: 'Status', type: 'select', options: statusOptions },
 * ]
 *
 * <Reaktiform<RiskRow>
 *   columns={columns}
 *   data={rows}
 *   rowIdKey="id"
 *   storageKey="risk-register-v1"
 *   onUpdate={async (row) => await api.patch('/risks', row)}
 * />
 * ```
 */
export type GridConfig<TData = Record<string, unknown>> = {
  // ── Required ───────────────────────────────────────────────

  /**
   * Column definitions. Each entry describes one column — its type, label,
   * validation rules, display options, and optional async/creatable select config.
   *
   * @see ColumnDef
   */
  columns: ColumnDef<TData>[];

  /**
   * The row data to display. In client mode, pass the full dataset.
   * In server mode, pass only the currently-loaded page — reaktiform will
   * append more rows as `onFetchMore` is called.
   */
  data: TData[];

  /**
   * The field in your data object used as the unique row identifier.
   * Defaults to `'id'`.
   *
   * @default 'id'
   * @example rowIdKey="uuid"
   */
  rowIdKey?: keyof TData & string;

  // ── Sorting & Filtering Mode ────────────────────────────────

  /**
   * Controls where sorting, filtering, and search are handled.
   *
   * - `'client'` — Everything happens in memory via TanStack Table.
   *   Best for datasets under ~10,000 rows.
   *
   * - `'server'` — Reaktiform fires callbacks (`onSortChange`, `onFilterChange`,
   *   `onSearchChange`) and you re-fetch. Required for infinite scroll.
   *
   * @default 'client'
   */
  sortingMode?: SortingMode;

  // ── Loading States ──────────────────────────────────────────

  /**
   * Show a full skeleton loader instead of rows.
   * Set to `true` during the initial data fetch.
   * @default false
   */
  isLoading?: boolean;

  /**
   * Show a subtle animated progress bar at the top of the grid.
   * Set to `true` during background refetches (e.g. after sort change in server mode).
   * Does not block interaction.
   * @default false
   */
  isFetching?: boolean;

  /**
   * Show a "Loading more…" spinner in the footer.
   * Set to `true` while `onFetchMore` is in-flight.
   * @default false
   */
  isFetchingMore?: boolean;

  // ── Infinite Scroll ─────────────────────────────────────────

  /**
   * Total number of rows on the server.
   * Reaktiform uses this to size the virtualised scroll area correctly —
   * the scrollbar reflects the full dataset even before all rows are loaded.
   *
   * Only meaningful with `sortingMode='server'`.
   *
   * @example totalRows={5000}
   */
  totalRows?: number;

  /**
   * Called when the user scrolls near the end of the loaded rows.
   * Append the returned rows to your `data` array — do NOT replace it.
   *
   * Fires `fetchThreshold` rows before the user reaches the end, so data
   * arrives before they need it — zero perceived loading.
   *
   * @example
   * onFetchMore={async ({ offset, limit }) => {
   *   const page = await api.get('/rows', { offset, limit })
   *   setData(prev => [...prev, ...page.rows])
   * }}
   */
  onFetchMore?: (params: FetchMoreParams) => Promise<void> | void;

  /**
   * How many rows from the end of loaded data to start pre-fetching.
   * @default 15
   */
  fetchThreshold?: number;

  /**
   * How many rows to request per `onFetchMore` call.
   * @default 30
   */
  pageSize?: number;

  // ── Server-Mode Callbacks ────────────────────────────────────

  /**
   * Called when the user sorts a column (server mode only).
   * Update your query params and re-fetch data.
   *
   * Wrap in `useCallback` to prevent infinite re-render loops.
   *
   * @example
   * onSortChange={useCallback(({ sortBy, sortDir }) => {
   *   setQuery(prev => ({ ...prev, sortBy, sortDir }))
   * }, [])}
   */
  onSortChange?: (params: SortChangeParams) => void;

  /**
   * Called when the user applies a column filter (server mode only).
   * @example
   * onFilterChange={useCallback((filters) => {
   *   setQuery(prev => ({ ...prev, filters }))
   * }, [])}
   */
  onFilterChange?: (filters: ActiveFilters) => void;

  /**
   * Called when the user types in the global search box (server mode only).
   * Debounce this yourself if needed.
   * @example
   * onSearchChange={useCallback((search) => {
   *   setQuery(prev => ({ ...prev, search }))
   * }, [])}
   */
  onSearchChange?: (search: string) => void;

  // ── Row Mutation Callbacks ────────────────────────────────────

  /**
   * Called when a new row is saved for the first time.
   * Return the server response to merge server-generated fields
   * (e.g. `id`, `createdAt`) back into the row.
   *
   * @example
   * onCreate={async (row) => {
   *   const saved = await api.post('/rows', row)
   *   return saved   // merged back into grid state
   * }}
   */
  onCreate?: (row: TData) => Promise<TData | void> | void;

  /**
   * Called when an existing row is saved after editing.
   * Return the server response to pick up any server-side changes.
   *
   * @example
   * onUpdate={async (row) => {
   *   const saved = await api.patch(`/rows/${row.id}`, row)
   *   return saved
   * }}
   */
  onUpdate?: (row: TData) => Promise<TData | void> | void;

  /**
   * Fallback save handler used when `onCreate` / `onUpdate` are not provided.
   * Receives `isNew: true` for new rows, `false` for updates.
   */
  onSave?: (row: TData, isNew: boolean) => Promise<TData | void> | void;

  /**
   * Called by "Save All" when multiple rows are dirty.
   * More efficient than calling `onUpdate` N times — single API call.
   *
   * @example
   * onBulkSave={async (rows) => {
   *   const saved = await api.put('/rows/bulk', rows)
   *   return saved
   * }}
   */
  onBulkSave?: (rows: TData[]) => Promise<TData[] | void> | void;

  /**
   * Called when a row is deleted.
   * Remove the row from your data source here.
   *
   * @example
   * onDelete={async (id) => {
   *   await api.delete(`/rows/${id}`)
   *   setData(prev => prev.filter(r => r.id !== id))
   * }}
   */
  onDelete?: (id: string) => Promise<void> | void;

  /** Called when multiple rows are deleted at once (bulk delete). */
  onBulkDelete?: (ids: string[]) => Promise<void> | void;

  /** Called when a new empty row is added via the "Add record" button. */
  onAdd?: (row: TData) => void;

  // ── Features ────────────────────────────────────────────────

  /**
   * Enable or disable individual features.
   * All features default to `true`. Pass `false` to hide a specific feature.
   *
   * @example
   * features={{ undoRedo: true, export: true, sidePanel: true }}
   */
  features?: GridFeatures;

  // ── Initial State ────────────────────────────────────────────

  /**
   * Initial sort applied when the grid first mounts.
   * Overridden by `storageKey` if a saved sort exists in localStorage.
   *
   * @example initialSort={{ colKey: 'createdAt', direction: 'desc' }}
   */
  initialSort?: SortState;

  /** Initial column to group rows by. */
  initialGroupBy?: string;

  /** Initial column filters applied on mount. */
  initialFilters?: Record<string, unknown>;

  /** Initial conditional formatting rules. */
  initialCFRules?: CFRule[];

  /**
   * Columns pinned (sticky left) on initial mount.
   * @example initialPinnedColumns={['id', 'status']}
   */
  initialPinnedColumns?: string[];

  /**
   * Columns hidden on initial mount.
   * @example initialHiddenColumns={['internalNotes', 'rawScore']}
   */
  initialHiddenColumns?: string[];

  // ── Detail Panel Callbacks ───────────────────────────────────

  /** Load comments for a row when the detail panel opens. */
  onLoadComments?: (rowId: string) => Promise<RowComment[]>;

  /**
   * Add a comment to a row from the detail panel.
   * @example
   * onAddComment={async (rowId, text) => {
   *   return await api.post(`/rows/${rowId}/comments`, { text })
   * }}
   */
  onAddComment?: (rowId: string, text: string) => Promise<RowComment>;

  /** Load file attachments for a row when the detail panel opens. */
  onLoadAttachments?: (rowId: string) => Promise<RowAttachment[]>;

  /**
   * Upload a file attachment from the detail panel.
   * @example
   * onUploadFile={async (rowId, file) => {
   *   const form = new FormData()
   *   form.append('file', file)
   *   return await api.post(`/rows/${rowId}/attachments`, form)
   * }}
   */
  onUploadFile?: (rowId: string, file: File) => Promise<RowAttachment>;

  /** Delete an attachment from the detail panel. */
  onDeleteAttachment?: (rowId: string, attachmentId: string) => Promise<void>;

  // ── Styling ──────────────────────────────────────────────────

  /** Additional CSS class on the root element. */
  className?: string | undefined;

  /** Inline styles on the root element. */
  style?: React.CSSProperties;

  /**
   * Max height of the scrollable table area.
   * Defaults to `calc(100vh - 300px)`.
   * @example maxHeight={600}
   * @example maxHeight="70vh"
   */
  maxHeight?: string | number;

  /**
   * Max height of the scrollable table area.
   * Defaults to `calc(100vh - 300px)`.
   * @example minHeight={600}
   * @example minHeight="70vh"
   */
  minHeight?: string | number;

  // ── Persistence ──────────────────────────────────────────────

  /**
   * localStorage key for persisting user preferences.
   *
   * When set, the following survive page refresh:
   * column widths, pinned/hidden columns, sort state, active filters,
   * group-by selection, aggregation modes, conditional formatting rules,
   * and column order.
   *
   * Use a unique key per grid instance. Append a version suffix to
   * invalidate saved state after a schema change.
   *
   * @example storageKey="risk-register-v1"
   *
   * To clear preferences programmatically (e.g. "Reset to defaults"):
   * ```ts
   * import { clearPersistedState } from 'reaktiform'
   * clearPersistedState('risk-register-v1')
   * ```
   */
  storageKey?: string;

  // ── i18n ────────────────────────────────────────────────────

  /**
   * Override any UI label string.
   * @example labels={{ newRecord: 'New Risk', saveAll: 'Publish All' }}
   */
  labels?: Partial<GridLabels>;
};

// ─────────────────────────────────────────────────────────────
//  GRID LABELS — all overridable UI strings
// ─────────────────────────────────────────────────────────────

/** All text strings rendered by Reaktiform. Override any via the `labels` prop. */
export type GridLabels = {
  addRecord: string;
  saveAll: string;
  discardAll: string;
  save: string;
  discard: string;
  search: string;
  filter: string;
  pin: string;
  unpin: string;
  groupBy: string;
  removeGroup: string;
  columns: string;
  export: string;
  import: string;
  conditionalFormat: string;
  unsavedRows: string;
  noRecords: string;
  loadingRecords: string;
  addFilter: string;
  clearFilter: string;
  clearAllFilters: string;
  activeFilters: string;
  required: string;
  newRecord: string;
  duplicate: string;
  delete: string;
  details: string;
  activity: string;
  attachments: string;
  addComment: string;
  uploadFile: string;
  postComment: string;
  saveChanges: string;
};

export type { FilterValue, ActiveFilters } from "./filter";

// ─────────────────────────────────────────────────────────────
//  USE REAKTIFORM RETURN
// ─────────────────────────────────────────────────────────────

/**
 * Return type of `useReaktiform()`.
 * The actual shape is fully inferred — use this type for variable annotations.
 *
 * @example
 * ```ts
 * import type { UseReaktiformReturn } from 'reaktiform'
 * const grid = useReaktiform<MyRow>(config)
 * // grid is fully typed — IDE autocomplete works without this annotation
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UseReaktiformReturn = Record<string, any> & {
  columns: unknown;
  rows: unknown;
};
