import type React from "react";
import type { ColumnDef, AggregationMode } from "./column";
import type { CFRule, ActiveFilters } from "./filter";
import type { RowAttachment, RowComment } from "./row";

// ─────────────────────────────────────────────────────────────
//  PERMISSIONS — role-based access control
// ─────────────────────────────────────────────────────────────

/**
 * Fine-grained permission control for Reaktiform.
 *
 * All permissions default to `true` (fully open).
 * Pass `false` to lock down a capability.
 * Pass a function for row-level or column-level control.
 *
 * @example
 * // Viewer role — read only
 * permissions={{ canCreate: false, canEdit: false, canDelete: false }}
 *
 * @example
 * // Editor role — can edit but not delete
 * permissions={{ canCreate: true, canEdit: true, canDelete: false }}
 *
 * @example
 * // Row-level: only edit rows you own
 * permissions={{
 *   canEdit: (row) => row.ownerId === currentUser.id,
 *   canDelete: (row) => row.ownerId === currentUser.id || currentUser.role === 'admin',
 * }}
 *
 * @example
 * // Column-level: lock specific fields
 * permissions={{
 *   canEditColumn: (colKey) => !['id', 'createdAt', 'status'].includes(colKey),
 * }}
 */
export type GridPermissions = {
  /**
   * Allow creating new rows via the "+ New Record" button.
   * @default true
   */
  canCreate?: boolean;

  /**
   * Allow editing cell values inline.
   * Pass a function for row-level control.
   * @default true
   */
  canEdit?: boolean | ((row: Record<string, unknown>) => boolean);

  /**
   * Allow deleting rows.
   * Pass a function for row-level control.
   * @default true
   */
  canDelete?: boolean | ((row: Record<string, unknown>) => boolean);

  /**
   * Allow saving changes (Save / Save All buttons).
   * Useful when you want to allow editing the UI state but block persistence.
   * @default true
   */
  canSave?: boolean;

  /**
   * Allow exporting to CSV.
   * @default true
   */
  canExport?: boolean;

  /**
   * Allow duplicating rows.
   * @default true
   */
  canDuplicate?: boolean | ((row: Record<string, unknown>) => boolean);

  /**
   * Column-level edit control.
   * Return false for a column key to make that column read-only.
   * Applied on top of canEdit — both must pass for a cell to be editable.
   *
   * @example
   * // Lock id, createdAt, and status to read-only
   * canEditColumn: (colKey) => !['id', 'createdAt', 'status'].includes(colKey)
   */
  canEditColumn?: (colKey: string) => boolean;

  /**
   * Allow adding comments in the detail panel Activity tab.
   * @default true
   */
  canComment?: boolean;

  /**
   * Allow uploading file attachments in the detail panel Files tab.
   * @default true
   */
  canUploadFiles?: boolean;
};

// ─────────────────────────────────────────────────────────────
//  PANEL TAB CONFIGURATION
// ─────────────────────────────────────────────────────────────

/**
 * Which tabs to show in the detail side panel.
 * Defaults to all three tabs.
 *
 * @example
 * // Details only — no activity or files
 * panelTabs={['details']}
 *
 * @example
 * // Details + activity, no files
 * panelTabs={['details', 'activity']}
 */
