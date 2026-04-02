// ── Select option shape
export type SelectOption = {
  label: string;
  value: string;
  color?: "default" | "success" | "warning" | "error" | "info" | "purple";
  disabled?: boolean;
};

// ── All supported cell types
export type ColumnType =
  | "text"
  | "number"
  | "select"
  | "multiselect"
  | "date"
  | "checkbox";

// ── Column definition — generic over your data shape
export type ColumnDef<TData = Record<string, unknown>> = {
  // Required
  key: keyof TData & string;
  label: string;
  type: ColumnType;

  // Display
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  hidden?: boolean;
  pinned?: boolean;
  groupable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  resizable?: boolean;

  // ── Validation ─────────────────────────────────────────────
  /**
   * Built-in validation rules (applied automatically via Zod):
   */
  required?: boolean;

  /**
   * Custom validation function — runs after built-in rules.
   * Return a string to show as an error message.
   * Return undefined (or nothing) if the value is valid.
   *
   * @param value  - The current value of this field
   * @param values - The full row data (all fields, draft values merged)
   *                 Use this for cross-field validation
   *
   * @example
   * // Simple field validation
   * validate: (v) => {
   *   if (String(v).startsWith('RSK-0')) return 'RSK-0xx format is reserved'
   * }
   *
   * @example
   * // Cross-field validation (completion must be 100 if status is closed)
   * validate: (v, row) => {
   *   if (row.status === 'closed' && Number(v) < 100) {
   *     return 'Completion must be 100% when status is Closed'
   *   }
   * }
   */
  validate?: (
    value: unknown,
    rowValues: Record<string, unknown>,
  ) => string | undefined;

  // Number specific
  min?: number;
  max?: number;
  suffix?: string; // e.g. '%', 'days'
  prefix?: string; // e.g. '$', '£'
  decimals?: number; // decimal places to show

  // Select / Multiselect specific
  options?: SelectOption[];
  searchable?: boolean; // show search inside dropdown

  /**
   * Async option loader for select/multiselect columns.
   * Called when the user types in the select input.
   * Return an array of { label, value } options.
   *
   * Makes the select an AsyncSelect — static options prop is used
   * as the initial/default options before the user types.
   *
   * @example
   * loadOptions: async (inputValue) => {
   *   const res = await api.get('/users/search?q=' + inputValue)
   *   return res.data.map(u => ({ label: u.name, value: u.id }))
   * }
   */
  loadOptions?: (inputValue: string) => Promise<SelectOption[]>;

  /**
   * Allow the user to create new options that don't exist yet.
   * Called when the user types something and presses Enter or clicks "Create".
   * Return a new SelectOption — the created option is immediately selected.
   *
   * @example
   * onCreateOption: async (inputValue) => {
   *   const res = await api.post('/tags', { name: inputValue })
   *   return { label: res.data.name, value: res.data.id }
   * }
   */
  onCreateOption?: (inputValue: string) => Promise<SelectOption> | SelectOption;

  /**
   * Value transformer — maps between your raw row data shape and the
   * flat string value reaktiform uses internally for selects.
   *
   * Use this when your backend returns nested objects instead of flat IDs.
   *
   * @example
   * // Backend returns: { owner: { id: 'alice_kwan', name: 'Alice Kwan' } }
   * // Backend expects: { owner: { id: 'alice_kwan' } }
   * valueTransform: {
   *   read:  (raw) => (raw as any)?.id ?? raw,     // extract id from object
   *   write: (val) => ({ id: val }),                // wrap id back in object
   * }
   *
   * @example
   * // Backend returns array of objects: tags: [{ id: 'phase_1', name: 'Phase 1' }]
   * valueTransform: {
   *   read:  (raw) => (raw as any[]).map(t => t.id),
   *   write: (val) => (val as string[]).map(id => ({ id })),
   * }
   */
  valueTransform?: {
    /** Convert raw backend value → flat string/string[] for internal use */
    read: (rawValue: unknown) => string | string[];
    /** Convert flat string/string[] → shape backend expects on save */
    write: (value: string | string[]) => unknown;
  };

  // Text specific
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  patternMessage?: string;
  multiline?: boolean; // textarea instead of input
  rows?: number; // textarea rows

  // Date specific
  minDate?: string; // ISO string
  maxDate?: string; // ISO string
  dateFormat?: string; // display format e.g. 'dd/MM/yyyy'

  // Aggregation (number columns only)
  aggregation?: "sum" | "avg" | "min" | "max" | "count" | "none";

  // ── Computed / formula column ──────────────────────────
  /**
   * Mark this column as computed (read-only, auto-calculated).
   * Computed columns cannot be edited inline or via the detail panel.
   */
  computed?: boolean;

  /**
   * User-defined formula. Receives the full row data (draft values
   * take priority over committed values) and returns the computed value.
   *
   * @example
   * formula: (row) => row.probability * severityWeight[row.severity]
   */
  formula?: (row: TData) => unknown;

  /**
   * Declare which fields this formula reads.
   * reaktiform only recalculates when one of these fields changes.
   * If omitted — recalculates on every row render (less optimal).
   *
   * @example
   * dependsOn: ['probability', 'severity']
   */
  dependsOn?: (keyof TData & string)[];

  /**
   * Whether the computed result should be included when saving
   * the row to the server. Default: false (never saved).
   *
   * @example
   * saveable: true  // computed value will be sent in onSave payload
   */
  saveable?: boolean;

  // Custom render override (headless mode)
  renderCell?: (value: unknown, row: TData) => React.ReactNode;
  renderEditCell?: (
    value: unknown,
    row: TData,
    onChange: (v: unknown) => void,
    onBlur: () => void,
  ) => React.ReactNode;

  // Header
  headerTooltip?: string;
};
