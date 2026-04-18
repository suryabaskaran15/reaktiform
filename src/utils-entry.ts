// ── reaktiform/utils
// ─────────────────────────────────────────────────────────────
// Utility functions — formatting, validation, helpers.
// Zero React dependency — usable in any context.
//
// Usage:
//   import { formatDate, formatNumber, formatCurrency, validateRow } from 'reaktiform/utils'
// ─────────────────────────────────────────────────────────────

// ── Formatters
export {
  formatDate,
  getDaysFromToday,
  formatNumber,
  formatCurrency,
  formatPercentage,
  formatDuration,
  truncate,
} from './utils/formatters'

// ── Value helpers
export {
  generateId,
  deepClone,
  isEqual,
  getDraftValue,
  getOptionLabel,
} from './utils'

// ── Validation utilities
export {
  buildZodSchema,
  validateField,
  validateRow,
} from './validation/buildZodSchema'

// ── Persistence utilities
export { clearPersistedState } from './hooks/useGridPersistence'
