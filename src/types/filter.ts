// ── Filter value shape per column type

export type TextFilterValue = {
  type: 'text'
  text: string
}

export type NumberFilterValue = {
  type: 'number'
  min?: number
  max?: number
}

export type DateFilterValue = {
  type: 'date'
  from?: string   // ISO date string
  to?: string     // ISO date string
}

export type SelectFilterValue = {
  type: 'select'
  values: string[]  // array of option.value
}

export type CheckboxFilterValue = {
  type: 'checkbox'
  value: boolean | null  // null = show all
}

export type FilterValue =
  | TextFilterValue
  | NumberFilterValue
  | DateFilterValue
  | SelectFilterValue
  | CheckboxFilterValue

// ── Active filters map: column key → filter value
export type ActiveFilters = Record<string, FilterValue>

// ── Conditional formatting rule
export type CFConditionOperator =
  | 'eq'       // equals
  | 'neq'      // not equals
  | 'gt'       // greater than
  | 'lt'       // less than
  | 'gte'      // greater than or equal
  | 'lte'      // less than or equal
  | 'contains' // string contains
  | 'in'       // value in comma-separated list

export type CFCondition = {
  field: string
  op: CFConditionOperator
  value: string
}

export type CFRule = {
  id: string
  label: string
  conditions: CFCondition[]
  logic: 'AND' | 'OR'
  backgroundColor: string
  textColor: string
  enabled: boolean
}

// ── CF evaluation result
export type CFResult = {
  backgroundColor: string
  textColor: string
} | null
