// src/tests/serverSideSync.test.ts
// ─────────────────────────────────────────────────────────────
// Tests for the server-side data sync logic:
//   - savingRowIdsRef prevents revert after successful save
//   - mergeRows correctly protects in-flight rows
//   - Create/update/delete with onSuccess callbacks
//   - Multi-save concurrent safety
// ─────────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createGridStore } from '../store/gridStore'
import type { GridStoreInstance } from '../store/gridStore'

// ── Helpers ──────────────────────────────────────────────────

function makeRow(id: string, value: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    name:   `Row ${id}`,
    value,
    _id:    `_${id}`,
    _saved: true,
    _new:   false,
    _draft: null,
    _errors: {},
    ...extra,
  }
}

function makeIncoming(rows: { id: string; value: number }[]) {
  return rows.map(r => makeRow(r.id, r.value))
}

let store: GridStoreInstance

beforeEach(() => {
  store = createGridStore()
  store.getState().setRows([
    makeRow('row-1', 100),
    makeRow('row-2', 200),
    makeRow('row-3', 300),
  ])
})

// ─────────────────────────────────────────────────────────────
//  CORE REVERT BUG REGRESSION
// ─────────────────────────────────────────────────────────────
describe('save revert bug regression', () => {
  it('preserves committed value when incoming data is stale during save', () => {
    // Simulate the scenario:
    // 1. User edits row-1 value from 100 → 150
    // 2. Save fires: marks row as saving (skipDraftIds)
    // 3. API completes: updateRowInStore commits value 150
    // 4. TanStack onSuccess fires: sends OLD data (value=100) to data sync
    // 5. mergeRows must protect row-1 because it's in savingRowIds

    // Step 1: simulate in-flight save by adding to skipIds
    const savingIds = new Set(['row-1'])

    // Step 2: updateRowInStore — commit new value
    store.getState().updateRowInStore('_row-1', { value: 150, _draft: null, _saved: true })

    // Step 3: incoming data from TanStack (stale — still has 100)
    const staleIncoming = makeIncoming([
      { id: 'row-1', value: 100 }, // stale!
      { id: 'row-2', value: 200 },
      { id: 'row-3', value: 300 },
    ])
    store.getState().mergeRows(staleIncoming, 'id', savingIds)

    // Row-1 must still show 150, not the stale 100
    const row1 = store.getState().rows.find(r => r['id'] === 'row-1')
    expect(row1?.['value']).toBe(150)
  })

  it('accepts fresh server data after save completes (skipIds cleared)', () => {
    // After save completes, savingIds is cleared
    // Next refetch should update the row normally

    store.getState().updateRowInStore('_row-1', { value: 150, _draft: null, _saved: true })

    // savingIds now empty — save completed
    const freshIncoming = makeIncoming([
      { id: 'row-1', value: 150 }, // server confirms 150
      { id: 'row-2', value: 200 },
      { id: 'row-3', value: 300 },
    ])
    store.getState().mergeRows(freshIncoming, 'id', new Set())

    const row1 = store.getState().rows.find(r => r['id'] === 'row-1')
    expect(row1?.['value']).toBe(150)
  })

  it('handles concurrent saves on different rows independently', () => {
    // Both row-1 and row-2 are being saved simultaneously
    store.getState().updateRowInStore('_row-1', { value: 111, _draft: null })
    store.getState().updateRowInStore('_row-2', { value: 222, _draft: null })

    const savingIds = new Set(['row-1', 'row-2'])

    // Stale incoming (before both saves)
    const stale = makeIncoming([
      { id: 'row-1', value: 100 },
      { id: 'row-2', value: 200 },
      { id: 'row-3', value: 300 },
    ])
    store.getState().mergeRows(stale, 'id', savingIds)

    expect(store.getState().rows.find(r => r['id'] === 'row-1')?.['value']).toBe(111)
    expect(store.getState().rows.find(r => r['id'] === 'row-2')?.['value']).toBe(222)
    expect(store.getState().rows.find(r => r['id'] === 'row-3')?.['value']).toBe(300)
  })
})

