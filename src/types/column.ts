// ── reaktiform — ColumnDef type
// ─────────────────────────────────────────────────────────────
// Single source of truth for column configuration.
// Every prop is documented and tree-shakeable via TypeScript.
// ─────────────────────────────────────────────────────────────

// ── Select option shape
export type SelectOption = {
  label: string;
  value: string;
  /**
   * Badge color for this option.
   * Built-in semantic: 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple'
   * Custom: any CSS color string — '#FF5733', 'rgb(255,87,51)', 'hsl(11,100%,60%)'
   */
  /**
   * Controls the badge color in select dropdowns and grid cells.
   *
   * Three formats supported:
   *
   * 1. Named semantic token (built-in palette):
   *    'default' | 'success' | 'warning' | 'error' | 'info' | 'purple'
   *
   * 2. Any CSS color string — background auto-derived, text auto-contrasted:
   *    '#E53E3E'  |  'rgb(229,62,62)'  |  'hsl(0,72%,51%)'  |  'tomato'
   *
   * 3. Full custom object — total control over every part of the badge:
   *    { bg: '#FEE2E2', text: '#991B1B', dot: '#DC2626', border: '#FECACA' }
   *    All fields optional — omitted fields fall back to auto-derived values.
   *
   * @example
   * color: 'success'                           // named token
   * color: '#E53E3E'                           // auto-derive from hex
   * color: { bg: '#FEE2E2', text: '#991B1B' }  // full custom
   */
  color?:
    | "default"
    | "success"
    | "warning"
    | "error"
    | "info"
    | "purple"
    | { bg?: string; text?: string; dot?: string; border?: string }
    | (string & {}); // any CSS color string — auto-derives bg/text/dot/border
  disabled?: boolean;
  /** Optional icon name (lucide-react) shown before label */
  icon?: string;
};

// ── All supported cell types
export type ColumnType =
  | "text" // plain text — TextCellRead / TextCellEdit
  | "number" // numeric — NumberCellRead / NumberCellEdit
  | "select" // single-select dropdown — SelectCellRead / SelectCellEdit
  | "multiselect" // multi-select — MultiSelectCellRead / MultiSelectCellEdit
  | "date" // ISO date — DateCellRead / DateCellEdit (native picker)
  | "time" // time string "HH:MM" — TimeCellRead / TimeCellEdit (native picker)
  | "checkbox" // boolean — CheckboxCell
  | "email" // text + mailto link in read mode + email validation
  | "url" // text + hyperlink in read mode + URL validation
  | "currency" // number formatted as currency (prefix = currency symbol)
  | "percentage" // number displayed as N% with optional bar
  | "rating" // 1–5 star rating
  | "badge" // read-only enum badge (like select but not editable)
  | "progress"; // 0–100 progress bar (read-only visual)

// ── Aggregation modes for number columns
export type AggregationMode = "none" | "sum" | "avg" | "min" | "max" | "count";

