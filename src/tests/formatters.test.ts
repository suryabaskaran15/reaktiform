// src/tests/formatters.test.ts
// ─────────────────────────────────────────────────────────────
// Tests for all formatter utilities
// ─────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import {
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
} from '../utils/formatters'

// ─────────────────────────────────────────────────────────────
//  formatDate
// ─────────────────────────────────────────────────────────────
describe('formatDate', () => {
  it('formats ISO date to DD MMM YYYY', () => {
    expect(formatDate('2025-01-15')).toBe('15 Jan 2025')
  })

  it('returns empty string for null/undefined', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDate(undefined)).toBe('')
  })

  it('returns original value for invalid date', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date')
  })
})

// ─────────────────────────────────────────────────────────────
//  formatDateLocale
// ─────────────────────────────────────────────────────────────
describe('formatDateLocale', () => {
  it('formats with custom locale and options', () => {
    const result = formatDateLocale('2025-01-15', 'en-US', { month: 'long', year: 'numeric', day: 'numeric' })
    expect(result).toContain('January')
    expect(result).toContain('2025')
  })

  it('returns empty for null', () => {
    expect(formatDateLocale(null)).toBe('')
  })
})

// ─────────────────────────────────────────────────────────────
//  getDaysFromToday
// ─────────────────────────────────────────────────────────────
describe('getDaysFromToday', () => {
  it('returns 0 for today', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(getDaysFromToday(today)).toBe(0)
  })

  it('returns positive for future dates', () => {
    const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    expect(getDaysFromToday(future)).toBe(7)
  })

  it('returns negative for past dates', () => {
    const past = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)
    expect(getDaysFromToday(past)).toBe(-3)
  })
})

// ─────────────────────────────────────────────────────────────
//  formatNumber
// ─────────────────────────────────────────────────────────────
describe('formatNumber', () => {
  it('formats with default options', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
  })

  it('formats with decimals', () => {
    expect(formatNumber(1234.567, { decimals: 2 })).toBe('1,234.57')
  })

  it('formats with prefix and suffix', () => {
    expect(formatNumber(42, { prefix: '$', suffix: ' USD' })).toBe('$42 USD')
  })

  it('formats compact notation', () => {
    expect(formatNumber(1500000, { compact: true })).toBe('1.5M')
    expect(formatNumber(1200, { compact: true })).toBe('1.2K')
  })

  it('returns empty string for null/undefined', () => {
    expect(formatNumber(null)).toBe('')
    expect(formatNumber(undefined)).toBe('')
  })

  it('returns empty for non-finite', () => {
    expect(formatNumber(Infinity)).toBe('')
  })
})

// ─────────────────────────────────────────────────────────────
//  formatCurrency
// ─────────────────────────────────────────────────────────────
describe('formatCurrency', () => {
  it('formats USD by default', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56')
  })

  it('formats MYR correctly', () => {
    const result = formatCurrency(1234.56, 'MYR', 'en-MY')
    expect(result).toContain('1,234.56')
  })

  it('rounds to 2 decimal places', () => {
    expect(formatCurrency(1.005)).toBe('$1.01')
  })

  it('returns empty for null', () => {
    expect(formatCurrency(null)).toBe('')
  })

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('handles negative', () => {
    expect(formatCurrency(-500)).toBe('-$500.00')
  })
})

// ─────────────────────────────────────────────────────────────
//  formatPercentage
// ─────────────────────────────────────────────────────────────
describe('formatPercentage', () => {
  it('converts decimal to percentage', () => {
    expect(formatPercentage(0.755)).toBe('75.5%')
  })

  it('uses already-percent value when flag set', () => {
    expect(formatPercentage(75.5, true)).toBe('75.5%')
  })

  it('respects decimal places', () => {
    expect(formatPercentage(0.1234, false, 2)).toBe('12.34%')
  })

  it('returns empty for null', () => {
    expect(formatPercentage(null)).toBe('')
  })
})

// ─────────────────────────────────────────────────────────────
//  formatDuration
// ─────────────────────────────────────────────────────────────
describe('formatDuration', () => {
  it('formats seconds to MM:SS', () => {
    expect(formatDuration(90)).toBe('1:30')
    expect(formatDuration(65)).toBe('1:05')
  })

  it('formats seconds to HH:MM:SS when >= 1 hour', () => {
    expect(formatDuration(3661)).toBe('1:01:01')
    expect(formatDuration(7200)).toBe('2:00:00')
  })

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0:00')
  })

  it('handles sub-minute', () => {
    expect(formatDuration(45)).toBe('0:45')
  })
})

// ─────────────────────────────────────────────────────────────
//  formatFileSize
// ─────────────────────────────────────────────────────────────
describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(512)).toBe('512.0 B')
  })

  it('formats KB', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB')
  })

  it('formats MB', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB')
  })

  it('formats GB', () => {
    expect(formatFileSize(1073741824)).toBe('1.0 GB')
  })

  it('handles 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B')
  })
})

// ─────────────────────────────────────────────────────────────
//  truncate
// ─────────────────────────────────────────────────────────────
describe('truncate', () => {
  it('returns string as-is when within limit', () => {
    expect(truncate('Hello', 10)).toBe('Hello')
  })

  it('truncates and adds ellipsis', () => {
    expect(truncate('Hello World', 5)).toBe('Hello…')
  })

  it('returns empty for null/undefined', () => {
    expect(truncate(null, 10)).toBe('')
    expect(truncate(undefined, 10)).toBe('')
  })

  it('handles exact length', () => {
    expect(truncate('Hello', 5)).toBe('Hello')
  })
})

// ─────────────────────────────────────────────────────────────
//  highlight
// ─────────────────────────────────────────────────────────────
describe('highlight', () => {
  it('returns single non-matching segment for no match', () => {
    const result = highlight('Hello World', 'xyz')
    expect(result).toEqual([{ text: 'Hello World', match: false }])
  })

  it('splits on match with correct flags', () => {
    const result = highlight('Hello World', 'world')
    const matched = result.filter(r => r.match)
    const unmatched = result.filter(r => !r.match)
    expect(matched.length).toBe(1)
    expect(matched[0]!.text.toLowerCase()).toBe('world')
    expect(unmatched.some(r => r.text === 'Hello ')).toBe(true)
  })

  it('is case-insensitive', () => {
    const result = highlight('HELLO', 'hello')
    expect(result.find(r => r.match)?.text).toBe('HELLO')
  })

  it('returns full string as non-match when term is empty', () => {
    const result = highlight('Hello', '')
    expect(result).toEqual([{ text: 'Hello', match: false }])
  })

  it('handles multiple matches', () => {
    const result = highlight('abcabc', 'abc')
    expect(result.filter(r => r.match)).toHaveLength(2)
  })
})