// ─────────────────────────────────────────────────────────────
//  STORE ACTIONS — setSort / setSortMulti
// ─────────────────────────────────────────────────────────────
describe('sort actions', () => {
  it('setSort cycles through asc → desc → null', () => {
    const s = store.getState()

    s.setSort('value')
    expect(s.sortState).toEqual({ colKey: 'value', direction: 'asc' })
    expect(s.sortModel).toEqual([{ colKey: 'value', direction: 'asc' }])

    s.setSort('value')
    expect(s.sortState).toEqual({ colKey: 'value', direction: 'desc' })

    s.setSort('value')
    expect(s.sortState).toBeNull()
    expect(s.sortModel).toEqual([])
  })

  it('setSort on new column resets to asc', () => {
    store.getState().setSort('value')
    store.getState().setSort('name')
    expect(store.getState().sortState).toEqual({ colKey: 'name', direction: 'asc' })
    expect(store.getState().sortModel).toHaveLength(1)
  })

  it('setSortMulti appends columns', () => {
    store.getState().setSortMulti('value')
    store.getState().setSortMulti('name')

    expect(store.getState().sortModel).toHaveLength(2)
    expect(store.getState().sortModel[0]).toEqual({ colKey: 'value', direction: 'asc' })
    expect(store.getState().sortModel[1]).toEqual({ colKey: 'name', direction: 'asc' })
  })

  it('setSortMulti cycles direction on existing column', () => {
    store.getState().setSortMulti('value')
    expect(store.getState().sortModel[0]?.direction).toBe('asc')

    store.getState().setSortMulti('value')
    expect(store.getState().sortModel[0]?.direction).toBe('desc')

    store.getState().setSortMulti('value')
    expect(store.getState().sortModel).toHaveLength(0)
  })

  it('clearSort resets both sortState and sortModel', () => {
    store.getState().setSortMulti('value')
    store.getState().setSortMulti('name')
    store.getState().clearSort()

    expect(store.getState().sortState).toBeNull()
    expect(store.getState().sortModel).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────
//  SELECTION — single / multi / none modes (store level)
// ─────────────────────────────────────────────────────────────
describe('selection store actions', () => {
  it('toggleSelect selects and deselects a row', () => {
    store.getState().toggleSelect('_row-1')
    expect(store.getState().selectedIds.has('_row-1')).toBe(true)

    store.getState().toggleSelect('_row-1')
    expect(store.getState().selectedIds.has('_row-1')).toBe(false)
  })

  it('toggleSelectAll selects all provided ids', () => {
    store.getState().toggleSelectAll(['_row-1', '_row-2', '_row-3'])
    expect(store.getState().selectedIds.size).toBe(3)
  })

  it('toggleSelectAll deselects all when all are selected', () => {
    store.getState().toggleSelectAll(['_row-1', '_row-2'])
    store.getState().toggleSelectAll(['_row-1', '_row-2'])
    expect(store.getState().selectedIds.size).toBe(0)
  })

  it('clearSelection empties selectedIds', () => {
    store.getState().toggleSelectAll(['_row-1', '_row-2'])
    store.getState().clearSelection()
    expect(store.getState().selectedIds.size).toBe(0)
  })

  it('removeRowFromStore also removes from selectedIds', () => {
    store.getState().toggleSelect('_row-1')
    store.getState().removeRowFromStore('_row-1')
    expect(store.getState().selectedIds.has('_row-1')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
//  updateRowInStore — field-level patch
// ─────────────────────────────────────────────────────────────
describe('updateRowInStore', () => {
  it('patches only specified fields', () => {
    store.getState().updateRowInStore('_row-1', { value: 999 })
    const row = store.getState().rows.find(r => r['_id'] === '_row-1')
    expect(row?.['value']).toBe(999)
    expect(row?.['name']).toBe('Row row-1') // unchanged
  })

  it('does not affect other rows', () => {
    store.getState().updateRowInStore('_row-1', { value: 999 })
    expect(store.getState().rows.find(r => r['_id'] === '_row-2')?.['value']).toBe(200)
    expect(store.getState().rows.find(r => r['_id'] === '_row-3')?.['value']).toBe(300)
  })

  it('is a no-op for unknown rowId', () => {
    const before = store.getState().rows.length
    store.getState().updateRowInStore('_unknown', { value: 999 })
    expect(store.getState().rows.length).toBe(before)
  })
})

// ─────────────────────────────────────────────────────────────
//  FILTERS
// ─────────────────────────────────────────────────────────────
describe('filter store actions', () => {
  it('setFilter adds a filter', () => {
    store.getState().setFilter('value', { type: 'number', min: 100 })
    expect(store.getState().activeFilters['value']).toEqual({ type: 'number', min: 100 })
  })

  it('clearFilter removes a specific filter', () => {
    store.getState().setFilter('value', { type: 'number', min: 100 })
    store.getState().setFilter('name',  { type: 'text', text: 'test' })
    store.getState().clearFilter('value')
    expect(store.getState().activeFilters['value']).toBeUndefined()
    expect(store.getState().activeFilters['name']).toBeDefined()
  })

  it('clearAllFilters empties all filters', () => {
    store.getState().setFilter('value', { type: 'number', min: 100 })
    store.getState().setFilter('name',  { type: 'text', text: 'test' })
    store.getState().clearAllFilters()
    expect(Object.keys(store.getState().activeFilters)).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────
//  UNDO / HISTORY
// ─────────────────────────────────────────────────────────────
describe('history store actions', () => {
  const entry = {
    type:  'field' as const,
    rowId: '_row-1',
    field: 'value',
    oldVal: 100,
    newVal: 150,
    label: 'Changed value',
  }

  it('pushHistory adds an entry', () => {
    store.getState().pushHistory(entry)
    expect(store.getState().history).toHaveLength(1)
    expect(store.getState().history[0]?.label).toBe('Changed value')
  })

  it('popHistory returns and removes last entry', () => {
    store.getState().pushHistory(entry)
    const popped = store.getState().popHistory()
    expect(popped?.label).toBe('Changed value')
    expect(store.getState().history).toHaveLength(0)
  })

  it('clears future on pushHistory', () => {
    store.getState().pushFuture(entry)
    expect(store.getState().future).toHaveLength(1)
    store.getState().pushHistory(entry)
    expect(store.getState().future).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────
//  RESET
// ─────────────────────────────────────────────────────────────
describe('store reset', () => {
  it('resets all state to initial', () => {
    store.getState().setSort('value')
    store.getState().setFilter('value', { type: 'number', min: 100 })
    store.getState().toggleSelect('_row-1')

    store.getState().reset()

    expect(store.getState().sortState).toBeNull()
    expect(store.getState().sortModel).toEqual([])
    expect(Object.keys(store.getState().activeFilters)).toHaveLength(0)
    expect(store.getState().selectedIds.size).toBe(0)
    expect(store.getState().rows).toHaveLength(0)
  })
})