// ── Column definition — generic over your data shape
// TData is the row type — 'key' will be constrained to keyof TData
export type ColumnDef<TData = Record<string, unknown>> = {
  // ── Identity (required) ──────────────────────────────────────
  /** Field key in your data object. TypeScript infers from your row type. */
  key: keyof TData & string;
  /** Column header label shown in the grid. */
  label: string;
  /** Cell type — controls how the value is rendered and edited. */
  type: ColumnType;

  // ── Layout ──────────────────────────────────────────────────
  /** Initial column width in pixels. Default: 150 */
  width?: number;
  /** Minimum column width when resizing. Default: 60 */
  minWidth?: number;
  /** Maximum column width when resizing. Default: 600 */
  maxWidth?: number;
  /** Start hidden. Consumer can show via column visibility panel. */
  hidden?: boolean;
  /** Pin column to the left. Stays visible when scrolling horizontally. */
  pinned?: boolean;
  /** Text alignment inside the cell. Default: 'left' for text, 'right' for numbers. */
  align?: "left" | "center" | "right";

  // ── Header ──────────────────────────────────────────────────
  /** Tooltip shown when hovering the column header. */
  headerTooltip?: string;
  /** Description shown in the column visibility panel. */
  description?: string;

  // ── Behaviour ───────────────────────────────────────────────
  /** Allow sorting by this column. Default: true */
  sortable?: boolean;
  /** Show filter controls for this column. Default: true */
  filterable?: boolean;
  /** Allow grouping rows by this column. Default: false */
  groupable?: boolean;
  /** Allow resizing this column by dragging the header edge. Default: true */
  resizable?: boolean;
  /** Allow clicking the cell value to copy it to clipboard. Default: false */
  copyable?: boolean;

  // ── Cell appearance ─────────────────────────────────────────
  /**
   * Dynamic CSS class applied to each cell in this column.
   * @example cellClassName={(value, row) => row.status === 'overdue' ? 'rf-cell-danger' : ''}
   */
  cellClassName?: (value: unknown, row: TData) => string | undefined;
  /**
   * Dynamic inline styles applied to each cell.
   * @example cellStyle={(value) => ({ color: Number(value) < 0 ? 'red' : 'inherit' })}
   */
  cellStyle?: (value: unknown, row: TData) => React.CSSProperties | undefined;

  // ── Display formatter ────────────────────────────────────────
  /**
   * Custom display formatter — transforms the raw value to a display string.
   * Only affects read mode. Edit mode always uses the raw value.
   * @example format={(v) => `${Number(v).toFixed(2)} days`}
   */
  format?: (value: unknown, row: TData) => string;

  /**
   * Make this column read-only — cell shows as non-editable even if the row
   * is otherwise editable. Accepts a boolean or a function for row-based logic.
   *
   * @example
   * readOnly: true                                    // always read-only
   * readOnly: false                                   // always editable (default)
   * readOnly: (row) => row.status === 'CLOSED'        // locked once closed
   * readOnly: (row) => row.lostTimeInjury !== 'YES'   // conditional
   */
  readOnly?: boolean | ((row: TData) => boolean);

  // ── Validation ──────────────────────────────────────────────
  /** Mark field as required — blocks save if empty. */
  required?: boolean;
  /**
   * Custom validation function.
   * Return a string to show as an error. Return undefined if valid.
   * @param value      - Current value of this field
   * @param rowValues  - Full row data (draft values merged) — for cross-field rules
   * @example
   * validate: (v, row) => {
   *   if (row.status === 'closed' && Number(v) < 100)
   *     return 'Completion must be 100% when closed'
   * }
   */
  validate?: (
    value: unknown,
    rowValues: Record<string, unknown>,
  ) => string | undefined;

  // ── Number specific ──────────────────────────────────────────
  /**
   * Minimum allowed value (number, currency, percentage, rating).
   * Static number or a function receiving the current row for cross-field constraints.
   * @example
   * min: 0                              // static — always >= 0
   * min: (row) => row.allocatedBudget   // dynamic — depends on another field
   */
  min?: number | ((row: TData) => number | undefined);
  /**
   * Maximum allowed value.
   * Static number or a function receiving the current row for cross-field constraints.
   * @example
   * max: 100                            // static
   * max: (row) => row.budgetCeiling     // dynamic — must not exceed ceiling
   */
  max?: number | ((row: TData) => number | undefined);
  /** Display prefix — shown before the value. e.g. 'RM', '$', '£' */
  prefix?: string;
  /** Display suffix — shown after the value. e.g. '%', ' days', ' kg' */
  suffix?: string;
  /** Number of decimal places to display and validate. */
  decimals?: number;
  /** Aggregation function shown in the footer/toolbar. */
  aggregation?: AggregationMode;

  // ── Currency specific ────────────────────────────────────────
  /**
   * ISO 4217 currency code. Used when type='currency'.
   * Enables Intl.NumberFormat currency formatting.
   * @example currency='MYR'   → 'RM 1,234.56'
   * @example currency='USD'   → '$1,234.56'
   */
  currency?: string;
  /**
   * BCP 47 locale tag for number/currency/date formatting.
   * @default 'en-US'
   * @example locale='de-DE'  → '1.234,56 €'
   */
  locale?: string;

  // ── Select / Multiselect ─────────────────────────────────────
  /** Dropdown options for select/multiselect/badge columns. */
  options?: SelectOption[];
  /** Show search box inside the dropdown. Default: true for >5 options or async */
  searchable?: boolean;
  /**
   * Allow the user to clear (remove) the current selection by clicking ✕.
   * When cleared, the field value is set to null/empty.
   * Default: false — no clear button shown.
   * @example
   * clearable: true   // shows ✕ button on all select variants
   */
  clearable?: boolean;
  /**
   * Async option loader — called when the user types in the select input.
   * Use for server-side search of large option lists.
   * @example
   * loadOptions: async (input) => {
   *   const res = await fetch(`/api/users?q=${input}`)
   *   return res.json()
   * }
   */
  loadOptions?: (input: string) => Promise<SelectOption[]>;
  /** Allow creating new options not in the list (creatable select). */
  creatable?: boolean;
  /**
   * Called when user creates a new option in a creatable select.
   * Return the new SelectOption to add it to the list.
   * @example
   * onCreateOption={async (input) => {
   *   const created = await api.post('/options', { label: input, value: slugify(input) })
   *   return created
   * }}
   */
  onCreateOption?: (input: string) => Promise<SelectOption> | SelectOption;
  /** Allow selecting options not in the list without creating them. */
  isAllowOutOfOptions?: boolean;

  // ── Text specific ────────────────────────────────────────────
  /** Minimum character length validation. */
  minLength?: number;
  /** Maximum character length validation. */
  maxLength?: number;
  /** Regex pattern validation. */
  pattern?: RegExp;
  /** Error message shown when pattern fails. */
  patternMessage?: string;
  /** Use textarea instead of single-line input. */
  multiline?: boolean;
  /** Number of rows for textarea. Default: 3 */
  rows?: number;
  /** Show character count indicator. */
  showCharCount?: boolean;

  // ── Date specific ────────────────────────────────────────────
  /**
   * Minimum selectable date (ISO date string).
   * Static string or a function receiving the current row for cross-field date constraints.
   * @example
   * minDate: '2024-01-01'                  // static floor
   * minDate: (row) => row.requestDate      // dynamic — approved must be after request
   * minDate: (row) => row.contractStart ?? '2024-01-01'  // dynamic with fallback
   */
  minDate?: string | ((row: TData) => string | undefined);
  /**
   * Maximum selectable date (ISO date string).
   * Static string or a function receiving the current row for cross-field date constraints.
   * @example
   * maxDate: '2030-12-31'                  // static ceiling
   * maxDate: (row) => row.projectEnd       // dynamic — can't exceed project end
   */
  maxDate?: string | ((row: TData) => string | undefined);
  /** Display format string. Default: 'DD MMM YYYY' */
  dateFormat?: string;

  // ── Rating specific ──────────────────────────────────────────
  /** Maximum stars for rating column. Default: 5 */
  ratingMax?: number;

  // ── Email / URL specific ─────────────────────────────────────
  /** Open email/URL links in new tab. Default: true */
  openInNewTab?: boolean;

  // ── Value transform (advanced) ───────────────────────────────
  /**
   * Transform values between internal flat representation and
   * the nested shape your API expects.
   *
   * @example
   * // API expects { owner: { id: 'alice' } } but grid stores flat 'alice'
   * valueTransform: {
   *   read:  (raw) => (raw as { id: string }).id,
   *   write: (flat) => ({ id: flat as string }),
   * }
   */
  valueTransform?: {
    read: (rawValue: unknown) => string | string[];
    write: (value: string | string[]) => unknown;
  };

  // ── Computed / formula column ────────────────────────────────
  /**
   * Mark this column as computed — value is derived by a formula.
   * Computed columns are read-only by default.
   * Set editableWhenComputed=true to allow manual override.
   */
  computed?: boolean;
  /**
   * Allow the user to manually override the formula result.
   * The formula still auto-recalculates on dependency changes,
   * but the user can type a custom value that takes precedence.
   */
  editableWhenComputed?: boolean;
  /**
   * Formula function — receives the full row (draft values merged)
   * and returns the computed value.
   * @example formula: (row) => row.price * row.quantity
   */
  formula?: (row: TData) => unknown;
  /**
   * Declare which fields this formula reads.
   * Enables fine-grained cache invalidation — formula only re-runs
   * when a listed field changes.
   * @example dependsOn: ['price', 'quantity']
   */
  dependsOn?: (keyof TData & string)[];
  /**
   * Include the computed value in the save payload sent to the API.
   * Default: false
   */
  saveable?: boolean;

  // ── Custom renderers ─────────────────────────────────────────
  /**
   * Fully custom read-mode cell renderer.
   * Bypasses reaktiform's default cell — you control the output entirely.
   * @example renderCell: (value, row) => <Avatar src={row.avatarUrl} />
   */
  renderCell?: (value: unknown, row: TData) => React.ReactNode;
  /**
   * Fully custom edit-mode cell renderer.
   * @example
   * renderEditCell: (value, row, onChange, onBlur) => (
   *   <MyCustomPicker value={value} onChange={onChange} onBlur={onBlur} />
   * )
   */
  renderEditCell?: (
    value: unknown,
    row: TData,
    onChange: (v: unknown) => void,
    onBlur: () => void,
  ) => React.ReactNode;
};

// Re-export React for the type above without requiring consumers to import it
import type React from "react";
