// ── reaktiform/utils/formatters
// ─────────────────────────────────────────────────────────────
// Pure display formatters — no React, no DOM deps.
// All functions are tree-shakeable individually.
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
//  DATE FORMATTING
// ─────────────────────────────────────────────────────────────

/**
 * Format an ISO date string for display.
 * Returns '' for null/undefined/invalid.
 *
 * @example
 * formatDate('2025-01-15')         → '15 Jan 2025'
 * formatDate('2025-01-15', 'MM/DD/YYYY') → '01/15/2025'
 */
export function formatDate(
  value: string | null | undefined,
  _format = 'DD MMM YYYY'  // kept for API compatibility — uses Intl internally
): string {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('en-GB', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  })
}

/**
 * Format a date with full locale control.
 *
 * @example
 * formatDateLocale('2025-01-15', 'en-US', { month: 'long' }) → 'January 15, 2025'
 */
export function formatDateLocale(
  value: string | null | undefined,
  locale: string = 'en-GB',
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }
): string {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString(locale, options)
}

/**
 * Get signed day difference from today.
 * Negative = past, positive = future, 0 = today.
 *
 * @example
 * getDaysFromToday('2025-01-15') → -5  (5 days ago)
 */
export function getDaysFromToday(dateStr: string): number {
  const d   = new Date(dateStr)
  const now = new Date()
  // Normalise to midnight to avoid partial-day rounding
  d.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - now.getTime()) / 86_400_000)
}

/**
 * Format a duration in seconds to HH:MM:SS or MM:SS.
 *
 * @example
 * formatDuration(3661) → '1:01:01'
 * formatDuration(90)   → '1:30'
 */
export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

// ─────────────────────────────────────────────────────────────
//  NUMBER FORMATTING
// ─────────────────────────────────────────────────────────────

/**
 * Format a number with decimal places, prefix, and suffix.
 *
 * @example
 * formatNumber(1234567.89, { decimals: 2, prefix: '$' }) → '$1,234,567.89'
 * formatNumber(0.755, { decimals: 1, suffix: '%' })      → '0.8%'
 */
export function formatNumber(
  value: number | null | undefined,
  options: {
    decimals?: number
    prefix?:   string
    suffix?:   string
    locale?:   string
    compact?:  boolean  // 1.2M instead of 1,200,000
  } = {}
): string {
  if (value == null || !isFinite(Number(value))) return ''
  const n = Number(value)
  const { decimals, prefix = '', suffix = '', locale = 'en-US', compact = false } = options

  let formatted: string
  if (compact) {
    formatted = Intl.NumberFormat(locale, {
      notation:          'compact',
      maximumFractionDigits: decimals ?? 1,
    }).format(n)
  } else {
    formatted = Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n)
  }

  return `${prefix}${formatted}${suffix}`
}

/**
 * Format a number as currency.
 *
 * @example
 * formatCurrency(1234.5, 'USD')    → '$1,234.50'
 * formatCurrency(1234.5, 'MYR')    → 'RM1,234.50'
 * formatCurrency(1234.5, 'EUR', 'de-DE') → '1.234,50 €'
 */
export function formatCurrency(
  value: number | null | undefined,
  currency: string = 'USD',
  locale:   string = 'en-US'
): string {
  if (value == null || !isFinite(Number(value))) return ''
  return Intl.NumberFormat(locale, {
    style:    'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value))
}

/**
 * Format a number as a percentage.
 *
 * @example
 * formatPercentage(0.755)      → '75.5%'
 * formatPercentage(75.5, true) → '75.5%'  (already in percent form)
 */
export function formatPercentage(
  value: number | null | undefined,
  alreadyPercent: boolean = false,
  decimals: number = 1
): string {
  if (value == null || !isFinite(Number(value))) return ''
  const pct = alreadyPercent ? Number(value) : Number(value) * 100
  return `${pct.toFixed(decimals)}%`
}

// ─────────────────────────────────────────────────────────────
//  STRING FORMATTING
// ─────────────────────────────────────────────────────────────

/**
 * Truncate a string to maxLength characters, adding ellipsis.
 *
 * @example
 * truncate('Hello World', 8) → 'Hello Wo…'
 */
export function truncate(value: string | null | undefined, maxLength: number): string {
  if (!value) return ''
  return value.length <= maxLength ? value : value.slice(0, maxLength) + '…'
}

/**
 * Highlight search term occurrences in a string.
 * Returns array of { text, match } segments for rendering.
 *
 * @example
 * highlight('Hello World', 'wor')
 * → [{ text: 'Hello ', match: false }, { text: 'Wor', match: true }, { text: 'ld', match: false }]
 */
export function highlight(
  value: string,
  term: string
): { text: string; match: boolean }[] {
  if (!term.trim()) return [{ text: value, match: false }]
  const regex  = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts  = value.split(regex)
  const lcTerm = term.toLowerCase()
  return parts.filter(Boolean).map(text => ({
    text,
    match: text.toLowerCase() === lcTerm,
  }))
}

// ─────────────────────────────────────────────────────────────
//  FILE SIZE
// ─────────────────────────────────────────────────────────────

/**
 * Format bytes to human-readable file size.
 *
 * @example
 * formatFileSize(1536) → '1.5 KB'
 * formatFileSize(1048576) → '1.0 MB'
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}
