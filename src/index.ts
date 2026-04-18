// ── reaktiform
// Main entry point — full UI + hooks + types
//
// Sub-path imports:
//   import { useReaktiform }   from 'reaktiform/headless'   // hooks only
//   import { TextCellEdit }    from 'reaktiform/cells'      // cell components
//   import { Badge }           from 'reaktiform/primitives' // UI primitives
//   import { formatDate }      from 'reaktiform/utils'      // formatters
//   import 'reaktiform/styles'                              // CSS (always needed)

// ── UI Components
export { Reaktiform } from "./components/Reaktiform";
export { ReaktiformPanel } from "./components/ReaktiformPanel";
export type { ReaktiformPanelProps } from "./components/ReaktiformPanel";

// ── Cell components (also available from reaktiform/cells)
export { TextCellRead, TextCellEdit } from "./components/cells/TextCell";
export { NumberCellRead, NumberCellEdit } from "./components/cells/NumberCell";
export {
  SelectCellRead,
  SelectCellEdit,
  SelectOverlay,
  cachedLoadOptions,
  invalidateLoadOptionsCache,
} from "./components/cells/SelectCell";
export {
  MultiSelectCellRead,
  MultiSelectCellEdit,
} from "./components/cells/MultiSelectCell";
export { DateCellRead, DateCellEdit } from "./components/cells/DateCell";
export { CheckboxCell } from "./components/cells/CheckboxCell";
export { ComputedCell } from "./components/cells/ComputedCell";
export { CellRenderer } from "./components/cells/CellRenderer";
export { FieldWrapper } from "./components/cells/FieldWrapper";

// ── Primitives (also available from reaktiform/primitives)
export { Badge, OptionBadge } from "./components/primitives/Badge";
export { ProgressBar } from "./components/primitives/ProgressBar";

// ── Hooks
export { useReaktiform } from "./hooks/useReaktiform";
export { useUndo } from "./hooks/useUndo";
export { useDraft } from "./hooks/useDraft";
export { useKeyboardNav } from "./hooks/useKeyboardNav";
export { useConditionalFormat } from "./hooks/useConditionalFormat";
export { useComputedColumns } from "./hooks/useComputedColumns";

// ── Store (for advanced headless usage)
export { GridStoreProvider } from "./store";

// ── Formatters (also available from reaktiform/utils)
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

// ── Validation
export {
  buildZodSchema,
  validateField,
  validateRow,
} from "./validation/buildZodSchema";

// ── Persistence
export { clearPersistedState } from "./hooks/useGridPersistence";

// ── All TypeScript types ─────────────────────────────────────

export type {
  // Column
  ColumnDef,
  ColumnType,
  SelectOption,
  AggregationMode,

  // Row
  Row,
  RowMeta,
  RowState,
  RowComment,
  RowAttachment,

  // Filters & Conditional Formatting
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

  // Config
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

// ── CSS — consumers import separately:
// import 'reaktiform/styles'
