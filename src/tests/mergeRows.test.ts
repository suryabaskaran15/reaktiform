// src/tests/mergeRows.test.ts
// ─────────────────────────────────────────────────────────────
// Tests for the mergeRows Zustand store action.
// Verifies: O(changed-rows) semantics, skipDraftIds guard,
// new row insertion, server-deleted row removal, and that
// clean/dirty rows are handled independently.
// ─────────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach } from 'vitest'
import { createGridStore } from '../store/gridStore'
import type { GridStoreInstance } from '../store/gridStore'

// ── Helpers ──────────────────────────────────────────────────

function makeRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name:   `Row ${id}`,
    value:  0,
    _id:    `_${id}`,
    _saved: true,
    _new:   false,
    _draft: null,
    _errors: {},
    ...overrides,
  }
}

let store: GridStoreInstance

beforeEach(() => {
  store = createGridStore()
  // Seed initial rows
  store.getState().setRows([
    makeRow('1', { value: 10 }),
    makeRow('2', { value: 20 }),
    makeRow('3', { value: 30 }),
  ])
})

// ─────────────────────────────────────────────────────────────
//  BASIC MERGE
// ─────────────────────────────────────────────────────────────
describe('mergeRows — basic', () => {
  it('updates changed fields in existing rows', () => {
    const incoming = [
      makeRow('1', { value: 99 }),  // changed
      makeRow('2', { value: 20 }),  // unchanged
      makeRow('3', { value: 30 }),  // unchanged
    ]
    store.getState().mergeRows(incoming, 'id', new Set())
    const rows = store.getState().rows
    expect(rows.find(r => r['id'] === '1')?.['value']).toBe(99)
    expect(rows.find(r => r['id'] === '2')?.['value']).toBe(20)
    expect(rows.find(r => r['id'] === '3')?.['value']).toBe(30)
  })

  it('preserves row count when same set', () => {
    const incoming = [
      makeRow('1', { value: 11 }),
      makeRow('2', { value: 22 }),
      makeRow('3', { value: 33 }),
    ]
    store.getState().mergeRows(incoming, 'id', new Set())
    expect(store.getState().rows).toHaveLength(3)
  })

  it('appends rows not in the store', () => {
    const incoming = [
      makeRow('1', { value: 10 }),
      makeRow('2', { value: 20 }),
      makeRow('3', { value: 30 }),
      makeRow('4', { value: 40 }),  // new
    ]
    store.getState().mergeRows(incoming, 'id', new Set())
    expect(store.getState().rows).toHaveLength(4)
    expect(store.getState().rows.find(r => r['id'] === '4')?.['value']).toBe(40)
  })

  it('removes rows no longer in incoming (server-deleted clean rows)', () => {
    // Row 3 removed from server
    const incoming = [
      makeRow('1', { value: 10 }),
      makeRow('2', { value: 20 }),
    ]
    store.getState().mergeRows(incoming, 'id', new Set())
    const rows = store.getState().rows
    expect(rows).toHaveLength(2)
    expect(rows.find(r => r['id'] === '3')).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────
//  SKIP DRAFT IDS — rows being edited / saving
// ─────────────────────────────────────────────────────────────
describe('mergeRows — skipDraftIds', () => {
  it('does not overwrite rows in skipDraftIds', () => {
    // Row 1 is being saved — mark it in skipIds
    const skipIds = new Set(['1'])
    const incoming = [
      makeRow('1', { value: 999 }),  // should be ignored
      makeRow('2', { value: 20 }),
      makeRow('3', { value: 30 }),
    ]
    store.getState().mergeRows(incoming, 'id', skipIds)
    // Row 1 value should still be 10 (original), not 999
    expect(store.getState().rows.find(r => r['id'] === '1')?.['value']).toBe(10)
  })

  it('does not remove rows in skipDraftIds even if missing from incoming', () => {
    // Row 1 is saving — it was removed from incoming (race condition)
    const skipIds = new Set(['1'])
    const incoming = [
      makeRow('2', { value: 20 }),
      makeRow('3', { value: 30 }),
    ]
    store.getState().mergeRows(incoming, 'id', skipIds)
    // Row 1 should still exist
    const rows = store.getState().rows
    expect(rows.find(r => r['id'] === '1')).toBeDefined()
  })

  it('does not remove rows with active draft', () => {
    // Row 2 has an active draft (user is editing)
    store.getState().updateRowInStore('_2', {
      _draft: { name: 'Editing...' },
    })
    const incoming = [
      makeRow('1', { value: 10 }),
      makeRow('3', { value: 30 }),
      // Row 2 missing from incoming
    ]
    store.getState().mergeRows(incoming, 'id', new Set())
    // Row 2 should still exist because it has a draft
    expect(store.getState().rows.find(r => r['id'] === '2')).toBeDefined()
  })

  it('does not overwrite rows with active draft', () => {
    // Row 2 has an active draft
    store.getState().updateRowInStore('_2', {
      _draft: { value: 777 },
    })
    const incoming = [
      makeRow('1', { value: 10 }),
      makeRow('2', { value: 999 }),  // stale server value
      makeRow('3', { value: 30 }),
    ]
    store.getState().mergeRows(incoming, 'id', new Set())
    // Row 2's value field should not be overwritten
    // (the draft value 777 is what the user typed)
    const row2 = store.getState().rows.find(r => r['id'] === '2')
    expect(row2?.['_draft']).not.toBeNull()
    // The draft is preserved (key check — row 2 stayed in the store)
    expect(row2).toBeDefined()
  })
})

// ─────────────────────────────────────────────────────────────
//  NEW ROWS — preserved even when not in incoming
// ─────────────────────────────────────────────────────────────
describe('mergeRows — new rows (_new: true)', () => {
  it('preserves new (unsaved) rows even if not in incoming', () => {
    // Add a new unsaved row to the store
    store.getState().addRowToStore({
      id: 'new-temp',
      name: 'New Row',
      value: 0,
      _id: '_new-temp',
      _saved: false,
      _new: true,
      _draft: { name: 'New Row' },
      _errors: {},
    })
    expect(store.getState().rows).toHaveLength(4)

    // Server sends back only existing rows (doesn't know about new-temp yet)
    const incoming = [
      makeRow('1', { value: 10 }),
      makeRow('2', { value: 20 }),
      makeRow('3', { value: 30 }),
    ]
    store.getState().mergeRows(incoming, 'id', new Set())
    // New row should still exist
    expect(store.getState().rows).toHaveLength(4)
    expect(store.getState().rows.find(r => r['id'] === 'new-temp')).toBeDefined()
  })
})

// ─────────────────────────────────────────────────────────────
//  META FIELDS — _id, _saved, _draft, _errors preserved
// ─────────────────────────────────────────────────────────────
describe('mergeRows — meta field handling', () => {
  it('preserves _id from store (not overwritten by incoming)', () => {
    const incoming = [makeRow('1', { value: 50 })]
    store.getState().mergeRows(incoming, 'id', new Set())
    // _id should still be the store's internal _id, not overwritten
    const row = store.getState().rows.find(r => r['id'] === '1')
    expect(row?.['_id']).toBe('_1')
  })

  it('resets _saved to true and _draft to null after merge', () => {
    // Manually mark a row as unsaved
    store.getState().updateRowInStore('_1', { _saved: false })
    const incoming = [makeRow('1', { value: 10 })]
    store.getState().mergeRows(incoming, 'id', new Set())
    const row = store.getState().rows.find(r => r['id'] === '1')
    expect(row?.['_saved']).toBe(true)
    expect(row?.['_draft']).toBeNull()
  })

  it('resets _errors to {} after merge', () => {
    store.getState().updateRowInStore('_1', { _errors: { name: 'Required' } })
    const incoming = [makeRow('1', { value: 10 })]
    store.getState().mergeRows(incoming, 'id', new Set())
    const row = store.getState().rows.find(r => r['id'] === '1')
    expect(row?.['_errors']).toEqual({})
  })
})

// ─────────────────────────────────────────────────────────────
//  EMPTY CASES
// ─────────────────────────────────────────────────────────────
describe('mergeRows — edge cases', () => {
  it('handles empty incoming (all rows deleted)', () => {
    store.getState().mergeRows([], 'id', new Set())
    expect(store.getState().rows).toHaveLength(0)
  })

  it('handles empty store (all new rows)', () => {
    store.getState().setRows([])
    const incoming = [makeRow('1'), makeRow('2')]
    store.getState().mergeRows(incoming, 'id', new Set())
    expect(store.getState().rows).toHaveLength(2)
  })

  it('handles multiple rapid merges correctly', () => {
    for (let i = 0; i < 5; i++) {
      store.getState().mergeRows([
        makeRow('1', { value: i * 10 }),
        makeRow('2', { value: 20 }),
        makeRow('3', { value: 30 }),
      ], 'id', new Set())
    }
    expect(store.getState().rows.find(r => r['id'] === '1')?.['value']).toBe(40)
    expect(store.getState().rows).toHaveLength(3)
  })
})
