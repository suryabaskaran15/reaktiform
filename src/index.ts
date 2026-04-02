// ── reaktiform
// Main entry point

// ── Components
export { Reaktiform } from "./components/Reaktiform";
export { ReaktiformPanel } from "./components/ReaktiformPanel";
export type { ReaktiformPanelProps } from "./components/ReaktiformPanel";

// ── Hooks
export { useReaktiform } from "./hooks/useReaktiform";
export { useUndo } from "./hooks/useUndo";
export { useDraft } from "./hooks/useDraft";
export { useKeyboardNav } from "./hooks/useKeyboardNav";
export { useConditionalFormat } from "./hooks/useConditionalFormat";

// ── Persistence utilities
export { clearPersistedState } from "./hooks/useGridPersistence";

// ── Validation
export {
  buildZodSchema,
  validateField,
  validateRow,
} from "./validation/buildZodSchema";

// ── All TypeScript types
export type {
  // Column
  ColumnDef,
  ColumnType,
  SelectOption,

  // Row
  Row,
  RowMeta,
  RowState,
  RowComment,
  RowAttachment,

  // Filter & Conditional Formatting
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
  SortState,
  SortingMode,
  AggregationMode,
  FetchMoreParams,
} from "./types";

// ── CSS — consumers import separately:
// import 'reaktiform/styles'