export type PanelTab = "details" | "activity" | "files";

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
  /**
   * Enable export button in the toolbar. Default: `true`
   * Controls both CSV and Excel buttons.
   * Use `onExport` for server-side export (full dataset, not just loaded rows).
   */
  export?: boolean;
  /**
   * Show the # row-number column. Default: `true`
   * @example showRowNumbers={false}
   */
  showRowNumbers?: boolean;
  /**
   * Show the checkbox selection column. Default: `true`
   * @example showSelectColumn={false}
   */
  showSelectColumn?: boolean;
  /**
   * Show the › expander column that opens the detail panel. Default: `true`
   * @example showExpanderColumn={false}
   */
  showExpanderColumn?: boolean;
  /**
   * Show the Actions column (Save/Discard/Duplicate/Delete). Default: `true`
   * @example showActionsColumn={false}
   */
  showActionsColumn?: boolean;
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
// AggregationMode is defined in column.ts and re-exported from there

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
  /** Primary sort column key (first entry in sortModel). */
  sortBy: string;
  /** Primary sort direction. */
  sortDir: "asc" | "desc";
  /**
   * Full multi-sort model — only present when >1 column is sorted (shift+click).
   * Undefined for single-column sort (backward compatible).
   * @example [{ colKey: 'name', direction: 'asc' }, { colKey: 'date', direction: 'desc' }]
   */
  sortModel?: { colKey: string; direction: "asc" | "desc" }[] | undefined;
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

  /**
   * Called when the user changes the aggregation mode for a column (server mode only).
   * Fire an API request to compute the aggregate over the full dataset and
   * update `aggregationValues` with the result.
   *
   * In client mode this is ignored — aggregation is computed in memory.
   *
   * Wrap in `useCallback` to prevent re-render loops.
   *
   * @example
   * onAggregationChange={useCallback(async (colKey, mode) => {
   *   if (mode === 'none') {
   *     setAggValues(prev => { const n = { ...prev }; delete n[colKey]; return n })
   *     return
   *   }
   *   const result = await api.post('/rows/aggregate', { colKey, mode, filters: query.filters })
   *   setAggValues(prev => ({ ...prev, [colKey]: result.value }))
   * }, [query.filters])}
   */
  onAggregationChange?: (colKey: string, mode: AggregationMode) => void;

  /**
   * Server-computed aggregation values per column key.
   * Only used in server mode — displayed in the tfoot row instead of
   * computing locally from the loaded page (which would be wrong for
   * paginated data).
   *
   * Values are displayed as-is — format them server-side.
   *
   * @example
   * aggregationValues={{ probability: 67.4, completion: 58.1 }}
   */
  aggregationValues?: Record<string, number | string>;

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

  // ── Save result callbacks ─────────────────────────────────

  /**
   * Called after a row is successfully saved (after onCreate/onUpdate resolves).
   * Use this to show a toast or trigger other side effects.
   *
   * @example
   * onSaveSuccess={(row, isNew) => toast.success(`${isNew ? 'Created' : 'Updated'} successfully`)}
   */
  onSaveSuccess?: (row: TData, isNew: boolean) => void;

  /**
   * Called when a row save fails (onCreate/onUpdate throws).
   * Use this to show an error toast.
   *
   * @example
   * onSaveError={(err, row) => toast.error(`Save failed: ${err.message}`)}
   */
  onSaveError?: (err: Error, row: TData, isNew: boolean) => void;

  // ── Export callbacks ─────────────────────────────────────────

  /**
   * Server-side export callback.
   *
   * When provided, the Export button calls this instead of the built-in
   * client-side export. Use this in server-side mode where only a page of
   * records is loaded — your handler fetches ALL records and triggers a download.
   *
   * If not provided, the built-in client-side export runs on loaded rows.
   *
   * @param format  'csv' | 'xlsx'
   *
   * @example
   * onExport={async (format) => {
   *   const res  = await api.get(`/rows/export?format=${format}`)
   *   const blob = await res.blob()
   *   const url  = URL.createObjectURL(blob)
   *   const a    = document.createElement('a')
   *   a.href     = url
   *   a.download = `export.${format}`
   *   a.click()
   *   URL.revokeObjectURL(url)
   * }}
   */
  onExport?: (format: "csv" | "xlsx") => Promise<void> | void;

  // ── Sync / Refresh ───────────────────────────────────────────

  /**
   * Provide this callback to show a Sync button in the toolbar.
   * Clicking it calls this function and shows a loading spinner.
   * Use it to re-fetch fresh data from the server.
   *
   * @example
   * onRefresh={async () => {
   *   const fresh = await api.get('/rows')
   *   setData(fresh.data)
   * }}
   */
  onRefresh?: () => Promise<void> | void;

  // ── Features ────────────────────────────────────────────────

  /**
   * Enable or disable individual features.
   * All features default to `true`. Pass `false` to hide a specific feature.
   *
   * @example
   * features={{ undoRedo: true, export: true, sidePanel: true }}
   */
  features?: GridFeatures;

  // ── Permissions (Role-based access control) ──────────────────

  /**
   * Fine-grained permission control.
   * All permissions default to `true` (fully open).
   *
   * @example
   * // Viewer — read only
   * permissions={{ canCreate: false, canEdit: false, canDelete: false }}
   *
   * @example
   * // Row-level edit control
   * permissions={{
   *   canEdit:   (row) => row.ownerId === currentUser.id,
   *   canDelete: (row) => currentUser.role === 'admin',
   * }}
   */
  permissions?: GridPermissions;

  // ── Panel tabs ────────────────────────────────────────────────

  /**
   * Which tabs to show in the detail side panel.
   * Defaults to all three: ['details', 'activity', 'files'].
   *
   * Tabs are also auto-hidden when their callback is not provided:
   * - 'activity' tab is hidden if onAddComment is not provided
   * - 'files' tab is hidden if onUploadFile is not provided
   *
   * @example
   * // Details only
   * panelTabs={['details']}
   *
   * @example
   * // Details + activity, no files
   * panelTabs={['details', 'activity']}
   */
  panelTabs?: PanelTab[];

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
   * Min height of the scrollable table area.
   * Defaults to `380px`. Set to fit your layout.
   * @example minHeight={200}
   * @example minHeight="30vh"
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

  // ── Row events ───────────────────────────────────────────────

  /**
   * Called when the user clicks a row (not a cell — the row itself).
   * Useful for navigation, selection, or preview panels.
   * @example
   * onRowClick={(row) => router.push(`/records/${row.id}`)}
   */
  onRowClick?: (row: TData) => void;

  /**
   * Called on double-click of a row.
   * @example
   * onRowDoubleClick={(row) => openModal(row)}
   */
  onRowDoubleClick?: (row: TData) => void;

  /**
   * Called whenever the selected row IDs change.
   * @example
   * onSelectionChange={(ids, rows) => setSelectedItems(rows)}
   */
  onSelectionChange?: (ids: string[], rows: TData[]) => void;

  // ── Row appearance ───────────────────────────────────────────

  /**
   * Dynamic CSS class applied to each row.
   * Runs on every row render — keep it fast (avoid side effects).
   * @example
   * rowClassName={(row) => row.status === 'overdue' ? 'rf-row-danger' : undefined}
   */
  rowClassName?: (row: TData) => string | undefined;

  /**
   * Dynamic inline style applied to each row.
   * @example
   * rowStyle={(row) => ({ opacity: row.archived ? 0.5 : 1 })}
   */
  rowStyle?: (row: TData) => React.CSSProperties | undefined;

  /**
   * Row height in pixels. Default: 46.
   * Increasing this gives more room for multi-line text or larger cells.
   * @default 46
   * @example rowHeight={64}
   */
  rowHeight?: number;

  // ── Row-level permissions ────────────────────────────────────

  /**
   * Disable interaction for specific rows — they appear greyed out
   * and cannot be selected, edited, or deleted.
   * @example
   * isRowDisabled={(row) => row.status === 'locked'}
   */
  isRowDisabled?: (row: TData) => boolean;

  /**
   * Control which rows can be selected via the checkbox column.
   * @example
   * isRowSelectable={(row) => row.status !== 'archived'}
   */
  isRowSelectable?: (row: TData) => boolean;

  // ── Selection mode ───────────────────────────────────────────

  /**
   * Selection behavior for the checkbox column.
   * - 'multi'  — checkboxes, select-all, range select (shift+click). Default.
   * - 'single' — radio-like, only one row selected at a time.
   * - 'none'   — no selection column, no selection state.
   * @default 'multi'
   */
  selectionMode?: "multi" | "single" | "none";

  // ── Expanded row ─────────────────────────────────────────────

  /**
   * Render custom JSX below an expanded row.
   * The › expand button (showExpanderColumn) opens/closes the expanded area.
   *
   * Use for sub-tables, detail cards, embedded charts, etc.
   *
   * @example
   * renderExpandedRow={(row) => (
   *   <SubTaskTable parentId={row.id} />
   * )}
   */
  renderExpandedRow?: (row: TData) => React.ReactNode;

  /**
   * Height of the expanded row area in pixels. Default: auto.
   * If not set, the expanded area grows to fit its content.
   */
  expandedRowHeight?: number;

  // ── Empty state ──────────────────────────────────────────────

  /**
   * Custom content rendered when there are no rows to display.
   * Replaces the default "No records found" message.
   *
   * @example
   * emptyState={
   *   <div style={{ textAlign: 'center', padding: 40 }}>
   *     <EmptyIcon />
   *     <p>No records yet. Click "+ New Record" to create one.</p>
   *   </div>
   * }
   */
  emptyState?: React.ReactNode;

  // ── Toolbar ──────────────────────────────────────────────────

  /**
   * Render additional content inside the toolbar — to the left of the
   * row count / action buttons.
   *
   * @example
   * toolbarLeft={<StatusFilterTabs value={tab} onChange={setTab} />}
   */
  toolbarLeft?: React.ReactNode;

  /**
   * Render additional content inside the toolbar — to the right of the
   * standard buttons (before "+ New Record").
   *
   * @example
   * toolbarRight={<ImportButton onImport={handleImport} />}
   */
  toolbarRight?: React.ReactNode;
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
  // New in v1.1
  sync: string;
  undo: string;
  redo: string;
  selected: string;
  deleteSelected: string;
  exportSelected: string;
  showAll: string;
  hideColumn: string;
  reorderColumns: string;
  loadingMore: string;
  rowsLoaded: string;
  saveFailed: string;
  saving: string;
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
