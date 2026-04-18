// ── reaktiform/headless
// ─────────────────────────────────────────────────────────────
// Hooks only — ZERO UI components, ZERO styles, ZERO CSS.
//
// Use this when you want to build your own UI on top of
// reaktiform's data management, validation, and state logic.
//
// Usage:
//   import { useReaktiform } from 'reaktiform/headless'
//   // No CSS import needed — bring your own UI
//
// The hook returns everything you need:
//   grid.rows             — current row data (draft values applied)
//   grid.processedRows    — sorted + filtered + grouped (TanStack)
//   grid.sortModel        — full multi-column sort stack
//   grid.markDirty()      — mark a field as edited
//   grid.saveRow()        — validate + call onUpdate/onCreate
//   grid.isDirty()        — check if a row has unsaved changes
//   grid.setSort()        — single-column sort (cycles asc/desc/none)
//   grid.setSortMulti()   — multi-column sort (shift+click behaviour)
//   grid.setFilter()      — apply column filter
//   grid.setSearch()      — global search
//   grid.setGroupBy()     — group rows by column
//   grid.evalCF()         — evaluate conditional formatting rules
//   grid.undo() / grid.redo()
// ─────────────────────────────────────────────────────────────

export { useReaktiform } from "./hooks/useReaktiform";
export { useUndo } from "./hooks/useUndo";
export { useDraft } from "./hooks/useDraft";
export { useKeyboardNav } from "./hooks/useKeyboardNav";
export { useConditionalFormat } from "./hooks/useConditionalFormat";
export { useComputedColumns } from "./hooks/useComputedColumns";
export {
  buildZodSchema,
  validateField,
  validateRow,
} from "./validation/buildZodSchema";
export {
  GridStoreProvider,
  useGridStore,
  useGridActions,
  useGridStoreInstance,
} from "./store";

// Formatters — useful for headless consumers formatting cell values in their own UI
export {
  formatDate,
  formatDateLocale,
  getDaysFromToday,
  formatNumber,
  formatCurrency,
  formatPercentage,
  formatDuration,
  formatFileSize,
  truncate,
  highlight,
} from "./utils/formatters";

// All types — fully inferred, no runtime cost
export type {
  ColumnDef,
  ColumnType,
  SelectOption,
  AggregationMode,
  Row,
  RowMeta,
  RowState,
  RowComment,
  RowAttachment,
  FilterValue,
  TextFilterValue,
  NumberFilterValue,
  DateFilterValue,
  SelectFilterValue,
  CheckboxFilterValue,
  ActiveFilters,
  CFRule,
  CFCondition,
  CFConditionOperator,
  CFResult,
  GridConfig,
  GridFeatures,
  GridLabels,
  GridPermissions,
  PanelTab,
  SortState,
  SortChangeParams,
  SortingMode,
  FetchMoreParams,
  FetchParams,
  UseReaktiformReturn,
} from "./types";
