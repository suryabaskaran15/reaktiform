// ── reaktiform/cells
// ─────────────────────────────────────────────────────────────
// Standalone cell components — use in your own UI without the
// full Reaktiform grid. Ideal for headless mode consumers who
// want consistent input components that match the grid's cells.
//
// Usage:
//   import { TextCellEdit, NumberCellEdit, SelectCellEdit } from 'reaktiform/cells'
//   import 'reaktiform/cells/styles'   // optional — scoped cell CSS only
//
// All edit components are controlled — pass value + onChange.
// All read components are pure display — pass value only.
// ─────────────────────────────────────────────────────────────

// ── Text
export { TextCellRead, TextCellEdit } from "./components/cells/TextCell";

// ── Number
export { NumberCellRead, NumberCellEdit } from "./components/cells/NumberCell";

// ── Select (single)
export {
  SelectCellRead,
  SelectCellEdit,
  SelectOverlay,
  cachedLoadOptions,
  invalidateLoadOptionsCache,
} from "./components/cells/SelectCell";

// ── MultiSelect
export {
  MultiSelectCellRead,
  MultiSelectCellEdit,
} from "./components/cells/MultiSelectCell";

// ── Date
export { DateCellRead, DateCellEdit } from "./components/cells/DateCell";

// ── Checkbox / boolean
export { CheckboxCell } from "./components/cells/CheckboxCell";

// ── Computed / read-only formula cell
export { ComputedCell } from "./components/cells/ComputedCell";

// ── Generic cell renderer — dispatches to the right cell by type
// Useful for custom panel / form implementations
export { CellRenderer } from "./components/cells/CellRenderer";

// ── Field wrapper — label + error message shell (used in detail panel)
export { FieldWrapper } from "./components/cells/FieldWrapper";

// ── All types needed to use cells standalone
export type {
  ColumnDef,
  ColumnType,
  SelectOption,
  Row,
  RowMeta,
} from "./types";
