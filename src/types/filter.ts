// ── Filter value shape per column type

export type TextFilterValue = {
  type: "text";
  value: string;
};

export type NumberFilterValue = {
  type: "number";
  min?: number;
  max?: number;
};

export type DateFilterValue = {
  type: "date";
  from?: string; // ISO date string
  to?: string; // ISO date string
};

export type TimeFilterValue = {
  type: "time";
  from?: string; // "HH:MM"
  to?: string; // "HH:MM"
};

export type SelectFilterValue = {
  type: "select";
  values: string[]; // array of option.value
};

export type CheckboxFilterValue = {
  type: "checkbox";
  value: boolean | null; // null = show all
};

export type FilterValue =
  | TextFilterValue
  | NumberFilterValue
  | DateFilterValue
  | TimeFilterValue
  | SelectFilterValue
  | CheckboxFilterValue;

// ── Active filters map: column key → filter value
export type ActiveFilters = Record<string, FilterValue>;

// ── Conditional formatting rule
export type CFConditionOperator =
  | "eq" // equals
  | "neq" // not equals
  | "gt" // greater than
  | "lt" // less than
  | "gte" // greater than or equal
  | "lte" // less than or equal
  | "contains" // string contains
  | "in"; // value in comma-separated list

export type CFCondition = {
  field: string;
  op: CFConditionOperator;
  value: string;
};

// Named highlight palettes. Each maps to theme tokens
// (`--rf-cf-<tone>-bg` / `--rf-cf-<tone>-fg`) defined for both light and
// dark mode in reaktiform.css, so a toned rule follows the active theme.
export type CFTone =
  | "red"
  | "orange"
  | "amber"
  | "yellow"
  | "green"
  | "teal"
  | "blue"
  | "purple"
  | "pink";

export type CFRule = {
  id: string;
  label: string;
  conditions: CFCondition[];
  logic: "AND" | "OR";
  /** Theme-aware palette. When omitted, the colours below are used
   *  (light mode as-is; a dark variant is derived automatically). */
  tone?: CFTone;
  /** Light-mode background. Also the fallback for rules without a `tone`. */
  backgroundColor: string;
  /** Light-mode text colour. Also the fallback for rules without a `tone`. */
  textColor: string;
  enabled: boolean;
};

// ── CF evaluation result
export type CFResult = {
  /** Background usable anywhere inside `[data-reaktiform]`. */
  backgroundColor: string;
  /** Text colour usable anywhere inside `[data-reaktiform]`. */
  textColor: string;
  /** Resolved palette, or null for a custom colour. */
  tone: CFTone | null;
  /** CSS custom properties to spread on the row; they define
   *  `--rf-cf-bg` / `--rf-cf-fg` for the active theme. */
  vars: Record<`--rf-${string}`, string>;
} | null;
